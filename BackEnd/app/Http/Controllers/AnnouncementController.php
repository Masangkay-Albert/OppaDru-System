<?php

namespace App\Http\Controllers;

use App\Models\Announcement;
use App\Models\Franchise;
use App\Models\FranchiseUser;
use App\Models\User;
use App\Services\FacebookService;
use App\Services\ProductImageUploadService;
use App\Traits\AdminAuthTrait;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AnnouncementController extends Controller
{
    use AdminAuthTrait;

    public function __construct(
        private readonly ProductImageUploadService $imageUploadService,
        private readonly FacebookService $facebookService,
    ) {}

    /**
     * Admin: List announcements with filtering and statistics
     */
    public function index(Request $request)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $query = Announcement::query();

        // Audience filter
        if ($request->filled('audience') && $request->audience !== 'all_filter') {
            $audience = $request->audience;
            $query->where(function ($q) use ($audience) {
                $q->where('target_audience', $audience)
                  ->orWhereJsonContains('target_audiences', $audience);
            });
        }

        // Status filter
        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        // Priority filter
        if ($request->filled('priority') && $request->priority !== 'all') {
            $query->where('priority', $request->priority);
        }

        // Search query
        if ($request->filled('search')) {
            $search = '%' . trim($request->search) . '%';
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', $search)
                  ->orWhere('content', 'like', $search)
                  ->orWhere('target_audience', 'like', $search);
            });
        }

        // Date range
        if ($request->filled('from_date')) {
            $query->whereDate('date_sent', '>=', $request->from_date);
        }
        if ($request->filled('to_date')) {
            $query->whereDate('date_sent', '<=', $request->to_date);
        }

        // Sorting
        $sortDirection = $request->get('direction', 'desc') === 'asc' ? 'asc' : 'desc';
        $sortBy = $request->get('sort', 'date_sent');
        if (!in_array($sortBy, ['date_sent', 'created_at', 'title', 'status', 'priority'])) {
            $sortBy = 'date_sent';
        }

        $announcements = $query->orderBy($sortBy, $sortDirection)
            ->orderBy('created_at', 'desc')
            ->get();

        $now = now();
        $stats = [
            'total' => Announcement::query()->count(),
            'published' => Announcement::query()->where(function ($query) use ($now) {
                $query->where('status', 'published')
                    ->orWhere(function ($scheduled) use ($now) {
                    $scheduled->where('status', 'scheduled')
                        ->whereNotNull('scheduled_at')
                        ->where('scheduled_at', '<=', $now);
                    });
            })->count(),
            'scheduled' => Announcement::query()->where('status', 'scheduled')
                ->where(function ($query) use ($now) {
                    $query->whereNull('scheduled_at')->orWhere('scheduled_at', '>', $now);
                })->count(),
            'draft' => Announcement::query()->where('status', 'draft')->count(),
            'audiences' => [
                'all' => Announcement::query()->where(function ($query) {
                    $query->where('target_audience', 'all')->orWhereJsonContains('target_audiences', 'all');
                })->count(),
                'customers' => Announcement::query()->where(function ($query) {
                    $query->where('target_audience', 'customers')->orWhereJsonContains('target_audiences', 'customers');
                })->count(),
            ],
        ];

        return response()->json([
            'success' => true,
            'announcements' => $announcements,
            'stats' => $stats,
        ]);
    }

    /**
     * Admin: Store a new announcement
     */
    public function store(Request $request)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'title' => [
                'required',
                'string',
                'min:'.config('input_limits.announcement_title.min'),
                'max:'.config('input_limits.announcement_title.max'),
            ],
            'content' => 'required|string|max:'.config('input_limits.announcement_body'),
            'target_audience' => 'nullable|in:all,customers,franchise_branches',
            'target_audiences' => 'nullable|array|min:1',
            'target_audiences.*' => 'in:customers,franchise_branches',
            'franchise_branch_mode' => 'nullable|in:all,selected',
            'target_franchise_branches' => $request->input('franchise_branch_mode') === 'selected' ? 'required|array|min:1' : 'nullable|array',
            'target_franchise_branches.*' => [
                'string',
                Rule::exists('franchises', 'id'),
            ],
            'image' => 'nullable|image|max:10240', // 10MB max
            'image_url' => 'nullable|string',
            'priority' => 'nullable|string|in:normal,high,urgent,promo',
            'status' => 'nullable|string|in:published,scheduled,draft,archived',
            'date_sent' => 'nullable|date',
            'scheduled_at' => 'nullable|date',
            'author_name' => 'nullable|string|max:100',
            'publish_to_facebook' => 'nullable|boolean',
        ]);
        $targetAudiences = array_values(array_unique($validated['target_audiences'] ?? [
            ($validated['target_audience'] ?? 'customers') === 'franchise_branches'
                ? 'franchise_branches'
                : 'customers',
        ]));
        if ($targetAudiences === []) {
            return response()->json(['message' => 'Choose at least one recipient.'], 422);
        }
        $targetFranchiseBranches = null;
        if (in_array('franchise_branches', $targetAudiences, true)
            && ($validated['franchise_branch_mode'] ?? 'all') === 'selected') {
            $targetFranchiseBranches = array_values(array_map('strval', $validated['target_franchise_branches'] ?? []));
            $validBranchCount = Franchise::query()
                ->whereIn('id', $targetFranchiseBranches)
                ->where('status', 'active')
                ->where('is_active', true)
                ->where(function ($query) {
                    $query->whereNull('is_main')->orWhere('is_main', false);
                })
                ->count();
            if ($validBranchCount !== count(array_unique($targetFranchiseBranches))) {
                return response()->json(['message' => 'Choose active franchise branches only.'], 422);
            }
        }

        $imageUrl = $validated['image_url'] ?? null;
        $imagePath = null;

        // Process uploaded file if present
        if ($request->hasFile('image') && $request->file('image')->isValid()) {
            $file = $request->file('image');
            $fileName = time() . '-' . Str::random(10) . '.' . $file->getClientOriginalExtension();
            $storedPath = Storage::disk('public')->putFileAs('announcements', $file, $fileName);
            if ($storedPath) {
                $imagePath = $storedPath;
                $imageUrl = rtrim(config('app.url', 'http://localhost:8000'), '/') . '/storage/' . ltrim($storedPath, '/');
            }
        }

        $status = $validated['status'] ?? 'published';
        $dateSent = $validated['date_sent'] ?? null;
        $scheduledAt = $validated['scheduled_at'] ?? null;

        if ($status === 'published') {
            $dateSent = now();
        } elseif ($status === 'scheduled') {
            if (!$scheduledAt && $dateSent) {
                $scheduledAt = $dateSent;
            }
            $dateSent = null;
        }

        $targetAudience = in_array('customers', $targetAudiences, true) ? 'customers' : 'franchise_branches';

        $announcement = Announcement::create([
            'title' => $validated['title'],
            'content' => $validated['content'],
            'target_audience' => $targetAudience,
            'target_audiences' => $targetAudiences,
            'target_franchise_branches' => $targetFranchiseBranches,
            'image_url' => $imageUrl,
            'image_path' => $imagePath,
            'priority' => $validated['priority'] ?? 'normal',
            'status' => $status,
            'date_sent' => $dateSent,
            'scheduled_at' => $scheduledAt,
            'author_name' => $validated['author_name'] ?? 'Admin',
        ]);

        $facebookPublish = null;
        if ($request->boolean('publish_to_facebook') && $announcement->status === 'published') {
            try {
                $facebookPublish = $this->facebookService->publish(
                    trim($announcement->title . "\n\n" . $announcement->content),
                    $announcement->image_path,
                    $announcement->image_url,
                );
            } catch (\Throwable $error) {
                Log::warning('Facebook publishing failed after saving an announcement.', [
                    'announcement_id' => $announcement->id,
                    'exception' => $error,
                ]);
                $facebookPublish = [
                    'success' => false,
                    'message' => 'Facebook publishing failed. The in-app announcement was saved.',
                ];
            }

            if ($facebookPublish['success']) {
                $metadata = (array) ($announcement->metadata ?? []);
                $metadata['facebook_post_id'] = $facebookPublish['post_id'] ?? null;
                $metadata['facebook_post_url'] = $facebookPublish['post_url'] ?? null;
                $metadata['facebook_published_at'] = now()->toIso8601String();
                $announcement->metadata = $metadata;
                $announcement->save();
            }
        }

        return response()->json([
            'success' => true,
            'message' => $facebookPublish && $facebookPublish['success']
                ? 'Announcement created and published to Facebook successfully!'
                : 'Announcement created successfully.',
            'announcement' => $announcement,
            'facebook_publish' => $facebookPublish,
        ], 201);
    }

    /**
     * Admin: Show announcement
     */
    public function show(Request $request, string $id)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $announcement = Announcement::find($id);
        if (!$announcement) {
            return response()->json(['success' => false, 'message' => 'Announcement not found.'], 404);
        }

        return response()->json([
            'success' => true,
            'announcement' => $announcement,
        ]);
    }

    /**
     * Admin: Update announcement
     */
    public function update(Request $request, string $id)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $announcement = Announcement::find($id);
        if (!$announcement) {
            return response()->json(['success' => false, 'message' => 'Announcement not found.'], 404);
        }

        $requestedTitle = $request->input('title');
        $titleUnchanged = $request->exists('title')
            && is_string($requestedTitle)
            && trim($requestedTitle) === trim((string) $announcement->title);
        $requestedContent = $request->input('content');
        $contentUnchanged = $request->exists('content')
            && is_string($requestedContent)
            && trim($requestedContent) === trim((string) $announcement->content);
        $titleRules = ['sometimes', 'required', 'string'];
        if ($request->exists('title') && ! $titleUnchanged) {
            $titleRules = [
                ...$titleRules,
                'min:'.config('input_limits.announcement_title.min'),
                'max:'.config('input_limits.announcement_title.max'),
            ];
        }
        $contentRules = ['sometimes', 'required', 'string'];
        if ($request->exists('content') && ! $contentUnchanged) {
            $contentRules[] = 'max:'.config('input_limits.announcement_body');
        }
        $validated = $request->validate([
            'title' => $titleRules,
            'content' => $contentRules,
            'target_audience' => 'nullable|in:all,customers,franchise_branches',
            'target_audiences' => 'sometimes|array|min:1',
            'target_audiences.*' => 'in:customers,franchise_branches',
            'franchise_branch_mode' => 'sometimes|in:all,selected',
            'target_franchise_branches' => $request->input('franchise_branch_mode') === 'selected' ? 'required|array|min:1' : 'nullable|array',
            'target_franchise_branches.*' => [
                'string',
                Rule::exists('franchises', 'id'),
            ],
            'image' => 'nullable|image|max:10240',
            'image_url' => 'nullable|string',
            'remove_image' => 'nullable|boolean',
            'priority' => 'nullable|string|in:normal,high,urgent,promo',
            'status' => 'nullable|string|in:published,scheduled,draft,archived',
            'date_sent' => 'nullable|date',
            'scheduled_at' => 'nullable|date',
            'author_name' => 'nullable|string|max:100',
        ]);
        if ($request->has('target_audiences') || $request->has('target_audience')) {
            $targetAudiences = array_values(array_unique($validated['target_audiences'] ?? [
                ($validated['target_audience'] ?? $announcement->target_audience) === 'franchise_branches'
                    ? 'franchise_branches'
                    : 'customers',
            ]));
            if ($targetAudiences === []) {
                return response()->json(['message' => 'Choose at least one recipient.'], 422);
            }
            $targetFranchiseBranches = null;
            if (in_array('franchise_branches', $targetAudiences, true)
                && ($validated['franchise_branch_mode'] ?? 'all') === 'selected') {
                $targetFranchiseBranches = array_values(array_map('strval', $validated['target_franchise_branches'] ?? []));
                $validBranchCount = Franchise::query()
                    ->whereIn('id', $targetFranchiseBranches)
                    ->where('status', 'active')
                    ->where('is_active', true)
                    ->where(function ($query) {
                        $query->whereNull('is_main')->orWhere('is_main', false);
                    })
                    ->count();
                if ($validBranchCount !== count(array_unique($targetFranchiseBranches))) {
                    return response()->json(['message' => 'Choose active franchise branches only.'], 422);
                }
            }
            $announcement->target_audiences = $targetAudiences;
            $announcement->target_audience = in_array('customers', $targetAudiences, true)
                ? 'customers'
                : 'franchise_branches';
            $announcement->target_franchise_branches = $targetFranchiseBranches;
        }
        if ($titleUnchanged) {
            $validated['title'] = $announcement->getRawOriginal('title');
        }
        if ($contentUnchanged) {
            $validated['content'] = $announcement->getRawOriginal('content');
        }

        // Process image removal
        if ($request->boolean('remove_image')) {
            if ($announcement->image_path && Storage::disk('public')->exists($announcement->image_path)) {
                Storage::disk('public')->delete($announcement->image_path);
            }
            $announcement->image_url = null;
            $announcement->image_path = null;
        }

        // Process new uploaded file if present
        if ($request->hasFile('image') && $request->file('image')->isValid()) {
            if ($announcement->image_path && Storage::disk('public')->exists($announcement->image_path)) {
                Storage::disk('public')->delete($announcement->image_path);
            }
            $file = $request->file('image');
            $fileName = time() . '-' . Str::random(10) . '.' . $file->getClientOriginalExtension();
            $storedPath = Storage::disk('public')->putFileAs('announcements', $file, $fileName);
            if ($storedPath) {
                $announcement->image_path = $storedPath;
                $announcement->image_url = rtrim(config('app.url', 'http://localhost:8000'), '/') . '/storage/' . ltrim($storedPath, '/');
            }
        } elseif ($request->filled('image_url')) {
            $announcement->image_url = $request->image_url;
        }

        if ($request->has('title')) {
            $announcement->title = $validated['title'];
        }
        if ($request->has('content')) {
            $announcement->content = $validated['content'];
        }
        if ($request->has('priority')) {
            $announcement->priority = $validated['priority'];
        }
        $wasPublished = $announcement->status === 'published';
        if ($request->has('status')) {
            $announcement->status = $validated['status'];
            if ($announcement->status === 'scheduled') {
                $announcement->date_sent = null;
            }
        }
        if ($request->has('date_sent')) {
            $announcement->date_sent = $validated['date_sent'] ? $validated['date_sent'] : $announcement->date_sent;
        }
        if ($request->has('scheduled_at')) {
            $announcement->scheduled_at = $validated['scheduled_at'];
        }
        if ($announcement->status === 'scheduled') {
            if ($request->has('date_sent') && !$request->has('scheduled_at')) {
                $announcement->scheduled_at = $validated['date_sent'];
            }
            $announcement->date_sent = null;
        } elseif ($announcement->status === 'published' && !$wasPublished) {
            $announcement->date_sent = now();
        }
        if ($request->has('author_name')) {
            $announcement->author_name = $validated['author_name'];
        }

        $announcement->save();

        return response()->json([
            'success' => true,
            'message' => 'Announcement updated successfully.',
            'announcement' => $announcement,
        ]);
    }

    /**
     * Admin: Delete announcement
     */
    public function destroy(Request $request, string $id)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $announcement = Announcement::find($id);
        if (!$announcement) {
            return response()->json(['success' => false, 'message' => 'Announcement not found.'], 404);
        }

        if ($announcement->image_path && Storage::disk('public')->exists($announcement->image_path)) {
            Storage::disk('public')->delete($announcement->image_path);
        }

        $announcement->delete();

        return response()->json([
            'success' => true,
            'message' => 'Announcement deleted successfully.',
        ]);
    }

    /**
     * Admin: Toggle Status or quick publish
     */
    public function toggleStatus(Request $request, string $id)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $announcement = Announcement::find($id);
        if (!$announcement) {
            return response()->json(['success' => false, 'message' => 'Announcement not found.'], 404);
        }

        $newStatus = $request->input('status');
        if (!$newStatus) {
            $newStatus = $announcement->status === 'published' ? 'draft' : 'published';
        }

        $wasPublished = $announcement->status === 'published';
        $announcement->status = $newStatus;
        if ($newStatus === 'published' && !$wasPublished) {
            $announcement->date_sent = now();
        }

        $announcement->save();

        return response()->json([
            'success' => true,
            'message' => "Announcement status changed to {$newStatus}.",
            'announcement' => $announcement,
        ]);
    }

    /**
     * Public / Client: Get currently visible customer announcements.
     */
    public function customerList(Request $request)
    {
        $user = $request->user();
        if (! $user instanceof User || $user->role !== 'customer') {
            return response()->json(['message' => 'Customer access required.'], 403);
        }

        $branchId = $this->validatedCustomerBranchId($request);
        $announcements = $this->customerVisibleAnnouncements($branchId)
            ->orderByRaw("COALESCE(CASE WHEN status = 'scheduled' THEN scheduled_at ELSE date_sent END, created_at) DESC")
            ->get();
        $readIds = DB::table('customer_announcement_reads')
            ->where('user_id', $user->id)
            ->whereIn('announcement_id', $announcements->pluck('id'))
            ->pluck('announcement_id')
            ->map(static fn ($id) => (string) $id)
            ->all();
        $readSet = array_fill_keys($readIds, true);

        $announcements->each(function (Announcement $announcement) use ($readSet) {
            $announcement->setAttribute('is_read', isset($readSet[(string) $announcement->id]));
        });

        return response()->json([
            'success' => true,
            'announcements' => $announcements,
            'unread_count' => $announcements->where('is_read', false)->count(),
        ])->header('Cache-Control', 'no-store, private');
    }

    /**
     * Customer: mark one visible announcement read or unread.
     */
    public function setCustomerAnnouncementRead(Request $request, string $id)
    {
        $user = $request->user();
        if (! $user instanceof User || $user->role !== 'customer') {
            return response()->json(['message' => 'Customer access required.'], 403);
        }

        $request->validate(['read' => 'sometimes|boolean']);
        $branchId = $this->validatedCustomerBranchId($request);
        $announcement = $this->customerVisibleAnnouncements($branchId)->whereKey($id)->first();
        if (! $announcement) {
            return response()->json(['message' => 'Announcement not found.'], 404);
        }

        $now = now();
        if ($request->boolean('read', true)) {
            DB::table('customer_announcement_reads')->updateOrInsert(
                ['announcement_id' => $announcement->id, 'user_id' => $user->id],
                ['read_at' => $now, 'updated_at' => $now, 'created_at' => $now],
            );
        } else {
            DB::table('customer_announcement_reads')
                ->where('announcement_id', $announcement->id)
                ->where('user_id', $user->id)
                ->delete();
        }

        return response()->json(['success' => true, 'is_read' => $request->boolean('read', true)]);
    }

    /**
     * Customer: mark all currently visible announcements read.
     */
    public function markCustomerAnnouncementsRead(Request $request)
    {
        $user = $request->user();
        if (! $user instanceof User || $user->role !== 'customer') {
            return response()->json(['message' => 'Customer access required.'], 403);
        }

        $branchId = $this->validatedCustomerBranchId($request);
        $now = now();
        $rows = $this->customerVisibleAnnouncements($branchId)
            ->pluck('id')
            ->map(static fn ($announcementId) => [
                'announcement_id' => $announcementId,
                'user_id' => $user->id,
                'read_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ])
            ->all();
        if ($rows !== []) {
            DB::table('customer_announcement_reads')->upsert(
                $rows,
                ['user_id', 'announcement_id'],
                ['read_at', 'updated_at'],
            );
        }

        return response()->json(['success' => true]);
    }

    private function validatedCustomerBranchId(Request $request): ?string
    {
        $validated = $request->validate([
            'branch_id' => [
                'nullable',
                'string',
                Rule::exists('franchises', 'id')->where(fn ($query) => $query
                    ->where('status', 'active')
                    ->where('is_active', true)),
            ],
        ]);

        return isset($validated['branch_id']) ? (string) $validated['branch_id'] : null;
    }

    private function customerVisibleAnnouncements(?string $branchId): Builder
    {
        return Announcement::query()
            ->where(function ($query) {
                $query->where('status', 'published')
                    ->orWhere(function ($scheduled) {
                    $scheduled->where('status', 'scheduled')
                        ->whereNotNull('scheduled_at')
                        ->where('scheduled_at', '<=', now());
                    });
            })
            ->whereJsonContains('target_audiences', 'customers')
            ->where('priority', '!=', 'promo')
            ->where(function ($query) use ($branchId) {
                $query->whereNull('target_franchise_branches');
                if ($branchId !== null) {
                    $query->orWhereJsonContains('target_franchise_branches', $branchId);
                    if (ctype_digit($branchId)) {
                        $query->orWhereJsonContains('target_franchise_branches', (int) $branchId);
                    }
                }
            });
    }

    /**
     * Franchise: list announcements targeted to the authenticated branch.
     */
    public function franchiseList(Request $request)
    {
        $user = $request->user();
        if (! $user instanceof FranchiseUser || ! $user->franchise_id) {
            return response()->json(['message' => 'Franchise branch access required.'], 403);
        }

        $branchId = (string) $user->franchise_id;
        $announcements = $this->franchiseVisibleAnnouncements($branchId)
            ->orderByRaw("COALESCE(CASE WHEN status = 'scheduled' THEN scheduled_at ELSE date_sent END, created_at) DESC")
            ->get();
        $readIds = DB::table('announcement_reads')
            ->where('franchise_id', $branchId)
            ->whereIn('announcement_id', $announcements->pluck('id'))
            ->pluck('announcement_id')
            ->map(static fn ($id) => (string) $id)
            ->all();
        $readSet = array_fill_keys($readIds, true);

        $announcements->each(function (Announcement $announcement) use ($readSet) {
            $announcement->setAttribute('is_read', isset($readSet[(string) $announcement->id]));
        });

        return response()->json([
            'announcements' => $announcements,
            'unread_count' => $announcements->where('is_read', false)->count(),
        ])->header('Cache-Control', 'no-store, private');
    }

    /**
     * Franchise: mark a targeted announcement as viewed by this branch.
     */
    public function markFranchiseRead(Request $request, string $id)
    {
        $user = $request->user();
        if (! $user instanceof FranchiseUser || ! $user->franchise_id) {
            return response()->json(['message' => 'Franchise branch access required.'], 403);
        }

        $branchId = (string) $user->franchise_id;
        $announcement = $this->franchiseVisibleAnnouncements($branchId)
            ->whereKey($id)
            ->first();
        if (! $announcement) {
            return response()->json(['message' => 'Announcement not found.'], 404);
        }

        DB::table('announcement_reads')->updateOrInsert(
            ['announcement_id' => $announcement->id, 'franchise_id' => $branchId],
            ['viewed_at' => now(), 'updated_at' => now(), 'created_at' => now()],
        );

        return response()->json(['success' => true]);
    }

    private function franchiseVisibleAnnouncements(string $branchId): Builder
    {
        return Announcement::query()
            ->where(function ($query) {
                $query->where('status', 'published')
                    ->orWhere(function ($scheduled) {
                    $scheduled->where('status', 'scheduled')
                        ->whereNotNull('scheduled_at')
                        ->where('scheduled_at', '<=', now());
                    });
            })
            ->whereJsonContains('target_audiences', 'franchise_branches')
            ->where(function ($query) use ($branchId) {
                $query->whereNull('target_franchise_branches')
                    ->orWhereJsonContains('target_franchise_branches', $branchId);
                if (ctype_digit($branchId)) {
                    $query->orWhereJsonContains('target_franchise_branches', (int) $branchId);
                }
            });
    }

    /**
     * Admin: Publish an existing announcement to Facebook Page
     */
    public function publishToFacebook(Request $request, string $id)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $announcement = Announcement::find($id);
        if (!$announcement) {
            return response()->json(['success' => false, 'message' => 'Announcement not found.'], 404);
        }

        if (!$this->facebookService->isConfigured()) {
            return response()->json([
                'success' => false,
                'message' => 'Facebook is not configured. Set the Page Access Token in the backend environment.',
                'need_config' => true,
            ], 422);
        }

        if (!empty($announcement->metadata['facebook_published_at'])) {
            return response()->json([
                'success' => false,
                'message' => 'This announcement has already been published to Facebook.',
            ], 409);
        }

        $message = trim($announcement->title . "\n\n" . $announcement->content);
        try {
            $res = $this->facebookService->publish($message, $announcement->image_path, $announcement->image_url);
        } catch (\Throwable $error) {
            Log::warning('Facebook publishing failed for a saved announcement.', [
                'announcement_id' => $announcement->id,
                'exception' => $error,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Facebook publishing failed. The in-app announcement remains available.',
            ], 502);
        }

        if (!empty($res['success'])) {
            $metadata = (array) ($announcement->metadata ?? []);
            $metadata['facebook_post_id'] = $res['post_id'] ?? null;
            $metadata['facebook_post_url'] = $res['post_url'] ?? null;
            $metadata['facebook_published_at'] = now()->toIso8601String();
            $announcement->metadata = $metadata;
            $announcement->save();

            return response()->json([
                'success' => true,
                'message' => 'Successfully published to Facebook Page!',
                'post_id' => $res['post_id'] ?? null,
                'post_url' => $res['post_url'] ?? null,
                'announcement' => $announcement,
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => $res['message'] ?? 'Failed to post on Facebook.',
        ], 500);
    }

    /**
     * Admin: Get current Facebook connection status
     */
    public function getFacebookStatus(Request $request)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        return response()->json([
            'success' => true,
            'status' => $this->facebookService->getStatus(),
        ]);
    }
}

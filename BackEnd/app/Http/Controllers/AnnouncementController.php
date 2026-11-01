<?php

namespace App\Http\Controllers;

use App\Models\Announcement;
use App\Services\FacebookService;
use App\Services\ProductImageUploadService;
use App\Support\HttpCacheResponse;
use App\Traits\AdminAuthTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class AnnouncementController extends Controller
{
    use AdminAuthTrait;
    use HttpCacheResponse;

    public function __construct(
        private readonly ProductImageUploadService $imageUploadService,
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

        // Summary statistics via single aggregate query to avoid pulling the entire table
        $rawStats = Announcement::query()->selectRaw("
            COUNT(*) as total,
            COUNT(CASE WHEN status = 'published' THEN 1 END) as published,
            COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled,
            COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft,
            COUNT(CASE WHEN target_audience = 'all' OR target_audiences::text LIKE '%\"all\"%' THEN 1 END) as audience_all,
            COUNT(CASE WHEN target_audience = 'customers' OR target_audiences::text LIKE '%\"customers\"%' THEN 1 END) as audience_customers
        ")->first();

        $stats = [
            'total' => (int) ($rawStats->total ?? 0),
            'published' => (int) ($rawStats->published ?? 0),
            'scheduled' => (int) ($rawStats->scheduled ?? 0),
            'draft' => (int) ($rawStats->draft ?? 0),
            'audiences' => [
                'all' => (int) ($rawStats->audience_all ?? 0),
                'customers' => (int) ($rawStats->audience_customers ?? 0),
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
            'title' => 'required|string|max:255',
            'content' => 'required|string',
            'target_audience' => 'nullable|in:all,customers',
            'image' => 'nullable|image|max:10240', // 10MB max
            'image_url' => 'nullable|string',
            'priority' => 'nullable|string|in:normal,high,urgent,promo',
            'status' => 'nullable|string|in:published,scheduled,draft,archived',
            'date_sent' => 'nullable|date',
            'scheduled_at' => 'nullable|date',
            'author_name' => 'nullable|string|max:100',
            'publish_to_facebook' => 'nullable|boolean',
        ]);

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

        if ($status === 'published' && !$dateSent) {
            $dateSent = now();
        } elseif ($status === 'scheduled' && !$scheduledAt && $dateSent) {
            $scheduledAt = $dateSent;
        }

        $targetAudience = in_array($validated['target_audience'] ?? '', ['all', 'customers']) ? $validated['target_audience'] : 'all';

        $announcement = Announcement::create([
            'title' => $validated['title'],
            'content' => $validated['content'],
            'target_audience' => $targetAudience,
            'target_audiences' => [$targetAudience],
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
            $facebookPublish = (new FacebookService())->publish(
                trim($announcement->title . "\n\n" . $announcement->content),
                $announcement->image_path,
                $announcement->image_url,
            );

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
    public function show(Request $request, $id)
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
    public function update(Request $request, $id)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $announcement = Announcement::find($id);
        if (!$announcement) {
            return response()->json(['success' => false, 'message' => 'Announcement not found.'], 404);
        }

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'content' => 'sometimes|required|string',
            'target_audience' => 'nullable|in:all,customers',
            'image' => 'nullable|image|max:10240',
            'image_url' => 'nullable|string',
            'remove_image' => 'nullable|boolean',
            'priority' => 'nullable|string|in:normal,high,urgent,promo',
            'status' => 'nullable|string|in:published,scheduled,draft,archived',
            'date_sent' => 'nullable|date',
            'scheduled_at' => 'nullable|date',
            'author_name' => 'nullable|string|max:100',
        ]);

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
        if ($request->has('target_audience') && in_array($validated['target_audience'] ?? '', ['all', 'customers'])) {
            $announcement->target_audience = $validated['target_audience'];
            $announcement->target_audiences = [$validated['target_audience']];
        }
        if ($request->has('priority')) {
            $announcement->priority = $validated['priority'];
        }
        if ($request->has('status')) {
            $announcement->status = $validated['status'];
            if ($announcement->status === 'published' && !$announcement->date_sent) {
                $announcement->date_sent = now();
            }
        }
        if ($request->has('date_sent')) {
            $announcement->date_sent = $validated['date_sent'] ? $validated['date_sent'] : $announcement->date_sent;
        }
        if ($request->has('scheduled_at')) {
            $announcement->scheduled_at = $validated['scheduled_at'];
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
    public function destroy(Request $request, $id)
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
    public function toggleStatus(Request $request, $id)
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

        $announcement->status = $newStatus;
        if ($newStatus === 'published' && !$announcement->date_sent) {
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
     * Public / Client: Get published customer announcements.
     */
    public function publicList(Request $request)
    {
        $data = Cache::remember('announcements_public_nonpromo_list_v1', 300, function () {
            $announcements = Announcement::published()
                ->where('priority', '!=', 'promo')
                ->where(function ($q) {
                    $q->where('target_audience', 'customers')
                      ->orWhere('target_audience', 'all')
                      ->orWhereJsonContains('target_audiences', 'customers')
                      ->orWhereJsonContains('target_audiences', 'all');
                })
                ->orderBy('priority', 'desc')
                ->orderBy('date_sent', 'desc')
                ->limit(20)
                ->get();

            return [
                'success' => true,
                'announcements' => $announcements,
            ];
        });

        return $this->cachedJsonResponse($request, $data, 180);
    }

    /**
     * Admin: Publish an existing announcement to Facebook Page
     */
    public function publishToFacebook(Request $request, $id)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $announcement = Announcement::find($id);
        if (!$announcement) {
            return response()->json(['success' => false, 'message' => 'Announcement not found.'], 404);
        }

        $fbService = new FacebookService();
        if (!$fbService->isConfigured()) {
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
        $res = $fbService->publish($message, $announcement->image_path, $announcement->image_url);

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

        $fbService = new FacebookService();
        return response()->json([
            'success' => true,
            'status' => $fbService->getStatus(),
        ]);
    }
}

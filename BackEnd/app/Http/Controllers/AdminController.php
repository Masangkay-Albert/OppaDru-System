<?php

namespace App\Http\Controllers;

use App\Models\Admin;
use App\Models\Order;
use App\Models\User;
use App\Traits\AdminAuthTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class AdminController extends Controller
{
    use AdminAuthTrait;

    public function index(Request $request)
    {
        $admins = Admin::select('id', 'full_name', 'email', 'role', 'created_at', 'updated_at')
            ->orderBy('created_at')
            ->get();
        return response()->json(['data' => $admins]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'full_name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:admin,email',
            'password' => 'required|string|min:6|confirmed',
            'role' => ['sometimes', 'in:admin,system_administrator'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $admin = Admin::create([
            'full_name' => $request->full_name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'role' => $request->input('role', Admin::ROLE_ADMIN),
        ]);

        return response()->json(['admin' => $admin->makeHidden(['password', 'api_token'])], 201);
    }

    public function showCurrent(Request $request)
    {
        return response()->json(['admin' => $request->user()->makeHidden(['password', 'api_token'])]);
    }

    public function update(Request $request, string $id)
    {
        $admin = Admin::findOrFail($id);
        $validator = Validator::make($request->all(), [
            'full_name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:admin,email,'.$admin->id,
        ]);
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $admin->update($validator->validated());
        return response()->json(['admin' => $admin->fresh()->makeHidden(['password', 'api_token'])]);
    }

    public function updateRole(Request $request, string $id)
    {
        $validator = Validator::make($request->all(), [
            'role' => ['required', 'in:admin,system_administrator'],
        ]);
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $updated = DB::transaction(function () use ($request, $id) {
            $admins = Admin::query()->orderBy('id')->lockForUpdate()->get();
            $target = $admins->firstWhere('id', $id);
            abort_if(! $target, 404, 'Administrator not found.');

            $nextRole = $request->input('role');
            if ($target->role === Admin::ROLE_SYSTEM_ADMINISTRATOR
                && $nextRole !== Admin::ROLE_SYSTEM_ADMINISTRATOR
                && $admins->where('role', Admin::ROLE_SYSTEM_ADMINISTRATOR)->count() <= 1) {
                abort(422, 'At least one System Administrator must remain.');
            }

            $target->role = $nextRole;
            $target->save();
            return $target->fresh();
        });

        return response()->json(['admin' => $updated->makeHidden(['password', 'api_token'])]);
    }

    public function resetPassword(Request $request, string $id)
    {
        $admin = Admin::findOrFail($id);
        $validator = Validator::make($request->all(), [
            'password' => 'required|string|min:8|confirmed',
        ]);
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $admin->password = Hash::make($request->input('password'));
        $admin->api_token = null;
        $admin->save();
        return response()->json(['message' => 'Administrator password reset successfully.']);
    }

    public function destroy(Request $request, string $id)
    {
        $actor = $request->user();
        $deleted = DB::transaction(function () use ($actor, $id) {
            $admins = Admin::query()->orderBy('id')->lockForUpdate()->get();
            $target = $admins->firstWhere('id', $id);
            abort_if(! $target, 404, 'Administrator not found.');
            abort_if((string) $target->id === (string) $actor->id, 422, 'You cannot delete your own account.');

            if ($target->role === Admin::ROLE_SYSTEM_ADMINISTRATOR
                && $admins->where('role', Admin::ROLE_SYSTEM_ADMINISTRATOR)->count() <= 1) {
                abort(422, 'The last System Administrator cannot be deleted.');
            }

            return $target->delete();
        });

        return response()->json(['message' => $deleted ? 'Administrator deleted successfully.' : 'Unable to delete administrator.']);
    }

    public function count(Request $request)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $count = Admin::count();
        return response()->json(['count' => $count]);
    }

    public function destroyCustomer(Request $request, string $id)
    {
        if (!$this->checkAdminAuth($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $user = User::find($id);

        if (!$user) {
            return response()->json(['message' => 'Customer not found'], 404);
        }

        Order::where('user_id', $user->id)->update(['user_id' => null]);
        $user->delete();

        return response()->json(['message' => 'Customer deleted successfully']);
    }
}

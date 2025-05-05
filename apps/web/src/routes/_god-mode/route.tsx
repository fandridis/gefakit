import { LoadingOverlay } from "@/components/loading-overlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sessionQueryKey } from "@/features/auth/hooks/use-auth"
import { apiStartImpersonation, apiStopImpersonation } from "@/features/impersonation/api"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { useState } from "react";

export const Route = createFileRoute('/_god-mode')({
  beforeLoad: ({ context, location }) => {
    console.log('context', context)
    if (!context.authState.session) {
      console.log('redirecting to login...')
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      })
    }

    if (context.authState.session.impersonator_user_id) {
      // All is well, it is an admin/support user in disguise!
    } else if (!['ADMIN', 'SUPPORT'].includes(context.authState.user?.role ?? '')) {
      throw new Error('You are not authorized to access this page')
    }
  },
  component: GodModeComponent,
})


function GodModeComponent() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState('');

  const startImpersonationMutation = useMutation({
    mutationFn: apiStartImpersonation,
    onSuccess: async () => {
      console.log('It is happening!')
      await queryClient.invalidateQueries({ queryKey: sessionQueryKey }); // Refresh session state after sign-in
      window.location.reload(); // Force page refresh
    },
    // onError handled via mutation.error below
  });

  return (
    <div className="p-4 min-h-screen flex flex-col border-4 border-pink-500">
      <div>
        <h1>God Mode</h1>

        <div className="mt-4">
          <label htmlFor="userId" className="block text-sm font-medium text-gray-700">
            User ID to Impersonate
          </label>
          <div className="mt-1 max-w-md flex gap-2">
            <Input
              type="text"
              name="userId"
              id="userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter User ID"
            />
            <LoadingOverlay loading={startImpersonationMutation.isPending}>
              <Button
                type="button"
                onClick={() => startImpersonationMutation.mutate(Number(userId))}
                disabled={!userId || startImpersonationMutation.isPending}
              >
                Start Impersonating
              </Button>
            </LoadingOverlay>
          </div>
          {startImpersonationMutation.error && (
            <p className="mt-2 text-sm text-red-600">Error: {startImpersonationMutation.error.message}</p>
          )}
        </div>
      </div>
    </div>
  )
}
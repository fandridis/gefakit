import { LoadingOverlay } from "@/components/loading-overlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sessionQueryKey } from "@/features/auth/hooks/use-auth"
import { apiStartImpersonation } from "@/features/impersonation/api"
import { GetSessionResponseDTO } from "@gefakit/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { useState } from "react";

export const Route = createFileRoute('/_god-mode')({
  beforeLoad: ({ preload, context, location }) => {
    console.log('context', context)
    if (preload) {
      // If we're preloading, we don't need to do anything
      return;
    }

    const queryClient = context.queryClient
    const session = queryClient.getQueryData<GetSessionResponseDTO>(sessionQueryKey)

    if (!session) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      })
    }

    if (session.session?.impersonator_user_id) {
      // All is well, it is an admin/support user in disguise!
    } else if (!['ADMIN', 'SUPPORT'].includes(session.user?.role ?? '')) {
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
import { sessionQueryKey, useAuth } from '@/features/auth/hooks/use-auth'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { UpdateUserForm } from '@/features/auth/components/update-user-form';
import { Button } from '@/components/ui/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiSignOut } from '@/features/auth/api';
import { LoadingOverlay } from '@/components/loading-overlay';

export const Route = createFileRoute('/_protected/settings/profile')({
  component: RouteComponent,
})

function RouteComponent() {
  const auth = useAuth()

  const username = auth.session?.user?.username


  return <div>Hello {username}

    <div className='flex flex-col gap-4 border-4 p-4'>
      <UpdateUserForm />
      <LogoutButton />
    </div>
  </div>

}

function LogoutButton() {
  const router = useRouter()
  const queryClient = useQueryClient()


  const mutation = useMutation({
    mutationFn: apiSignOut,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: sessionQueryKey })
      await queryClient.setQueryData(sessionQueryKey, null)

      router.navigate({ to: '/login' }) // TODO: Take this from a config
    }
  });

  return <LoadingOverlay loading={mutation.isPending}>
    <Button className='w-full' onClick={() => mutation.mutate()}>Logout</Button>
  </LoadingOverlay>
}

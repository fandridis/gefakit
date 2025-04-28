import { LoadingOverlay } from '@/components/loading-overlay'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { externalAuthStore } from '@/lib/use-external-auth'
import { createFileRoute, useRouter, useRouterState } from '@tanstack/react-router'

export const Route = createFileRoute('/_settings/profile')({
  component: RouteComponent,
})

function RouteComponent() {
  const auth = useAuth()
  const router = useRouter()
  const navigate = Route.useNavigate()
  const isLoading = useRouterState({ select: (s) => s.isLoading })

  const handleLogout = () => {
    auth.signOut().then(() => {
      externalAuthStore.setSession(undefined)
      externalAuthStore.setUser(undefined)

      navigate({ to: '/' })
    })
  }


  return <div>
    Hello "/settings/profile"!
    <LoadingOverlay loading={isLoading}>
      <Button onClick={handleLogout}>Logout</Button>
    </LoadingOverlay>
  </div>
}

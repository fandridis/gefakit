import { AppHeader } from "@/components/layout/app-header"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { TopNav } from "@/components/layout/top-nav"
import { SidebarProvider } from "@/components/ui/sidebar"
import { SidebarInset } from "@/components/ui/sidebar"
import { SearchProvider } from "@/context/search-context"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { Search } from "lucide-react"

export const Route = createFileRoute('/_protected')({
  beforeLoad: ({ context, location }) => {
    console.log('==== settings beforeLoad ====')
    console.log('context', context)
    // If the user is not authenticated, redirect them to the login page
    if (!context.authState.session) {
      console.log('redirecting to login...')
      // Instead of throwing, we could also do
      // if (!context.auth.isAuthenticated) {
      //   return <LoginPage /> or <LoginDialog />
      // }
      // else {
      //   return <SettingsPage />
      // }
      throw redirect({
        to: '/login',
        // replace: true, // This will prevent the user from going back.
        search: {
          // Use the current location to power a redirect after login
          // (Do not use `router.state.resolvedLocation` as it can
          // potentially lag behind the actual current location)
          redirect: location.href,
        },
      })
    }
  },
  component: SettingsPage,
})

function SettingsPage() {
  const defaultOpen = true
  const auth = useAuth()
  console.log('[SettingsPage]: ', auth)

  return (
    <SearchProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <div className="flex flex-1 flex-col relative">
            <AppHeader>
              <TopNav links={[]} />
              <div className='ml-auto flex items-center space-x-4'>
                <Search />
              </div>
            </AppHeader>
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </SearchProvider >
  )
}
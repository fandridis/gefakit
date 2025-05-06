import { AppHeader } from "@/components/layout/app-header"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { TopNav } from "@/components/layout/top-nav"
import { SidebarProvider } from "@/components/ui/sidebar"
import { SidebarInset } from "@/components/ui/sidebar"
import { SearchProvider } from "@/context/search-context"
import { sessionQueryKey, useAuth } from "@/features/auth/hooks/use-auth"
import { GetSessionResponseDTO } from "@gefakit/shared"
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { Search } from "lucide-react"

export const Route = createFileRoute('/_protected')({
  beforeLoad: ({ preload, context, location }) => {
    if (preload) {
      // If we're preloading, we don't need to do anything
      return;
    }

    // User context.queryClient to check if the user is authenticated
    const queryClient = context.queryClient
    const session = queryClient.getQueryData<GetSessionResponseDTO>(sessionQueryKey)

    if (!session) {
      return redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }
  },
  component: SettingsPage,
})

function SettingsPage() {
  const defaultOpen = true


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
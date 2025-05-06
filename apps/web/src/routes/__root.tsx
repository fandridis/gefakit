import { Link, Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { ImpersonationBanner } from '@/features/impersonation/components/impersonation-banner'
import { QueryClient } from '@tanstack/react-query'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

interface MyRouterContext {
    queryClient: QueryClient,
    // authState: AuthState
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
    component: () => (
        <>
            <Outlet />
            <TanStackRouterDevtools position="bottom-right" initialIsOpen={false} />
            <ReactQueryDevtools buttonPosition='bottom-left' initialIsOpen={false} />
            <ImpersonationBanner />
        </>
    ),
    notFoundComponent: () => {
        return (
            <div>
                <p>This is the notFoundComponent configured on root route</p>
                <Link to="/">Start Over</Link>
            </div>
        )
    },
})


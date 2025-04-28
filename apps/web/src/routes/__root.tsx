import { Link, Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import type { QueryClient } from '@tanstack/react-query'
import { SessionDTO, UserDTO } from '@gefakit/shared'

interface MyRouterContext {
    queryClient: QueryClient,
    authState: {
        isInitialLoading: boolean,
        session: SessionDTO | undefined
        user: UserDTO | undefined
    }
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
    component: () => (
        <>
            <Outlet />
            <TanStackRouterDevtools position="bottom-right" initialIsOpen={false} />
            <ReactQueryDevtools buttonPosition='top-right' initialIsOpen={false} />
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
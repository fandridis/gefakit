import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { routeTree } from './routeTree.gen'
import './index.css'
import { sessionQueryKey } from './features/auth/hooks/use-auth'
import { GetSessionResponseDTO } from '@gefakit/shared'
import { useEffect, useState } from 'react'
import { apiGetSession } from './features/auth/api'


const queryClient = new QueryClient()

// Set up a Router instance
const router = createRouter({
  routeTree,
  context: {
    queryClient,
    // authState: undefined!
  },
  defaultPreload: 'intent',
  // Since we're using React Query, we don't want loader calls to ever be stale
  // This will ensure that the loader is always called when the route is preloaded or visited
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
})

// Register things for typesafety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <InnerApp />
    </QueryClientProvider>
  )
}

function InnerApp() {
  const [isLoadingForTheFirstTime, setIsLoadingForTheFirstTime] = useState(true)
  const queryClient = useQueryClient()

  console.log('[INNER API]: API_URL', import.meta.env.VITE_API_URL)

  /**
   * This is just to make sure the session is loaded on a fresh page load.
   * Using useAuth() would not work here because it would cause an infinite loop.
   * Maybe we can investigate why is that the case, fix useAuth and use it here.
   */
  useEffect(() => {
    (async () => {
      try {
        await queryClient.ensureQueryData<GetSessionResponseDTO | null>({
          queryKey: sessionQueryKey,
          queryFn: apiGetSession,
        });
      } catch (error) {
      } finally {
        setIsLoadingForTheFirstTime(false)
      }
    })();
  }, [queryClient]);

  if (isLoadingForTheFirstTime) {
    return null;
  }

  return (
    <RouterProvider router={router} context={{
      queryClient,
    }} />
  )
}

const rootElement = document.getElementById('root')!

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <App />
  )
}
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { routeTree } from './routeTree.gen'
import './index.css'
import { useExternalSession } from './lib/use-external-auth'
// import { useAuth } from './features/auth/hooks/useAuth'

const queryClient = new QueryClient()

// Set up a Router instance
const router = createRouter({
  routeTree,
  context: {
    queryClient,
    // auth: undefined!
    authState: undefined!
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
  console.log('Loading App...')
  return (
    <QueryClientProvider client={queryClient}>
      <InnerApp />
    </QueryClientProvider>
  )
}

function InnerApp() {
  const externalSession = useExternalSession();

  if (externalSession.isInitialLoading) {
    return null;
  }

  return (
    <RouterProvider router={router} context={{
      queryClient,
      authState: {
        isInitialLoading: externalSession.isInitialLoading,
        session: externalSession.session,
        user: externalSession.user,
      }
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
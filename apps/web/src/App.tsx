// App.tsx (or wherever AppContent is)
import { useEffect, useState } from 'react'; // Removed useEffect unless needed for other things
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './App.css';
// Import your new hooks
import { useAuthActions } from './features/auth/hooks/useAuthActions'; // Adjust path
import { useAuthSession } from './features/auth/hooks/useAuthSession';

const queryClient = new QueryClient();

function AppContent() {
  const [count, setCount] = useState(0); // Keep local UI state if needed

  // Get session state using your new hook
  const { data, isLoading: isSessionLoading, isAuthenticated, error: sessionError } = useAuthSession();

  // Get auth action functions and states
  const {
    signInEmail,
    signUpEmail,
    signOut,
    signInSocial,
    isSigningIn,
    isSigningUp,
    isSigningOut,
    // signInError, signUpError, signOutError // Access errors if needed
  } = useAuthActions();

  useEffect(() => {
    console.log('session', data);
  }, [data]);


  // Example: log session changes (optional)
  // useEffect(() => {
  //   console.log('Session State:', { session, isSessionLoading, isAuthenticated, sessionError });
  // }, [session, isSessionLoading, isAuthenticated, sessionError]);


  const handleFetchPersons = async () => {
    console.log('Fetching persons...');
    try {
      const res = await fetch('http://localhost:8787/api/v1/persons', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Requires user to be logged in on backend
      });
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      console.log('Persons data: ', data);
    } catch (error) {
      console.error("Failed to fetch persons:", error);
      // Handle error (e.g., show message) - likely needs authentication
    }
  };

  // Example data for forms
  const email = 'john@example.com';
  const password = '1q2w3eeqoidj4r';
  const username = 'John';

  return (
    <>
      <h1>Auth Actions & Session State</h1>

      {/* Display Session Info */}
      <div>
        <h2>Session Status:</h2>
        {isSessionLoading && <p>Loading session...</p>}
        {sessionError && <p style={{ color: 'red' }}>Error loading session: {sessionError.message}</p>}
        {isAuthenticated && data?.session && (
          <div>
            <p>Welcome, {data.user.username || data.user.email}!</p>
            <pre>{JSON.stringify(data.session, null, 2)}</pre>
          </div>
        )}
        {!isSessionLoading && !isAuthenticated && <p>You are not logged in.</p>}
      </div>

      {/* Auth Actions */}
      <div>
        <h2>Actions:</h2>
        {!isAuthenticated && (
          <>
            <button onClick={() => signUpEmail({ username, email, password })} disabled={isSigningUp}>
              {isSigningUp ? 'Signing Up...' : 'Sign Up Email'}
            </button>
            <button onClick={() => signInEmail({ email, password })} disabled={isSigningIn}>
              {isSigningIn ? 'Signing In...' : 'Sign In Email'}
            </button>
            <button onClick={() => signInSocial('github')}>
              Sign In with GitHub
            </button>
          </>
        )}
        {isAuthenticated && (
          <button onClick={() => signOut()} disabled={isSigningOut}>
            {isSigningOut ? 'Signing Out...' : 'Sign Out'}
          </button>
        )}
      </div>

      {/* Protected Action Example */}
      <div>
        <h2>Protected Data:</h2>
        {isAuthenticated && (
          <button onClick={handleFetchPersons}>Fetch Persons (Protected)</button>
        )}
        {!isAuthenticated && (
          <>
            <p>Log in to fetch persons data.</p>
            <button onClick={handleFetchPersons}>Fetch Persons anyway (Protected)</button>

          </>
        )}
      </div>

    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
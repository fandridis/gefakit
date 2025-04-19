// App.tsx (or wherever AppContent is)
import { useEffect, useState } from 'react'; // Removed useEffect unless needed for other things
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './App.css';
// Import your new hooks
import { TodoView } from './features/todos/components/todo-view';
import { useAuth } from './features/auth/hooks/useAuth';
import { OrganizationView } from './features/organizations/components/organization-view';

const queryClient = new QueryClient();

function AppContent() {
  const [count, setCount] = useState(0); // Keep local UI state if needed

  // Get auth action functions and states
  const {
    signInEmail,
    signUpEmail,
    signOut,
    signInSocial,
    verifyEmail,
    isVerifyingEmail,
    verifyEmailError,
    isSigningIn,
    isSigningUp,
    isSigningOut,
    session,
    isLoadingSession,
    sessionError,
    isAuthenticated,
  } = useAuth();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      console.log('Token found: ', token);
      verifyEmail({ token });
    }
  }, []);

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
  const email = 'fandridis@gmail.com';
  const password = '1q2w3e4rgefakit';
  const username = 'Gefa';

  return (
    <>
      <h1>Auth Actions & Session State</h1>

      {/* Display Session Info */}
      <div>
        <h2>Session Status:</h2>
        {isLoadingSession && <p>Loading session...</p>}
        {sessionError && <p style={{ color: 'red' }}>Error loading session: {sessionError.message}</p>}
        {isAuthenticated && session && (
          <div>
            <p>Welcome, {session.user.username || session.user.email}!</p>
            <pre>{JSON.stringify(session, null, 2)}</pre>
          </div>
        )}
        {!isLoadingSession && !isAuthenticated && <p>You are not logged in.</p>}
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

      <div className='mt-8'>
        {isAuthenticated && <TodoView />}
      </div>

      {/* Organization Section */}
      <div className='mt-8'>
        {isAuthenticated && <OrganizationView />}
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
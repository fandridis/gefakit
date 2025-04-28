import * as React from 'react'
import { useAuth } from './use-auth'

// Define the type for the object returned by useAuth
type UseAuthReturnType = ReturnType<typeof useAuth>;

// Update AuthContext to match the full return type of useAuth
export interface AuthContext extends UseAuthReturnType { }
// export interface AuthContext {
//   // Use properties from the actual useAuth hook
//   isAuthenticated: UseAuthReturnType['isAuthenticated'];
//   isLoadingSession: UseAuthReturnType['isLoadingSession'];
//   session: UseAuthReturnType['session']; // Add session data if needed
//   // Add other methods/properties from useAuth as needed by consumers
//   signOut: UseAuthReturnType['signOut'];
//   // ... other properties like signInEmail, signUpEmail etc.
// }

const AuthContext = React.createContext<AuthContext | null>(null)

// Removed local storage key and functions: key, getStoredUser, setStoredUser

// Update AuthProvider props to accept the auth object
export function AuthProvider({ children, auth }: { children: React.ReactNode; auth: UseAuthReturnType }) {
  // Removed internal state, derived state, internal hook call, and console logs
  // Removed local login/logout functions and related useEffect

  // Provide the entire passed-in auth object to the context
  return (
    <AuthContext.Provider value={auth}>
      {/* Use isLoadingSession from the passed-in auth object */}
      {auth.isLoadingSession ? 'Loading...' : children}
    </AuthContext.Provider>
  )
}

export function useRouterAuth() {
  const context = React.useContext(AuthContext)
  if (!context) {
    throw new Error('useRouterAuth must be used within an AuthProvider')
  }
  return context
}
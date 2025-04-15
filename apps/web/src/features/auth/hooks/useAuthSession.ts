// /features/auth/hooks/useSession.ts
import { useQuery } from '@tanstack/react-query';
import { apiGetSession } from '../api';

// Define a query key for the session data
export const sessionQueryKey = ['gefakit-session'] as const; // Use 'as const' for type safety

export function useAuthSession() {
  const { data, isLoading, isFetching, error, refetch, isError } = useQuery({
    queryKey: sessionQueryKey,
    queryFn: apiGetSession,
    // Common options for session queries:
    staleTime: 5 * 60 * 1000, // 5 minutes - How long data is considered fresh
    gcTime: 15 * 60 * 1000, // 15 minutes - How long data stays in cache after unused
    retry: 1, // Don't retry endlessly on auth errors
    refetchOnWindowFocus: true, // Refetch when user comes back to the tab
    refetchInterval: false, // No automatic polling unless needed
  });

  return {
    data: data, // Will be user data object or null
    isLoading: isLoading, // Initial load
    isFetching: isFetching, // Loading on background refetch
    error,
    isError,
    refetchSession: refetch, // Expose refetch function if manual refresh is needed
    isAuthenticated: !!data, // Simple boolean check if session data exists
  };
}
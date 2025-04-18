import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGetSession, apiSignInEmail, apiSignUpEmail, apiSignOut } from '../api';
import { SignInEmailRequestBodyDTO, SignUpEmailRequestBodyDTO } from '@gefakit/shared/src/types/auth';

// Define a query key for the session data
export const sessionQueryKey = ['gefakit-session'] as const; // Use 'as const' for type safety

export function useAuth() {
    const queryClient = useQueryClient();

    // --- Session Query (from useAuthSession) ---
    const {
        data: sessionData,
        isLoading: isLoadingSession,
        isFetching: isFetchingSession,
        error: sessionError,
        refetch: refetchSession,
        isError: isSessionError
    } = useQuery({
        queryKey: sessionQueryKey,
        queryFn: apiGetSession,
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 15 * 60 * 1000, // 15 minutes
        retry: 1,
        refetchOnWindowFocus: true,
        refetchInterval: false,
    });

    // --- Auth Actions (from useAuthActions) ---

    // Function to invalidate the session query cache
    const invalidateSession = () => {
        console.log('Invalidating session query:', sessionQueryKey);
        queryClient.invalidateQueries({ queryKey: sessionQueryKey });
    };

    // Sign In Email Mutation
    const {
        mutate: signInEmail,
        isPending: isSigningIn,
        error: signInError
    } = useMutation<unknown, Error, SignInEmailRequestBodyDTO>({
        mutationFn: apiSignInEmail,
        onSuccess: (data, variables, context) => {
            console.log('Sign in success:', { data, variables, context });
            invalidateSession(); // Refresh session state after sign-in
        },
        onError: (error, variables, context) => {
            console.error('Sign in error:', { error, variables, context });
        },
    });

    // Sign Up Email Mutation
    const {
        mutate: signUpEmail,
        isPending: isSigningUp,
        error: signUpError
    } = useMutation<unknown, Error, SignUpEmailRequestBodyDTO>({
        mutationFn: apiSignUpEmail,
        onSuccess: (data, variables, context) => {
            console.log('Sign up success:', { data, variables, context });
            // Currently assuming sign-up doesn't automatically log in
            // invalidateSession();
        },
        onError: (error, variables, context) => {
            console.error('Sign up error:', { error, variables, context });
        },
    });

    // Sign Out Mutation
    const {
        mutate: signOut,
        isPending: isSigningOut,
        error: signOutError
     } = useMutation({
        mutationFn: apiSignOut,
        onSettled: (data, error, variables, context) => {
            console.log('Sign out settled:', { data, error, variables, context });
            if (error) {
                console.error("Sign out API call failed, but invalidating session anyway.", error);
            }
            invalidateSession(); // Refresh session state after sign-out attempt
        }
    });

    // Social Sign In
    const signInSocial = async (provider: 'github' /* | other providers */) => {
        console.log(`Initiating social sign in with ${provider}`);
        // Adjust the URL to your backend endpoint
        window.location.href = `http://localhost:8787/api/v1/auth/social/${provider}/redirect`;
    };

    // --- Combined Return Object ---
    return {
        // Session state and methods
        session: sessionData,
        isLoadingSession,
        isFetchingSession,
        sessionError,
        isSessionError,
        refetchSession,
        isAuthenticated: !!sessionData,

        // Auth actions
        signInEmail,
        signUpEmail,
        signOut,
        signInSocial,

        // Action states
        isSigningIn,
        isSigningUp,
        isSigningOut,

        // Action errors
        signInError,
        signUpError,
        signOutError,
    };
} 
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGetSession, apiSignInEmail, apiSignUpEmail, apiSignOut, apiVerifyEmail } from '../api';
import { SignInEmailRequestBodyDTO, SignUpEmailRequestBodyDTO } from '@gefakit/shared/src/types/auth';
import { ApiError } from '@gefakit/shared';

declare module '@tanstack/react-query' {
    interface Register {
      defaultError: ApiError
    }
  }

// Define a query key for the session data - should the same as the sessionQueryKey in the backend
export const sessionQueryKey = ['gefakit-session'] as const;

export function useAuth() {
    const queryClient = useQueryClient();

    const {
        data: sessionData,
        isLoading: isLoadingSession,
        isFetching: isFetchingSession,
        isSuccess: isSessionSuccess,
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

    // Function to invalidate the session query cache
    const invalidateSession = () => {
        queryClient.invalidateQueries({ queryKey: sessionQueryKey });
    };

    // Verify Email Mutation
    const {
        mutate: verifyEmail,
        isPending: isVerifyingEmail,
        error: verifyEmailError
    } = useMutation<unknown, Error, { token: string }>({
        mutationFn: ({ token }) => apiVerifyEmail(token),
        onSuccess: (data, variables, context) => {
            console.log('Email verification success:', { data, variables, context });
            invalidateSession(); // Refresh session state after verification
        },
        onError: (error, variables, context) => {
            console.error('Email verification error:', { error, variables, context });
        },
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
        isSessionSuccess,
        refetchSession,
        isAuthenticated: !!sessionData,

        // Auth actions
        signInSocial,
        verifyEmail,

        // Action states
        isVerifyingEmail,

        // Action errors
        verifyEmailError,
    };
}


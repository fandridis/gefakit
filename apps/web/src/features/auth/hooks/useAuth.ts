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

    // Sign In Email Mutation
    const {
        mutateAsync: signInEmail,
        // mutate: signInEmail,
        isPending: isSigningIn,
        error: signInError,
        
    } = useMutation<unknown, Error, SignInEmailRequestBodyDTO>({
        mutationFn: apiSignInEmail,
        onSuccess: (data, variables, context) => {
            console.log('Success @ signInEmail:', { data, variables, context });
            invalidateSession(); // Refresh session state after sign-in
        },
        onError: (error, variables, context) => {
            console.error('Error @ signInEmail:', { error, variables, context });
        },
    });

    // Sign Up Email Mutation
    const {
        mutate: signUpEmail,
        isPending: isSigningUp,
        error: signUpError
    } = useMutation<
        { data: unknown },
        Error,
        SignUpEmailRequestBodyDTO
    >({
        mutationFn: apiSignUpEmail,
        onSuccess: (response, variables, context) => {
            const data = response.data;
            console.log('Success @ signUpEmail:', { data, variables, context });
            // Currently assuming sign-up doesn't automatically log in
            // If sign-up *should* log the user in, we might need to invalidate session here
            // queryClient.invalidateQueries({ queryKey: queryKeys.session });
        },
        onError: (error, variables, context) => {
            console.log('error @ signUpEmail', error, variables, context);
        },
    });

    // Sign Out Mutation
    const {
        //mutate: signOut,
        mutateAsync: signOut,
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
        signInEmail,
        signUpEmail,
        signOut,
        signInSocial,
        verifyEmail,

        // Action states
        isSigningIn,
        isSigningUp,
        isSigningOut,
        isVerifyingEmail,

        // Action errors
        signInError,
        signUpError,
        signOutError,
        verifyEmailError,
    };
} 

// infer type of return value of useAuth
// export type UseAuthReturn = ReturnType<typeof useAuth>;


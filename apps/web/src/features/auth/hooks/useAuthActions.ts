// /features/auth/hooks/useAuthActions.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiSignInEmail, apiSignUpEmail, apiSignOut } from '../api';
import { sessionQueryKey } from './useAuthSession';

export function useAuthActions() {
  const queryClient = useQueryClient();

  // Function to invalidate the session query cache
  const invalidateSession = () => {
    console.log('Invalidating session query:', sessionQueryKey);
    queryClient.invalidateQueries({ queryKey: sessionQueryKey });
  };

  const signInEmailMutation = useMutation({
    mutationFn: apiSignInEmail,
    onSuccess: (data, variables, context) => {
      console.log('Sign in success:', { data, variables, context });
      invalidateSession(); // Refresh session state after sign-in
    },
    onError: (error, variables, context) => {
      console.error('Sign in error:', { error, variables, context });
    },
  });

  const signUpEmailMutation = useMutation({
    mutationFn: apiSignUpEmail,
    onSuccess: (data, variables, context) => {
      console.log('Sign up success:', { data, variables, context });
      // Decide if sign-up should automatically log the user in.
      // If yes, invalidate the session. If no, maybe prompt to log in.
      // Assuming sign-up *doesn't* log in automatically here.
      // invalidateSession();
    },
    onError: (error, variables, context) => {
      console.error('Sign up error:', { error, variables, context });
    },
  });

  const signOutMutation = useMutation({
    mutationFn: apiSignOut,
    // Use onSettled to ensure invalidation happens even if the sign-out API call
    // itself fails (e.g., network error), as the user intent is to be signed out.
    onSettled: (data, error, variables, context) => {
       console.log('Sign out settled:', { data, error, variables, context });
       if (error) {
         console.error("Sign out API call failed, but invalidating session anyway.", error);
       }
       invalidateSession(); // Refresh session state after sign-out attempt
    }
    // Alternatively, use onSuccess if you only want to invalidate on a successful API response:
    // onSuccess: (data, variables, context) => {
    //   console.log('Sign out success:', { data, variables, context });
    //   invalidateSession();
    // },
    // onError: (error, variables, context) => {
    //   console.error('Sign out error:', { error, variables, context });
    //   // Still might want to invalidate or clear session data locally on error
    //   invalidateSession();
    // }
  });

  // Handle social sign-in (still needs specific implementation)
  // This likely involves window redirects or popups, not a standard mutation.
  // Invalidation would happen when the user returns to the app after social auth.
  const signInSocial = async (provider: 'github' /* | other providers */) => {
    console.log(`Initiating social sign in with ${provider}`);
    // Construct the correct URL for your backend social auth initiation
    // Example: GET /api/v1/auth/social/github/redirect
    // This backend endpoint would handle the redirect to GitHub.
    // After GitHub redirects back to your app (callback URL),
    // your backend handles the code exchange, creates a session,
    // and then redirects the user back to the frontend.
    // The useSession hook should then pick up the new session on load.
    window.location.href = `http://localhost:8787/api/v1/auth/social/${provider}/redirect`; // Adjust URL/method as needed
  };

  return {
    signInEmail: signInEmailMutation.mutate,
    signUpEmail: signUpEmailMutation.mutate,
    signOut: signOutMutation.mutate,
    signInSocial,

    isSigningIn: signInEmailMutation.isPending,
    isSigningUp: signUpEmailMutation.isPending,
    isSigningOut: signOutMutation.isPending,

    signInError: signInEmailMutation.error,
    signUpError: signUpEmailMutation.error,
    signOutError: signOutMutation.error,
  };
}
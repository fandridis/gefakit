import { SessionDTO, SignUpEmailRequestBodyDTO, UserDTO } from "@gefakit/shared";

const API_BASE_URL = 'http://localhost:8787/api/v1/auth';

export const apiGetSession = async (): Promise<{ session: SessionDTO; user: UserDTO } | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/session`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      credentials: 'include', 
    });

    //  Handle explicit "No Session Cookie" case
    if (response.status === 401) {
      return null;
    }

    // Handle other non-successful responses (like 500 Internal Server Error)
    if (!response.ok) {
      // Throwing here allows useQuery to catch it and set its error state
      throw new Error(`Failed to fetch session: Server responded with ${response.status}`);
    }

    // Handle successful response (200 OK)
    const data = await response.json();

    // If user and session are present and not null, we are authenticated.
    if (data && data.user && data.session) {
      // console.log('Session check: Valid session found.');
      return data as { session: SessionDTO; user: UserDTO };
    } else {
      return null; // Treat as not authenticated
    }

  } catch (error) {
    // Handles network errors or the error thrown from !response.ok
    console.error("Error during apiGetSession fetch:", error);
    // Re-throw the error. useQuery will catch this and set its state accordingly (isError, error)
    // This is generally better than returning null for network/server errors,
    // as it differentiates between "logged out" and "system unavailable".
    throw error;
  }
};

export const apiSignInEmail = async ({ email, password }: { email: string, password: string }) => {
  const response = await fetch(`${API_BASE_URL}/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'include',
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to sign in' }));
    throw new Error(errorData.message || 'Sign in failed');
  }
  return response.json();
};

export const apiSignUpEmail = async ({ username, email, password }: SignUpEmailRequestBodyDTO) => {
  const response = await fetch(`${API_BASE_URL}/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to sign up' }));
    throw new Error(errorData.message || 'Sign up failed');
  }

  return response.json();
};

export const apiSignOut = async () => {
  const response = await fetch(`${API_BASE_URL}/sign-out`, {
    method: 'POST',
    credentials: 'include',
  });
   if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to sign out' }));
    throw new Error(errorData.message || 'Sign out failed');
  }
  return response.json();
};

export const apiVerifyEmail = async (token: string) => {
  // Use GET and pass token as query parameter
  const response = await fetch(`${API_BASE_URL}/verify-email?token=${encodeURIComponent(token)}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json', // Still expect JSON back
    },
    // Removed 'credentials' and 'body'
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to verify email' }));
    throw new Error(errorData.message || 'Email verification failed');
  }

  return response.json(); // Assuming backend returns some data, maybe updated user info
};

import axios from 'redaxios';
import { SessionDTO, SignUpEmailRequestBodyDTO, UserDTO, GetSessionResponseDTO } from "@gefakit/shared";
import { handleSimpleError } from '@/utils/api-error';

const API_BASE_URL = 'http://localhost:8787/api/v1/auth';

// Type guard to check if an object conforms to the AppErrorResponse interface
// isAppError has been moved to utils/api.ts

export const apiGetSession = async (): Promise<GetSessionResponseDTO | null> => {
  try {
    const response = await axios.get<GetSessionResponseDTO>(`${API_BASE_URL}/session`, {
      headers: {
        'Accept': 'application/json',
      },
      withCredentials: true,
    });

    // Axios considers 2xx successful, check data directly
    const data = response.data;
    // console.log('Session check:', data); // Keep for debugging if needed

    // If user and session are present and not null, we are authenticated.
    if (data && data.user && data.session) {
      return data;
    } else {
      // Should not happen with successful 2xx unless backend sends incomplete data
      console.warn('apiGetSession: Received successful response but data is incomplete.', data);
      return null;
    }
  } catch (error: any) {
     // Handle explicit "No Session Cookie" case (401 Unauthorized)
    if (error.response && error.response.status === 401) {
      // console.log('Session check: No valid session found (401).'); // Keep for debugging if needed
      return null; // Treat as not authenticated
    }

    // For all other errors, use the standard handler (which throws)
    handleSimpleError(error);
    // Because handleSimpleError always throws, we need a fallback return for type safety, although it's unreachable.
    // Alternatively, handleSimpleError could return the error to be thrown here, but its current implementation throws directly.
    return null; // Or throw new Error("Fell through handleSimpleError?"); This line should technically be unreachable.
  }
};

// Returns the Axios promise directly. Error handling delegated to the caller (e.g., React Query's onError).
export const apiSignInEmail = async ({ email, password }: { email: string, password: string }) => {
  await new Promise(resolve => setTimeout(resolve, 1000)); // Keep or remove delay as needed
  return axios.post(`${API_BASE_URL}/sign-in/email`,
    { email, password },
    { withCredentials: true }
  ).catch(handleSimpleError);
};

// Returns the Axios promise directly. Error handling delegated to the caller.
export const apiSignUpEmail = async ({ username, email, password }: SignUpEmailRequestBodyDTO) => {
    return axios.post(`${API_BASE_URL}/sign-up/email`,
      { username, email, password }
    ).catch(handleSimpleError);
};

// Returns the Axios promise directly. Error handling delegated to the caller.
export const apiSignOut = async () => {
  return axios.post(`${API_BASE_URL}/sign-out`,
    null, // No request body needed for sign-out
    {
      withCredentials: true,
    }
  ).catch(handleSimpleError);
};

// Returns the Axios promise directly. Error handling delegated to the caller.
export const apiVerifyEmail = async (token: string) => {
  return axios.get(`${API_BASE_URL}/verify-email`, {
    params: { token },
    headers: {
      'Accept': 'application/json',
    },
  }).catch(handleSimpleError);
};

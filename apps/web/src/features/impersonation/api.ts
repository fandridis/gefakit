// Define simple interfaces for the expected API responses
interface ImpersonationResponse {
  ok: boolean;
  message: string;
}

const API_ADMIN_BASE_URL = import.meta.env.VITE_API_URL + '/api/v1/admin';

/**
 * Starts impersonating a target user.
 * Requires admin privileges.
 * @param targetUserId - The ID of the user to impersonate.
 */
export const apiStartImpersonation = async (targetUserId: number): Promise<ImpersonationResponse> => {
  try {
    const response = await fetch(`${API_ADMIN_BASE_URL}/impersonate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId }),
      credentials: 'include', // Send cookies along with the request
    });

    const data: ImpersonationResponse = await response.json();

    if (!response.ok) {
      // Use the message from the server response if available, otherwise provide a default
      throw new Error(data.message || `Failed to start impersonation: Server responded with ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error("Error during apiStartImpersonation fetch:", error);
    // Rethrow the error after logging, ensuring it's an Error object
    throw error instanceof Error ? error : new Error(String(error));
  }
};

/**
 * Stops the current impersonation session.
 */
export const apiStopImpersonation = async (): Promise<ImpersonationResponse> => {
  try {
    const response = await fetch(`${API_ADMIN_BASE_URL}/stop-impersonation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, // Even if no body, specify content type for consistency
      credentials: 'include', // Send cookies along with the request
    });

    const data: ImpersonationResponse = await response.json();

    if (!response.ok) {
      // Use the message from the server response if available, otherwise provide a default
      throw new Error(data.message || `Failed to stop impersonation: Server responded with ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error("Error during apiStopImpersonation fetch:", error);
    // Rethrow the error after logging, ensuring it's an Error object
    throw error instanceof Error ? error : new Error(String(error));
  }
}; 
import { ApiError } from "@gefakit/shared";

// Type guard to check if an object conforms to the AppErrorResponse interface
export const isAppError = (error: unknown): error is ApiError => {
  return (
    typeof error === 'object' && error !== null 
    && typeof (error as ApiError).message === 'string' 
    && typeof (error as ApiError).name === 'string' 
    && (error as ApiError).name === 'ApiError' 
    && typeof (error as ApiError).details === 'object'
    && (error as ApiError).details !== null 
    && typeof (error as ApiError).details.code === 'string'
  );
};

/**
 * Processes errors from API calls, prioritizing specific ApiError structures.
 * Throws a standardized Error object for use in mutation hooks or other error handlers.
 * @param error The error caught from an API call (typically Axios related).
 * @throws {Error} An error with a user-friendly message.
 */
export const handleSimpleError = (error: any) => {
    let message = 'An unknown error occurred.'; // Default message

    console.log('[handleApiError] error', error)

    if (error.data?.name === 'ApiError') {
        message = error.data.message;
    } else if (error.message) {
        message = error.message;
    } else {
        message = 'An unknown error occurred.';
    }

    // Log the original error for debugging purposes
    // console.error("API Error Handled:", { originalError: error, message });

    throw new Error(message);
};

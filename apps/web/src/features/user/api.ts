import axios from 'redaxios';
import { z } from 'zod';
import { updateUserRequestBodySchema } from '@gefakit/shared/src/schemas/user.schema';
import { UpdateUserResponseDTO } from '@gefakit/shared/src/types/user';
import { handleSimpleError } from '@/utils/api-error';

// Adjust the base URL to point to the user-related endpoints
const API_BASE_URL = import.meta.env.VITE_API_URL + '/api/v1/users'; // Changed from /auth

// Define the type for the request body based on the schema
type UpdateUserRequestBody = z.infer<typeof updateUserRequestBodySchema>;

// Update User API Call
export const apiUpdateUser = async (data: UpdateUserRequestBody) => {
  const response = await axios.patch<UpdateUserResponseDTO>(`${API_BASE_URL}/me`, data, {
    withCredentials: true,
  }).catch(handleSimpleError);
  return response.data; // Return the data part of the response
}; 
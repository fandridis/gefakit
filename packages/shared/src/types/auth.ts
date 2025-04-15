import { 
  userSchema,
  sessionSchema,
  getSessionResponseSchema,
  signInEmailRequestBodySchema,
  signUpEmailRequestBodySchema, 
  signUpEmailResponseSchema} from "../schemas/auth.schema";
import { z } from "zod";

export type UserDTO = z.infer<typeof userSchema>;
export type SessionDTO = z.infer<typeof sessionSchema>;

export type GetSessionResponseDTO = z.infer<typeof getSessionResponseSchema>;

export type SignInEmailRequestBodyDTO = z.infer<typeof signInEmailRequestBodySchema>;
export type SignInEmailResponseDTO = { user: UserDTO };

export type SignUpEmailRequestBodyDTO = z.infer<typeof signUpEmailRequestBodySchema>;
export type SignUpEmailResponseDTO = z.infer<typeof signUpEmailResponseSchema>;

export type SignOutResponseDTO = { message: string };
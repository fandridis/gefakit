import { 
  userSchema,
  sessionSchema,
  getSessionResponseSchema,
  signInEmailRequestBodySchema,
  signUpEmailRequestBodySchema, 
  signUpEmailResponseSchema,
  emailVerificationSchema,
  passwordResetTokenSchema,
  verifyOtpBodySchema,
  requestOtpBodySchema
} from "../schemas/auth.schema";
import { z } from "zod";

export type UserDTO = z.infer<typeof userSchema>;
export type SessionDTO = z.infer<typeof sessionSchema>;
export type EmailVerificationDTO = z.infer<typeof emailVerificationSchema>;
export type PasswordResetTokenDTO = z.infer<typeof passwordResetTokenSchema>;

export type GetSessionResponseDTO = z.infer<typeof getSessionResponseSchema>;

export type SignInEmailRequestBodyDTO = z.infer<typeof signInEmailRequestBodySchema>;
export type SignInEmailResponseDTO = { user: UserDTO };

export type SignUpEmailRequestBodyDTO = z.infer<typeof signUpEmailRequestBodySchema>;
export type SignUpEmailResponseDTO = z.infer<typeof signUpEmailResponseSchema>;

export type SignOutResponseDTO = { message: string };

export type RequestOtpBodyDTO = z.infer<typeof requestOtpBodySchema>;
export type VerifyOtpBodyDTO = z.infer<typeof verifyOtpBodySchema>;

export type SignInOtpResponseDTO = { user: UserDTO };

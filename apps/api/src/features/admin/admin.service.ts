// apps/api/src/features/admin/admin.service.ts
import { Kysely, Transaction } from 'kysely';
import { DB } from '../../db/db-types'; 
import { AuthRepository } from '../auth/auth.repository';
import { createAppError } from '../../core/app-error';
import { AppError } from '../../core/app-error'; // Assuming AppError is needed alongside createAppError

// Define the service type
export type AdminService = ReturnType<typeof createAdminService>;

// Define the factory function
export function createAdminService({
  db,
  authRepository,
  // Optional: Include factory if needed for transactions within this service
  // createAuthRepository
}: {
  db: Kysely<DB>;
  authRepository: AuthRepository;
  // createAuthRepository?: (args: { db: Kysely<DB> | Transaction<DB> }) => AuthRepository;
}) {

  async function startImpersonation(sessionId: string, adminUserId: number, targetUserId: number): Promise<void> {
    // 1. Validate targetUserId exists and is not an admin/support
    // Assuming findUserById exists on AuthRepository and returns a user object with a 'role' property
    // Note: You might need to adjust the user type or fetching logic based on your actual User model/repository
    const targetUser = await authRepository.findUserById(targetUserId);
    if (!targetUser) {
      // Use the centralized error creator
      throw createAppError.auth.userNotFound(); // Or a specific admin error
    }
    // Add role check - this assumes a 'role' property exists on the user object
    // if (targetUser.role === 'ADMIN' || targetUser.role === 'SUPPORT') { 
    //   throw new AppError('Cannot impersonate an administrator or support user', 403);
    // }

    // 2. Update the session record using the repository method
    const updated = await authRepository.updateSessionImpersonation({
        sessionId,
        userId: targetUserId, // Set the session's user_id to the target
        impersonatorUserId: adminUserId   // Set the impersonator_user_id
    });

    if (!updated) {
        // Use a more specific error if possible
       throw new AppError('Failed to update session for impersonation', 500);
       // Consider: throw createAppError.admin.impersonationFailed(); 
    }
  }

  async function stopImpersonation(sessionId: string, adminUserId: number): Promise<void> {
    // Update the session record back to the original admin user
     const updated = await authRepository.updateSessionImpersonation({
        sessionId,
        userId: adminUserId, // Set user_id back to the admin
        impersonatorUserId: null         // Clear the impersonator_user_id
    });

     if (!updated) {
        // Use a more specific error if possible
       throw new AppError('Failed to update session for stopping impersonation', 500);
       // Consider: throw createAppError.admin.stopImpersonationFailed();
     }
  }

  // Return the service methods
  return {
    startImpersonation,
    stopImpersonation,
  };
}

// Remove the example method definition previously here
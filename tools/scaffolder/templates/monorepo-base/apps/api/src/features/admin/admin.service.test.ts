import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAdminService, AdminService } from './admin.service';
import { AuthRepository, createAuthRepository } from '../auth/auth.repository'; // Import real type and factory
import { Kysely } from 'kysely';
import { DB } from '../../db/db-types';

// --- Mock Dependencies ---

// 1. Mock Repository Module (including factory)
vi.mock('../auth/auth.repository', () => ({
  createAuthRepository: vi.fn(),
}));

// 2. Mock Error Factory - Modified to include original AppError
vi.mock('../../core/app-error', async (importOriginal) => {
  const actual = await importOriginal() as typeof import('../../core/app-error');
  return {
    ...actual, // Include original exports like AppError
    createAppError: { // Mock only the factory object
      auth: {
        userNotFound: vi.fn(() => new actual.AppError('User not found mock', 404)),
        // Add other specific errors if used by admin service
      },
      // admin: { // Add admin-specific errors if created
      //   impersonationFailed: vi.fn(() => new actual.AppError('Impersonation failed mock', 500)),
      //   stopImpersonationFailed: vi.fn(() => new actual.AppError('Stop impersonation failed mock', 500)),
      // }
    },
  };
});

// 3. Import Mocked Functions/Modules AFTER mocks
import { createAuthRepository as mockCreateAuthRepositoryFn } from '../auth/auth.repository';
// Import AppError directly AFTER the mock setup
import { AppError, createAppError as mockErrors } from '../../core/app-error';
import { UserDTO } from '@gefakit/shared';

// +++ Add Mock DB
const mockDb = {
  // Mock methods used by service if any, e.g., transaction
  // transaction: vi.fn(() => ({ execute: vi.fn() }))
} as unknown as Kysely<DB>;

// --- Test Suite Setup ---

// Type for the *instance* methods returned by the (real or mocked) repository factory
type MockAuthRepositoryInstance = {
  findUserById: ReturnType<typeof vi.fn>;
  updateSessionImpersonation: ReturnType<typeof vi.fn>;
  // Add other methods if admin service uses them
};

describe('AdminService', () => {
  let adminService: AdminService;
  let mockRepoInstance: MockAuthRepositoryInstance;
  let mockRepoFactory: ReturnType<typeof vi.fn>;

  // Mock Data
  const mockSessionId = 'session-abc-123';
  const mockAdminUserId = 1;
  const mockTargetUserId = 2;
  // Cast mock user data to satisfy type checking at point of use
  const mockTargetUser = { 
      id: mockTargetUserId,
      email: 'target@example.com',
      username: 'targetuser',
      role: 'USER',
      // Add other required fields with dummy values if needed for casting
      password_hash: 'dummy', 
      email_verified: true,
      created_at: new Date(),
      recovery_code: null
  } as UserDTO;
  const mockAdminUser = { 
      id: mockAdminUserId,
      email: 'admin@example.com',
      username: 'adminuser',
      role: 'ADMIN', // Ensure admin role
      // Add other required fields with dummy values if needed for casting
      password_hash: 'dummy',
      email_verified: true,
      created_at: new Date(),
      recovery_code: null
  } as UserDTO;


  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock instance for repository methods
    mockRepoInstance = {
      findUserById: vi.fn(),
      updateSessionImpersonation: vi.fn(),
    };

    // Get the mocked factory function
    mockRepoFactory = vi.mocked(mockCreateAuthRepositoryFn);

    // Configure the factory mock (not strictly needed if passing instance directly)
    mockRepoFactory.mockReturnValue(mockRepoInstance as unknown as AuthRepository);

    // Create the service instance, directly passing the mocked instance
    // Assumes createAdminService takes an instance, adjust if it takes db/factory
    adminService = createAdminService({
        db: mockDb, // +++ Add mock DB
        authRepository: mockRepoInstance as unknown as AuthRepository,
        // createAuthRepository: mockRepoFactory // Pass factory if service uses it internally
    });
  });

  // --- Test startImpersonation ---
  describe('startImpersonation', () => {
    it('should find target user and update session impersonation', async () => {
      mockRepoInstance.findUserById.mockResolvedValue(mockTargetUser); // Already cast
      mockRepoInstance.updateSessionImpersonation.mockResolvedValue(true); // Simulate successful update

      await adminService.startImpersonation(mockSessionId, mockAdminUserId, mockTargetUserId);

      expect(mockRepoInstance.findUserById).toHaveBeenCalledWith(mockTargetUserId);
      expect(mockRepoInstance.updateSessionImpersonation).toHaveBeenCalledWith({
        sessionId: mockSessionId,
        userId: mockTargetUserId,
        impersonatorUserId: mockAdminUserId,
      });
      expect(mockErrors.auth.userNotFound).not.toHaveBeenCalled();
    });

    it('should throw userNotFound error if target user is not found', async () => {
      mockRepoInstance.findUserById.mockResolvedValue(null);

      await expect(adminService.startImpersonation(mockSessionId, mockAdminUserId, mockTargetUserId))
        .rejects.toThrow('User not found mock');

      expect(mockRepoInstance.findUserById).toHaveBeenCalledWith(mockTargetUserId);
      expect(mockRepoInstance.updateSessionImpersonation).not.toHaveBeenCalled();
      expect(mockErrors.auth.userNotFound).toHaveBeenCalledTimes(1);
    });

    // Optional: Add test for role check if implemented in the service
    // it('should throw error if target user is an admin/support', async () => {
    //    const mockTargetAdmin: AuthUser = { ...mockTargetUser, role: 'ADMIN' };
    //    mockRepoInstance.findUserById.mockResolvedValue(mockTargetAdmin);
    //
    //    await expect(adminService.startImpersonation(mockSessionId, mockAdminUserId, mockTargetUserId))
    //      .rejects.toThrow('Cannot impersonate an administrator or support user'); // Match exact error
    //
    //    expect(mockRepoInstance.findUserById).toHaveBeenCalledWith(mockTargetUserId);
    //    expect(mockRepoInstance.updateSessionImpersonation).not.toHaveBeenCalled();
    // });

    it('should throw error if updateSessionImpersonation fails', async () => {
      mockRepoInstance.findUserById.mockResolvedValue(mockTargetUser); // Already cast
      mockRepoInstance.updateSessionImpersonation.mockResolvedValue(false); // Simulate failed update

      await expect(adminService.startImpersonation(mockSessionId, mockAdminUserId, mockTargetUserId))
        .rejects.toThrow(AppError); // Expect generic AppError or specific one if defined

      expect(mockRepoInstance.findUserById).toHaveBeenCalledWith(mockTargetUserId);
      expect(mockRepoInstance.updateSessionImpersonation).toHaveBeenCalledWith({
        sessionId: mockSessionId,
        userId: mockTargetUserId,
        impersonatorUserId: mockAdminUserId,
      });
      // Optionally check if a specific impersonationFailed error was thrown if mocked
      // expect(mockErrors.admin.impersonationFailed).toHaveBeenCalledTimes(1);
    });
  });

  // --- Test stopImpersonation ---
  describe('stopImpersonation', () => {
    it('should update session impersonation to stop', async () => {
      mockRepoInstance.updateSessionImpersonation.mockResolvedValue(true); // Simulate successful update

      await adminService.stopImpersonation(mockSessionId, mockAdminUserId);

      expect(mockRepoInstance.updateSessionImpersonation).toHaveBeenCalledWith({
        sessionId: mockSessionId,
        userId: mockAdminUserId,
        impersonatorUserId: null,
      });
    });

    it('should throw error if updateSessionImpersonation fails', async () => {
      mockRepoInstance.updateSessionImpersonation.mockResolvedValue(false); // Simulate failed update

      await expect(adminService.stopImpersonation(mockSessionId, mockAdminUserId))
        .rejects.toThrow(AppError); // Expect generic AppError or specific one if defined

      expect(mockRepoInstance.updateSessionImpersonation).toHaveBeenCalledWith({
        sessionId: mockSessionId,
        userId: mockAdminUserId,
        impersonatorUserId: null,
      });
      // Optionally check if a specific stopImpersonationFailed error was thrown if mocked
      // expect(mockErrors.admin.stopImpersonationFailed).toHaveBeenCalledTimes(1);
    });
  });
}); 
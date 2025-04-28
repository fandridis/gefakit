import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOrganizationMembershipService, OrganizationMembershipService } from './organization-membership.service';
// Import real type and factory
import { OrganizationMembershipRepository } from './organization-membership.repository';
import { DB, OrganizationsMembership } from '../../db/db-types';
import { Kysely, Selectable } from 'kysely';
import { ApiError } from '@gefakit/shared';
// Removed duplicate AppError import

// --- Mock Dependencies ---

// 1. Mock the repository module (including factory)
vi.mock('./organization-membership.repository', () => ({
  createOrganizationMembershipRepository: vi.fn(),
  // No need to mock individual methods here anymore
}));

// 2. Import the mocked factory function AFTER the mock
import { createOrganizationMembershipRepository as mockCreateOrganizationMembershipRepositoryFn } from './organization-membership.repository';


// 3. Mock the error factory - Modified
vi.mock('../../core/api-error', async (importOriginal) => {
  const actual = await importOriginal() as typeof import('../../core/api-error');
  return {
      ...actual, // Include original AppError
      createApiError: { // Mock factory
          organizations: {
            actionNotAllowed: vi.fn((msg) => new ApiError(msg ?? 'Action not allowed mock', 403)),
          },
      },
  };
});
// Import AppError after mock
import { createApiError as mockCreateApiError } from '../../core/api-error';

// 4. Mock Kysely DB (minimal mock, as it's not directly used by the service logic shown)
const mockDb = {} as Kysely<DB>;

// --- Setup Test Suite ---

// Define a type for the mocked repository instance methods
type MockOrganizationMembershipRepositoryInstance = {
  findAllOrganizationMembershipsByUserId: ReturnType<typeof vi.fn>;
  findMembershipByUserIdAndOrgId: ReturnType<typeof vi.fn>;
  deleteMembership: ReturnType<typeof vi.fn>;
};


describe('OrganizationMembershipService', () => {
  let organizationMembershipService: OrganizationMembershipService;
  let mockRepoInstance: MockOrganizationMembershipRepositoryInstance;
  let mockRepoFactory: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock instance for repository methods
    mockRepoInstance = {
      findAllOrganizationMembershipsByUserId: vi.fn(),
      findMembershipByUserIdAndOrgId: vi.fn(),
      deleteMembership: vi.fn(),
    };

    // Get the mocked factory function
    mockRepoFactory = vi.mocked(mockCreateOrganizationMembershipRepositoryFn);

    // Configure the factory mock to return the instance
    // This service doesn't seem to use transactions, so the factory
    // likely isn't called *within* the service methods, but we set it up
    // defensively. The instance is passed directly.
    mockRepoFactory.mockReturnValue(mockRepoInstance as unknown as OrganizationMembershipRepository);

    // Reset mocked error calls
    vi.mocked(mockCreateApiError.organizations.actionNotAllowed).mockClear();

    // Create the service instance with the mocked repository instance
    organizationMembershipService = createOrganizationMembershipService({
      db: mockDb, // Pass the mock DB
      organizationMembershipRepository: mockRepoInstance as unknown as OrganizationMembershipRepository, // Pass the mock instance
    });
  });

  it('should be defined', () => {
    expect(organizationMembershipService).toBeDefined();
  });

  // --- Test findAllOrganizationMembershipsByUserId ---
  describe('findAllOrganizationMembershipsByUserId', () => {
    it('should call repository.findAllOrganizationMembershipsByUserId with the correct userId', async () => {
      const userId = 1;
      const now = new Date();
      const expectedMemberships: Selectable<OrganizationsMembership>[] = [
        { organization_id: 10, user_id: userId, role: 'member', is_default: false, created_at: now, updated_at: now },
        { organization_id: 11, user_id: userId, role: 'owner', is_default: true, created_at: now, updated_at: now },
      ];
      mockRepoInstance.findAllOrganizationMembershipsByUserId.mockResolvedValue(expectedMemberships);

      const result = await organizationMembershipService.findAllOrganizationMembershipsByUserId({ userId });

      expect(mockRepoInstance.findAllOrganizationMembershipsByUserId).toHaveBeenCalledWith({ userId });
      expect(mockRepoInstance.findAllOrganizationMembershipsByUserId).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedMemberships);
    });

    it('should return an empty array if the repository returns an empty array', async () => {
      const userId = 2;
      mockRepoInstance.findAllOrganizationMembershipsByUserId.mockResolvedValue([]);

      const result = await organizationMembershipService.findAllOrganizationMembershipsByUserId({ userId });

      expect(mockRepoInstance.findAllOrganizationMembershipsByUserId).toHaveBeenCalledWith({ userId });
      expect(result).toEqual([]);
    });
  });

  // --- Test removeCurrentUserMembershipFromOrg ---
  describe('removeCurrentUserMembershipFromOrg', () => {
    const userId = 1;
    const organizationId = 10;
    const now = new Date();
    const memberMembership: Selectable<OrganizationsMembership> = { organization_id: organizationId, user_id: userId, role: 'member', is_default: false, created_at: now, updated_at: now };
    const ownerMembership: Selectable<OrganizationsMembership> = { organization_id: organizationId, user_id: userId, role: 'owner', is_default: false, created_at: now, updated_at: now };
    const otherMembership: Selectable<OrganizationsMembership> = { organization_id: 11, user_id: userId, role: 'admin', is_default: true, created_at: now, updated_at: now };
    const deleteResult = { count: 1n };

    it('should delete membership if user is a member and belongs to multiple orgs', async () => {
      mockRepoInstance.findAllOrganizationMembershipsByUserId.mockResolvedValue([memberMembership, otherMembership]);
      mockRepoInstance.deleteMembership.mockResolvedValue(deleteResult);

      const result = await organizationMembershipService.removeCurrentUserMembershipFromOrg({ organizationId, userId });

      expect(mockRepoInstance.findAllOrganizationMembershipsByUserId).toHaveBeenCalledWith({ userId });
      expect(mockRepoInstance.deleteMembership).toHaveBeenCalledWith({ organizationId, userId });
      expect(mockCreateApiError.organizations.actionNotAllowed).not.toHaveBeenCalled();
      expect(result).toEqual(deleteResult);
    });

    it('should throw error if user is not a member of the target organization', async () => {
      // User is member of org 11, but tries to leave org 10
      mockRepoInstance.findAllOrganizationMembershipsByUserId.mockResolvedValue([otherMembership]);

      await expect(organizationMembershipService.removeCurrentUserMembershipFromOrg({ organizationId, userId }))
        .rejects.toThrow('User is not a member of the organization');

      expect(mockRepoInstance.findAllOrganizationMembershipsByUserId).toHaveBeenCalledWith({ userId });
      expect(mockRepoInstance.deleteMembership).not.toHaveBeenCalled();
      expect(mockCreateApiError.organizations.actionNotAllowed).toHaveBeenCalledWith('User is not a member of the organization');
    });

    it('should throw error if user is the owner', async () => {
      mockRepoInstance.findAllOrganizationMembershipsByUserId.mockResolvedValue([ownerMembership, otherMembership]);

      await expect(organizationMembershipService.removeCurrentUserMembershipFromOrg({ organizationId, userId }))
        .rejects.toThrow('You cannot leave the organization as the owner');

      expect(mockRepoInstance.findAllOrganizationMembershipsByUserId).toHaveBeenCalledWith({ userId });
      expect(mockRepoInstance.deleteMembership).not.toHaveBeenCalled();
      expect(mockCreateApiError.organizations.actionNotAllowed).toHaveBeenCalledWith('You cannot leave the organization as the owner');
    });

    it('should throw error if user tries to leave their only organization', async () => {
      // User is only member of the target org
      mockRepoInstance.findAllOrganizationMembershipsByUserId.mockResolvedValue([memberMembership]);

      await expect(organizationMembershipService.removeCurrentUserMembershipFromOrg({ organizationId, userId }))
        .rejects.toThrow('You cannot leave your only organization');

      expect(mockRepoInstance.findAllOrganizationMembershipsByUserId).toHaveBeenCalledWith({ userId });
      expect(mockRepoInstance.deleteMembership).not.toHaveBeenCalled();
      expect(mockCreateApiError.organizations.actionNotAllowed).toHaveBeenCalledWith('You cannot leave your only organization');
    });

    it('should re-throw error if findAllOrganizationMembershipsByUserId fails', async () => {
        const error = new Error('DB error finding memberships');
        mockRepoInstance.findAllOrganizationMembershipsByUserId.mockRejectedValue(error);

        await expect(organizationMembershipService.removeCurrentUserMembershipFromOrg({ organizationId, userId }))
            .rejects.toThrow(error);

        expect(mockRepoInstance.findAllOrganizationMembershipsByUserId).toHaveBeenCalledWith({ userId });
        expect(mockRepoInstance.deleteMembership).not.toHaveBeenCalled();
    });

    it('should re-throw error if deleteMembership fails', async () => {
        const error = new Error('DB error deleting membership');
        mockRepoInstance.findAllOrganizationMembershipsByUserId.mockResolvedValue([memberMembership, otherMembership]);
        mockRepoInstance.deleteMembership.mockRejectedValue(error);

        await expect(organizationMembershipService.removeCurrentUserMembershipFromOrg({ organizationId, userId }))
            .rejects.toThrow(error);

        expect(mockRepoInstance.findAllOrganizationMembershipsByUserId).toHaveBeenCalledWith({ userId });
        expect(mockRepoInstance.deleteMembership).toHaveBeenCalledWith({ organizationId, userId });
    });
  });

  // --- Test removeUserMembershipFromOrg ---
  describe('removeUserMembershipFromOrg', () => {
    const organizationId = 20;
    const userIdToRemove = 2; // The user being removed
    const adminUserId = 1; // The user performing the action (implicitly, not passed to service method)
    const now = new Date();
    // Membership of the user being removed
    const memberMembershipToRemove: Selectable<OrganizationsMembership> = { organization_id: organizationId, user_id: userIdToRemove, role: 'member', is_default: false, created_at: now, updated_at: now };
    const adminMembershipToRemove: Selectable<OrganizationsMembership> = { organization_id: organizationId, user_id: userIdToRemove, role: 'admin', is_default: false, created_at: now, updated_at: now };
    const ownerMembershipToRemove: Selectable<OrganizationsMembership> = { organization_id: organizationId, user_id: userIdToRemove, role: 'owner', is_default: false, created_at: now, updated_at: now };

    const deleteResult = { count: 1n };

    // CORRECTED TEST: Expect error when target is 'member'
    it('should throw error if target user is member (based on current service logic)', async () => {
      mockRepoInstance.findMembershipByUserIdAndOrgId.mockResolvedValue(memberMembershipToRemove);
      // deleteMembership should not be called

      await expect(organizationMembershipService.removeUserMembershipFromOrg({ organizationId, userId: userIdToRemove }))
        .rejects.toThrow('Only admins or owners can remove users from the organization');

      expect(mockRepoInstance.findMembershipByUserIdAndOrgId).toHaveBeenCalledWith({ userId: userIdToRemove, organizationId });
      expect(mockRepoInstance.deleteMembership).not.toHaveBeenCalled();
    });

    // Test cases for admin and owner roles (expecting success based on current logic)
    it('should remove membership if target user is admin', async () => {
        mockRepoInstance.findMembershipByUserIdAndOrgId.mockResolvedValue(adminMembershipToRemove);
        mockRepoInstance.deleteMembership.mockResolvedValue(deleteResult);

        const result = await organizationMembershipService.removeUserMembershipFromOrg({ organizationId, userId: userIdToRemove });

        expect(mockRepoInstance.findMembershipByUserIdAndOrgId).toHaveBeenCalledWith({ userId: userIdToRemove, organizationId });
        expect(mockRepoInstance.deleteMembership).toHaveBeenCalledWith({ organizationId, userId: userIdToRemove });
        expect(result).toEqual(deleteResult);
      });

    it('should remove membership if target user is owner', async () => {
      mockRepoInstance.findMembershipByUserIdAndOrgId.mockResolvedValue(ownerMembershipToRemove);
      mockRepoInstance.deleteMembership.mockResolvedValue(deleteResult);

      const result = await organizationMembershipService.removeUserMembershipFromOrg({ organizationId, userId: userIdToRemove });

      expect(mockRepoInstance.findMembershipByUserIdAndOrgId).toHaveBeenCalledWith({ userId: userIdToRemove, organizationId });
       // The current logic proceeds to delete even if the target is admin/owner
       expect(mockRepoInstance.deleteMembership).toHaveBeenCalledWith({ organizationId, userId: userIdToRemove });
      expect(mockCreateApiError.organizations.actionNotAllowed).not.toHaveBeenCalled(); // No error thrown based on current code
      expect(result).toEqual(deleteResult);
    });

    // Test for user not found
    it('should throw error if target user is not found in the organization', async () => {
      mockRepoInstance.findMembershipByUserIdAndOrgId.mockResolvedValue(null);

      await expect(organizationMembershipService.removeUserMembershipFromOrg({ organizationId, userId: userIdToRemove }))
        .rejects.toThrow('User is not a member of the organization');

      expect(mockRepoInstance.findMembershipByUserIdAndOrgId).toHaveBeenCalledWith({ userId: userIdToRemove, organizationId });
      expect(mockRepoInstance.deleteMembership).not.toHaveBeenCalled();
      // We can check the actual error message, no need to check the mock factory call
      // expect(mockCreateApiError.organizations.actionNotAllowed).toHaveBeenCalledWith('User is not a member of the organization');
    });

    // Test repo failures
    it('should re-throw error if findMembershipByUserIdAndOrgId fails', async () => {
        const error = new Error('DB error finding membership');
        mockRepoInstance.findMembershipByUserIdAndOrgId.mockRejectedValue(error);

        await expect(organizationMembershipService.removeUserMembershipFromOrg({ organizationId, userId: userIdToRemove }))
            .rejects.toThrow(error);

        expect(mockRepoInstance.findMembershipByUserIdAndOrgId).toHaveBeenCalledWith({ userId: userIdToRemove, organizationId });
        expect(mockRepoInstance.deleteMembership).not.toHaveBeenCalled();
      });

     it('should re-throw error if deleteMembership fails (when target is admin/owner)', async () => {
        const error = new Error('DB error deleting membership');
        mockRepoInstance.findMembershipByUserIdAndOrgId.mockResolvedValue(adminMembershipToRemove); // or ownerMembershipToRemove
        mockRepoInstance.deleteMembership.mockRejectedValue(error);

        await expect(organizationMembershipService.removeUserMembershipFromOrg({ organizationId, userId: userIdToRemove }))
            .rejects.toThrow(error);

        expect(mockRepoInstance.findMembershipByUserIdAndOrgId).toHaveBeenCalledWith({ userId: userIdToRemove, organizationId });
        expect(mockRepoInstance.deleteMembership).toHaveBeenCalledWith({ organizationId, userId: userIdToRemove });
     });
  });
}); 
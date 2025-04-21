import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOrganizationService, OrganizationService } from './organization.service';
import { OrganizationRepository } from './organization.repository'; // Real repository type
import { createAppError } from '../../errors';
import { DB, OrganizationsOrganization, OrganizationsMembership, OrganizationsInvitation } from '../../db/db-types';
import { Insertable, Selectable, Kysely, Transaction } from 'kysely';
import { randomUUID } from 'node:crypto';

// --- Mock Dependencies ---

// Import the function/type to be mocked
import { createOrganizationRepository } from './organization.repository';

// 1. Mock the repository module
vi.mock('./organization.repository', () => ({
  // Mock the factory function export
  createOrganizationRepository: vi.fn(), 
}));

// 2. Mock the Kysely DB dependency and transactions
const mockTrx = {
  // We don't need a complex mock transaction object itself usually.
  // We just need to ensure the factory returns the right mock repo when called with it.
} as unknown as Transaction<DB>; // Use a simple type assertion

const mockDb = {
  // Mock the transaction() method to return an object with an execute method
  transaction: vi.fn(() => ({
    execute: vi.fn(async (callback) => {
      // The execute function receives a callback. We immediately call it,
      // passing our mock transaction object. The service logic inside 
      // the callback will then likely call createOrganizationRepository(mockTrx).
      return await callback(mockTrx);
    }),
  })),
} as unknown as Kysely<DB>; 

// 3. Mock the error factory (keep as is, looks okay)
vi.mock('../../errors', () => ({
  createAppError: {
    organizations: {
      organizationNotFound: vi.fn(() => new Error('Organization not found mock')),
      actionNotAllowed: vi.fn((msg: string) => new Error(`Action not allowed mock: ${msg}`)),
    },
  },
}));

// 4. Import the mocked factory function
import { createOrganizationRepository as mockCreateOrganizationRepositoryFn } from './organization.repository';

// --- Setup Test Suite ---

// Define a type for the *instance* methods returned by the (real or mocked) repository factory
type MockOrganizationRepositoryInstance = {
  findOrganizationById: ReturnType<typeof vi.fn>;
  findAllOrganizationMembershipsByUserId: ReturnType<typeof vi.fn>;
  createOrganization: ReturnType<typeof vi.fn>;
  createMembership: ReturnType<typeof vi.fn>;
  deleteOrganization: ReturnType<typeof vi.fn>;
  deleteOrganizationMembership: ReturnType<typeof vi.fn>;
  updateMembershipDefaultStatus: ReturnType<typeof vi.fn>;
  findDefaultMembershipByUserId: ReturnType<typeof vi.fn>;
  // Add any other methods used by the service
};


describe('OrganizationService', () => {
  let organizationService: OrganizationService;
  // Mock for the repository instance passed directly to the service
  let mockDirectRepoInstance: MockOrganizationRepositoryInstance;
  // Mock for the repository instance returned *by the factory* (e.g., inside transactions)
  let mockTransactionalRepoInstance: MockOrganizationRepositoryInstance; 
  // Mock for the factory function itself
  let mockRepoFactory: ReturnType<typeof vi.fn>; 

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock objects for the repository methods
    // One for the instance passed directly
    mockDirectRepoInstance = {
      findOrganizationById: vi.fn(),
      findAllOrganizationMembershipsByUserId: vi.fn(),
      createOrganization: vi.fn(),
      createMembership: vi.fn(),
      deleteOrganization: vi.fn(),
      deleteOrganizationMembership: vi.fn(),
      updateMembershipDefaultStatus: vi.fn(),
      findDefaultMembershipByUserId: vi.fn(),
    };

    // Another separate one for the instance returned by the factory within transactions
    mockTransactionalRepoInstance = {
       findOrganizationById: vi.fn(),
       findAllOrganizationMembershipsByUserId: vi.fn(),
       createOrganization: vi.fn(),
       createMembership: vi.fn(),
       deleteOrganization: vi.fn(),
       deleteOrganizationMembership: vi.fn(),
       updateMembershipDefaultStatus: vi.fn(),
       findDefaultMembershipByUserId: vi.fn(),
    };

    // Get the mocked factory function
    // Use the imported mock function directly
    mockRepoFactory = vi.mocked(mockCreateOrganizationRepositoryFn);
    
    // Configure the factory mock: 
    // When called (presumably with the mock transaction object), return the transactional repo mock
    mockRepoFactory.mockImplementation(({ db: transactionObject }) => {
      // You could add checks here: expect(transactionObject).toBe(mockTrx)
      // Return the appropriate mock instance
      return mockTransactionalRepoInstance as unknown as OrganizationRepository;
    });


    // Create the service instance, passing the mocked DB, the direct repo instance, and the repo factory
    organizationService = createOrganizationService({ 
      db: mockDb, 
      // Pass the direct instance mock
      organizationRepository: mockDirectRepoInstance as unknown as OrganizationRepository, 
      // Pass the mocked factory function
      createOrganizationRepository: mockRepoFactory 
    });
  });

  it('should be defined', () => {
    expect(organizationService).toBeDefined();
  });

  // --- Test findOrganizationById --- 
  describe('findOrganizationById', () => {
    it('should call repository.findOrganizationById with the correct id', async () => {
      const organizationId = 1;
      const expectedOrg = { id: organizationId, name: 'Test Org' } as Selectable<OrganizationsOrganization>; // Cast for mock data
      // Configure the *direct* repository instance mock
      mockDirectRepoInstance.findOrganizationById.mockResolvedValue(expectedOrg);

      const result = await organizationService.findOrganizationById({ organizationId });

      // Expect the method on the *direct* instance to have been called
      expect(mockDirectRepoInstance.findOrganizationById).toHaveBeenCalledWith({ organizationId });
      expect(mockDirectRepoInstance.findOrganizationById).toHaveBeenCalledTimes(1);
      // Ensure the transactional one wasn't called
      expect(mockTransactionalRepoInstance.findOrganizationById).not.toHaveBeenCalled(); 
      expect(result).toEqual(expectedOrg);
    });

    it('should return null if repository returns null', async () => {
      const organizationId = 99;
      mockDirectRepoInstance.findOrganizationById.mockResolvedValue(null);

      const result = await organizationService.findOrganizationById({ organizationId });

      expect(mockDirectRepoInstance.findOrganizationById).toHaveBeenCalledWith({ organizationId });
      expect(result).toBeNull();
    });
  });

  // --- Test findAllOrganizationMembershipsByUserId ---
  describe('findAllOrganizationMembershipsByUserId', () => {
    it('should call repository.findAllOrganizationMembershipsByUserId with the correct userId', async () => {
      const userId = 10;
      const now = new Date();
      const expectedMemberships: Selectable<OrganizationsMembership>[] = [
        { organization_id: 1, user_id: userId, role: 'member', is_default: false, created_at: now, updated_at: now },
        { organization_id: 2, user_id: userId, role: 'owner', is_default: true, created_at: now, updated_at: now },
      ]; 
      
      mockDirectRepoInstance.findAllOrganizationMembershipsByUserId.mockResolvedValue(expectedMemberships);

      const result = await organizationService.findAllOrganizationMembershipsByUserId({ userId });

      expect(mockDirectRepoInstance.findAllOrganizationMembershipsByUserId).toHaveBeenCalledWith({ userId });
      expect(mockDirectRepoInstance.findAllOrganizationMembershipsByUserId).toHaveBeenCalledTimes(1);
      expect(mockTransactionalRepoInstance.findAllOrganizationMembershipsByUserId).not.toHaveBeenCalled();
      expect(result).toEqual(expectedMemberships);
    });

     it('should return empty array if repository returns empty array', async () => {
      const userId = 11;
      mockDirectRepoInstance.findAllOrganizationMembershipsByUserId.mockResolvedValue([]);

      const result = await organizationService.findAllOrganizationMembershipsByUserId({ userId });

      expect(mockDirectRepoInstance.findAllOrganizationMembershipsByUserId).toHaveBeenCalledWith({ userId });
      expect(result).toEqual([]);
    });
  });

  // --- Test createOrganization --- 
  describe('createOrganization', () => {
    const userId = 20;
    const orgData: Insertable<OrganizationsOrganization> = { name: 'New Test Org' };
    const createdOrg = { id: 5, name: orgData.name, created_at: new Date(), updated_at: new Date() } as Selectable<OrganizationsOrganization>; // Add timestamps
    const createdMembership = { 
        organization_id: createdOrg.id, 
        user_id: userId, 
        role: 'owner', 
        is_default: false, // Default is likely false on creation unless specified
        created_at: new Date(), 
        updated_at: new Date()
      } as Selectable<OrganizationsMembership>; // Remove unnecessary cast if structure matches

    it('should create organization and owner membership within a transaction', async () => {
      // Configure the *transactional* repo mocks
      mockTransactionalRepoInstance.createOrganization.mockResolvedValue(createdOrg);
      mockTransactionalRepoInstance.createMembership.mockResolvedValue(createdMembership);

      const result = await organizationService.createOrganization({ data: orgData, userId });

      // Check if transaction was started
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      // Check if the factory was called within the transaction
      expect(mockRepoFactory).toHaveBeenCalledWith({ db: mockTrx });
      expect(mockRepoFactory).toHaveBeenCalledTimes(1);
      
      // Check if the correct methods were called on the *transactional* repo instance
      expect(mockTransactionalRepoInstance.createOrganization).toHaveBeenCalledWith({ name: orgData.name });
      expect(mockTransactionalRepoInstance.createMembership).toHaveBeenCalledWith({
        organization_id: createdOrg.id,
        user_id: userId,
        role: 'owner'
      });
      expect(mockTransactionalRepoInstance.createOrganization).toHaveBeenCalledTimes(1);
      expect(mockTransactionalRepoInstance.createMembership).toHaveBeenCalledTimes(1);

      // Check that the direct repo instance methods were not called
      expect(mockDirectRepoInstance.createOrganization).not.toHaveBeenCalled();
      expect(mockDirectRepoInstance.createMembership).not.toHaveBeenCalled();

      // Check the final result
      expect(result).toEqual(createdOrg);
    });

    it('should re-throw error if transactional repo createOrganization fails', async () => {
      const error = new Error('DB error during org creation');
      mockTransactionalRepoInstance.createOrganization.mockRejectedValue(error);

      await expect(organizationService.createOrganization({ data: orgData, userId })).rejects.toThrow(error);

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockRepoFactory).toHaveBeenCalledWith({ db: mockTrx });
      expect(mockTransactionalRepoInstance.createOrganization).toHaveBeenCalledWith({ name: orgData.name });
      // Membership should not be called if org creation fails
      expect(mockTransactionalRepoInstance.createMembership).not.toHaveBeenCalled(); 
    });

     it('should re-throw error if transactional repo createMembership fails', async () => {
      const error = new Error('DB error during membership creation');
      mockTransactionalRepoInstance.createOrganization.mockResolvedValue(createdOrg);
      mockTransactionalRepoInstance.createMembership.mockRejectedValue(error);

      await expect(organizationService.createOrganization({ data: orgData, userId })).rejects.toThrow(error);

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockRepoFactory).toHaveBeenCalledWith({ db: mockTrx });
      expect(mockTransactionalRepoInstance.createOrganization).toHaveBeenCalledWith({ name: orgData.name });
      expect(mockTransactionalRepoInstance.createMembership).toHaveBeenCalledWith({ 
        organization_id: createdOrg.id, 
        user_id: userId, 
        role: 'owner' 
      });
    });
  });

  // --- Test deleteOrganization --- 
  describe('deleteOrganization', () => {
    const organizationId = 30;
    const userId = 40; // Assume this user is initially the owner
    const now = new Date();
    const ownerMembership: Selectable<OrganizationsMembership> = { organization_id: organizationId, user_id: userId, role: 'owner', is_default: false, created_at: now, updated_at: now };
    const otherMembership: Selectable<OrganizationsMembership> = { organization_id: 999, user_id: userId, role: 'member', is_default: true, created_at: now, updated_at: now }; // A membership in another org
    const organizationWithOwner: Selectable<OrganizationsOrganization> & { ownerMembership: Selectable<OrganizationsMembership> } = { 
      id: organizationId, 
      name: 'Org To Delete', 
      created_at: now, 
      updated_at: now,
      ownerMembership: ownerMembership
    }; 
    const deleteResult = { count: 1n }; // Kysely delete result

    it('should delete the organization if the user is the owner and has other orgs', async () => {
      // Mock finding memberships (user belongs to more than one)
      mockDirectRepoInstance.findAllOrganizationMembershipsByUserId.mockResolvedValue([ownerMembership, otherMembership]);
      // Mock finding the organization within the transaction
      mockTransactionalRepoInstance.findOrganizationById.mockResolvedValue(organizationWithOwner);
      // Mock successful deletion within the transaction
      mockTransactionalRepoInstance.deleteOrganization.mockResolvedValue(deleteResult);

      const result = await organizationService.deleteOrganization({ organizationId, userId });

      // Check initial membership call (outside transaction)
      expect(mockDirectRepoInstance.findAllOrganizationMembershipsByUserId).toHaveBeenCalledWith({ userId });
      // Check transaction started
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      // Check repo factory called within transaction
      expect(mockRepoFactory).toHaveBeenCalledWith({ db: mockTrx });
      // Check findOrgById called within transaction
      expect(mockTransactionalRepoInstance.findOrganizationById).toHaveBeenCalledWith({ organizationId });
      // Check deleteOrg called within transaction
      expect(mockTransactionalRepoInstance.deleteOrganization).toHaveBeenCalledWith({ organizationId });
      expect(result).toEqual(deleteResult);
      // Ensure errors not called
      expect(createAppError.organizations.actionNotAllowed).not.toHaveBeenCalled();
      expect(createAppError.organizations.organizationNotFound).not.toHaveBeenCalled();
    });

    it('should throw actionNotAllowed if user tries to delete their only organization', async () => {
      // Mock finding memberships (user belongs to only this one)
      mockDirectRepoInstance.findAllOrganizationMembershipsByUserId.mockResolvedValue([ownerMembership]);

      await expect(organizationService.deleteOrganization({ organizationId, userId }))
        .rejects
        .toThrow('Action not allowed mock: Cannot delete your only organization...');

      expect(mockDirectRepoInstance.findAllOrganizationMembershipsByUserId).toHaveBeenCalledWith({ userId });
      // Transaction should not even start
      expect(mockDb.transaction).not.toHaveBeenCalled();
      expect(createAppError.organizations.actionNotAllowed).toHaveBeenCalledWith('Cannot delete your only organization...');
    });

    it('should throw organizationNotFound if organization does not exist (inside transaction)', async () => {
      // Mock finding memberships (user belongs to more than one)
      mockDirectRepoInstance.findAllOrganizationMembershipsByUserId.mockResolvedValue([ownerMembership, otherMembership]);
      // Mock finding the organization returns null inside transaction
      mockTransactionalRepoInstance.findOrganizationById.mockResolvedValue(null);

      await expect(organizationService.deleteOrganization({ organizationId, userId }))
        .rejects
        .toThrow('Organization not found mock');

      expect(mockDirectRepoInstance.findAllOrganizationMembershipsByUserId).toHaveBeenCalledWith({ userId });
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockRepoFactory).toHaveBeenCalledWith({ db: mockTrx });
      expect(mockTransactionalRepoInstance.findOrganizationById).toHaveBeenCalledWith({ organizationId });
      // Deletion should not be attempted
      expect(mockTransactionalRepoInstance.deleteOrganization).not.toHaveBeenCalled();
      expect(createAppError.organizations.organizationNotFound).toHaveBeenCalledTimes(1);
      expect(createAppError.organizations.actionNotAllowed).not.toHaveBeenCalled();
    });

    it('should throw actionNotAllowed if user is not the owner (inside transaction)', async () => {
      const nonOwnerUserId = 41;
      const organizationWithDifferentOwner = { 
        ...organizationWithOwner, 
        ownerMembership: { ...ownerMembership, user_id: 999 } // Different owner ID
      };
      // Mock finding memberships (user belongs to more than one)
      const nonOwnerMemberships: Selectable<OrganizationsMembership>[] = [
          { organization_id: organizationId, user_id: nonOwnerUserId, role: 'member', is_default: false, created_at: now, updated_at: now }, // Member of the target org
          { organization_id: 999, user_id: nonOwnerUserId, role: 'member', is_default: true, created_at: now, updated_at: now } // Belongs to another org
      ];
      mockDirectRepoInstance.findAllOrganizationMembershipsByUserId.mockResolvedValue(nonOwnerMemberships);

      // Mock finding the organization within the transaction (shows different owner)
      mockTransactionalRepoInstance.findOrganizationById.mockResolvedValue(organizationWithDifferentOwner);

      // User 41 attempts deletion
      await expect(organizationService.deleteOrganization({ organizationId, userId: nonOwnerUserId }))
        .rejects
        .toThrow('Action not allowed mock: Only the owner can delete the organization');

      expect(mockDirectRepoInstance.findAllOrganizationMembershipsByUserId).toHaveBeenCalledWith({ userId: nonOwnerUserId });
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockRepoFactory).toHaveBeenCalledWith({ db: mockTrx });
      expect(mockTransactionalRepoInstance.findOrganizationById).toHaveBeenCalledWith({ organizationId });
      // Deletion should not be attempted
      expect(mockTransactionalRepoInstance.deleteOrganization).not.toHaveBeenCalled();
      expect(createAppError.organizations.actionNotAllowed).toHaveBeenCalledWith('Only the owner can delete the organization');
      expect(createAppError.organizations.organizationNotFound).not.toHaveBeenCalled();
    });

    it('should re-throw error if transactional repo findOrganizationById fails', async () => {
      const error = new Error('DB error finding org');
      mockDirectRepoInstance.findAllOrganizationMembershipsByUserId.mockResolvedValue([ownerMembership, otherMembership]);
      mockTransactionalRepoInstance.findOrganizationById.mockRejectedValue(error);

      await expect(organizationService.deleteOrganization({ organizationId, userId })).rejects.toThrow(error);

      expect(mockDirectRepoInstance.findAllOrganizationMembershipsByUserId).toHaveBeenCalledWith({ userId });
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockRepoFactory).toHaveBeenCalledWith({ db: mockTrx });
      expect(mockTransactionalRepoInstance.findOrganizationById).toHaveBeenCalledWith({ organizationId });
      expect(mockTransactionalRepoInstance.deleteOrganization).not.toHaveBeenCalled();
    });

     it('should re-throw error if transactional repo deleteOrganization fails', async () => {
      const error = new Error('DB error deleting org');
      mockDirectRepoInstance.findAllOrganizationMembershipsByUserId.mockResolvedValue([ownerMembership, otherMembership]);
      mockTransactionalRepoInstance.findOrganizationById.mockResolvedValue(organizationWithOwner);
      mockTransactionalRepoInstance.deleteOrganization.mockRejectedValue(error);

      await expect(organizationService.deleteOrganization({ organizationId, userId })).rejects.toThrow(error);

      expect(mockDirectRepoInstance.findAllOrganizationMembershipsByUserId).toHaveBeenCalledWith({ userId });
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockRepoFactory).toHaveBeenCalledWith({ db: mockTrx });
      expect(mockTransactionalRepoInstance.findOrganizationById).toHaveBeenCalledWith({ organizationId });
      expect(mockTransactionalRepoInstance.deleteOrganization).toHaveBeenCalledWith({ organizationId });
    });

  });

  // --- Test deleteOrganizationMembership --- 
  describe('deleteOrganizationMembership', () => {
    const organizationId = 50;
    const userId = 60; // User trying to leave
    const ownerUserId = 61; // Different user who is the owner
    const now = new Date();
    const ownerMembership: Selectable<OrganizationsMembership> = { organization_id: organizationId, user_id: ownerUserId, role: 'owner', is_default: false, created_at: now, updated_at: now };
    const orgWithOwner: Selectable<OrganizationsOrganization> & { ownerMembership: Selectable<OrganizationsMembership> } = { 
        id: organizationId, 
        name: 'Org To Leave', 
        created_at: now, 
        updated_at: now,
        ownerMembership: ownerMembership
    };
    const deleteResult = { count: 1n }; // Kysely delete result

    it('should delete the membership if user is not the owner', async () => {
      // Mock finding the org (shows owner is someone else)
      mockDirectRepoInstance.findOrganizationById.mockResolvedValue(orgWithOwner);
      // Mock successful deletion by the direct repo instance
      mockDirectRepoInstance.deleteOrganizationMembership.mockResolvedValue(deleteResult);

      const result = await organizationService.deleteOrganizationMembership({ organizationId, userId });

      // Check findOrgById was called (direct instance)
      expect(mockDirectRepoInstance.findOrganizationById).toHaveBeenCalledWith({ organizationId });
      // Check deleteMembership was called (direct instance)
      expect(mockDirectRepoInstance.deleteOrganizationMembership).toHaveBeenCalledWith({ organizationId, userId });
      expect(result).toEqual(deleteResult);
      // Ensure errors not called
      expect(createAppError.organizations.organizationNotFound).not.toHaveBeenCalled();
      expect(createAppError.organizations.actionNotAllowed).not.toHaveBeenCalled();
      // Ensure transaction not used
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should throw organizationNotFound if organization does not exist', async () => {
      // Mock finding the org returns null
      mockDirectRepoInstance.findOrganizationById.mockResolvedValue(null);

      await expect(organizationService.deleteOrganizationMembership({ organizationId, userId }))
        .rejects
        .toThrow('Organization not found mock');

      expect(mockDirectRepoInstance.findOrganizationById).toHaveBeenCalledWith({ organizationId });
      // Deletion should not be attempted
      expect(mockDirectRepoInstance.deleteOrganizationMembership).not.toHaveBeenCalled();
      expect(createAppError.organizations.organizationNotFound).toHaveBeenCalledTimes(1);
      expect(createAppError.organizations.actionNotAllowed).not.toHaveBeenCalled();
    });

    it('should throw actionNotAllowed if user tries to leave as the owner', async () => {
       const orgWhereUserIsOwner: Selectable<OrganizationsOrganization> & { ownerMembership: Selectable<OrganizationsMembership> } = { 
        ...orgWithOwner,
        ownerMembership: { ...ownerMembership, user_id: userId } // Make the calling user the owner
      }; 
      // Mock finding the org (shows calling user is the owner)
      mockDirectRepoInstance.findOrganizationById.mockResolvedValue(orgWhereUserIsOwner);

      await expect(organizationService.deleteOrganizationMembership({ organizationId, userId }))
        .rejects
        .toThrow('Action not allowed mock: Cannot leave the organization as the owner');

      expect(mockDirectRepoInstance.findOrganizationById).toHaveBeenCalledWith({ organizationId });
      // Deletion should not be attempted
      expect(mockDirectRepoInstance.deleteOrganizationMembership).not.toHaveBeenCalled();
      expect(createAppError.organizations.actionNotAllowed).toHaveBeenCalledWith('Cannot leave the organization as the owner');
      expect(createAppError.organizations.organizationNotFound).not.toHaveBeenCalled();
    });

    it('should re-throw error if findOrganizationById fails', async () => {
      const error = new Error('DB error finding org');
      mockDirectRepoInstance.findOrganizationById.mockRejectedValue(error);

      await expect(organizationService.deleteOrganizationMembership({ organizationId, userId }))
        .rejects
        .toThrow(error);

      expect(mockDirectRepoInstance.findOrganizationById).toHaveBeenCalledWith({ organizationId });
      expect(mockDirectRepoInstance.deleteOrganizationMembership).not.toHaveBeenCalled();
    });

    it('should re-throw error if deleteOrganizationMembership fails', async () => {
      const error = new Error('DB error deleting membership');
      // Mock finding the org (shows owner is someone else)
      mockDirectRepoInstance.findOrganizationById.mockResolvedValue(orgWithOwner);
      // Mock deletion fails
      mockDirectRepoInstance.deleteOrganizationMembership.mockRejectedValue(error);

      await expect(organizationService.deleteOrganizationMembership({ organizationId, userId }))
        .rejects
        .toThrow(error);

      expect(mockDirectRepoInstance.findOrganizationById).toHaveBeenCalledWith({ organizationId });
      expect(mockDirectRepoInstance.deleteOrganizationMembership).toHaveBeenCalledWith({ organizationId, userId });
    });

  });

  // --- Test updateMembershipDefaultStatus ---
  describe('updateMembershipDefaultStatus', () => {
    const userId = 70;
    const organizationIdToSet = 80;
    const previousDefaultOrgId = 81;
    const now = new Date();
    const updateResult = { count: 1n }; // Kysely update result
    const currentDefaultMembership: Selectable<OrganizationsMembership> = {
      organization_id: previousDefaultOrgId, 
      user_id: userId, 
      role: 'owner', 
      is_default: true, 
      created_at: now, 
      updated_at: now 
    };
    const targetMembership: Selectable<OrganizationsMembership> = {
      organization_id: organizationIdToSet, 
      user_id: userId, 
      role: 'member', 
      is_default: false, 
      created_at: now, 
      updated_at: now 
    };

    it('should set default and unset previous default within a transaction', async () => {
      // Mock findDefault inside transaction returns the previous default
      mockTransactionalRepoInstance.findDefaultMembershipByUserId.mockResolvedValue(currentDefaultMembership);
      // Mock update calls inside transaction succeed
      mockTransactionalRepoInstance.updateMembershipDefaultStatus.mockResolvedValue(updateResult);

      const result = await organizationService.updateMembershipDefaultStatus({ userId, organizationId: organizationIdToSet });

      // Check transaction started
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      // Check factory called within transaction
      expect(mockRepoFactory).toHaveBeenCalledWith({ db: mockTrx });
      // Check findDefault called within transaction
      expect(mockTransactionalRepoInstance.findDefaultMembershipByUserId).toHaveBeenCalledWith({ userId });
      // Check update called to *unset* previous default
      expect(mockTransactionalRepoInstance.updateMembershipDefaultStatus).toHaveBeenCalledWith({ 
        userId, 
        organizationId: previousDefaultOrgId, 
        isDefault: false 
      });
      // Check update called to *set* new default
      expect(mockTransactionalRepoInstance.updateMembershipDefaultStatus).toHaveBeenCalledWith({ 
        userId, 
        organizationId: organizationIdToSet, 
        isDefault: true 
      });
      // Verify calls order if important (find, unset, set)
      expect(mockTransactionalRepoInstance.findDefaultMembershipByUserId).toHaveBeenCalledBefore(mockTransactionalRepoInstance.updateMembershipDefaultStatus);
      // Ensure update was called twice
      expect(mockTransactionalRepoInstance.updateMembershipDefaultStatus).toHaveBeenCalledTimes(2);
      // Check final result (should be the result of the *second* update)
      expect(result).toEqual(updateResult);
    });

    it('should only set default if no previous default exists', async () => {
      // Mock findDefault inside transaction returns null
      mockTransactionalRepoInstance.findDefaultMembershipByUserId.mockResolvedValue(null);
      // Mock update call inside transaction succeeds
      mockTransactionalRepoInstance.updateMembershipDefaultStatus.mockResolvedValue(updateResult);

      const result = await organizationService.updateMembershipDefaultStatus({ userId, organizationId: organizationIdToSet });

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockRepoFactory).toHaveBeenCalledWith({ db: mockTrx });
      expect(mockTransactionalRepoInstance.findDefaultMembershipByUserId).toHaveBeenCalledWith({ userId });
      // Check update called only once to *set* the new default
      expect(mockTransactionalRepoInstance.updateMembershipDefaultStatus).toHaveBeenCalledWith({ 
        userId, 
        organizationId: organizationIdToSet, 
        isDefault: true 
      });
      expect(mockTransactionalRepoInstance.updateMembershipDefaultStatus).toHaveBeenCalledTimes(1);
      expect(result).toEqual(updateResult);
    });

    it('should only set default if current default is the target organization', async () => {
       const currentIsTargetMembership = {
        ...currentDefaultMembership,
        organization_id: organizationIdToSet // Current default IS the one we want to set
      };
      // Mock findDefault inside transaction returns the target org as default
      mockTransactionalRepoInstance.findDefaultMembershipByUserId.mockResolvedValue(currentIsTargetMembership);
      // Mock update call inside transaction succeeds
      mockTransactionalRepoInstance.updateMembershipDefaultStatus.mockResolvedValue(updateResult);

      const result = await organizationService.updateMembershipDefaultStatus({ userId, organizationId: organizationIdToSet });

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockRepoFactory).toHaveBeenCalledWith({ db: mockTrx });
      expect(mockTransactionalRepoInstance.findDefaultMembershipByUserId).toHaveBeenCalledWith({ userId });
      // Check update called only once to *set* the new (same) default
      // The logic doesn't skip the update if it's already the default, it just doesn't unset anything else
      expect(mockTransactionalRepoInstance.updateMembershipDefaultStatus).toHaveBeenCalledWith({ 
        userId, 
        organizationId: organizationIdToSet, 
        isDefault: true 
      });
      expect(mockTransactionalRepoInstance.updateMembershipDefaultStatus).toHaveBeenCalledTimes(1);
      expect(result).toEqual(updateResult);
    });

    it('should re-throw error if findDefaultMembershipByUserId fails', async () => {
      const error = new Error('DB error finding default');
      mockTransactionalRepoInstance.findDefaultMembershipByUserId.mockRejectedValue(error);

      await expect(organizationService.updateMembershipDefaultStatus({ userId, organizationId: organizationIdToSet }))
        .rejects
        .toThrow(error);

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockRepoFactory).toHaveBeenCalledWith({ db: mockTrx });
      expect(mockTransactionalRepoInstance.findDefaultMembershipByUserId).toHaveBeenCalledWith({ userId });
      // Update should not be called
      expect(mockTransactionalRepoInstance.updateMembershipDefaultStatus).not.toHaveBeenCalled();
    });

    it('should re-throw error if unsetting previous default fails', async () => {
      const error = new Error('DB error unsetting default');
      mockTransactionalRepoInstance.findDefaultMembershipByUserId.mockResolvedValue(currentDefaultMembership);
      // Mock the first update call (unsetting) to fail, the second (setting) won't be reached
      mockTransactionalRepoInstance.updateMembershipDefaultStatus.mockRejectedValueOnce(error);

      await expect(organizationService.updateMembershipDefaultStatus({ userId, organizationId: organizationIdToSet }))
        .rejects
        .toThrow(error);

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockRepoFactory).toHaveBeenCalledWith({ db: mockTrx });
      expect(mockTransactionalRepoInstance.findDefaultMembershipByUserId).toHaveBeenCalledWith({ userId });
      // Check the first update (unset) was attempted
      expect(mockTransactionalRepoInstance.updateMembershipDefaultStatus).toHaveBeenCalledWith({ 
        userId, 
        organizationId: previousDefaultOrgId, 
        isDefault: false 
      });
      expect(mockTransactionalRepoInstance.updateMembershipDefaultStatus).toHaveBeenCalledTimes(1); // Only the failed call
    });

    it('should re-throw error if setting new default fails', async () => {
      const error = new Error('DB error setting default');
      mockTransactionalRepoInstance.findDefaultMembershipByUserId.mockResolvedValue(currentDefaultMembership);
      // Mock the first update (unsetting) to succeed
      mockTransactionalRepoInstance.updateMembershipDefaultStatus
        .mockResolvedValueOnce(updateResult); // Succeeds first time
      // Mock the second update (setting) to fail
      mockTransactionalRepoInstance.updateMembershipDefaultStatus
        .mockRejectedValueOnce(error); // Fails second time

      await expect(organizationService.updateMembershipDefaultStatus({ userId, organizationId: organizationIdToSet }))
        .rejects
        .toThrow(error);

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockRepoFactory).toHaveBeenCalledWith({ db: mockTrx });
      expect(mockTransactionalRepoInstance.findDefaultMembershipByUserId).toHaveBeenCalledWith({ userId });
      // Check the first update (unset) was attempted
      expect(mockTransactionalRepoInstance.updateMembershipDefaultStatus).toHaveBeenCalledWith({ 
        userId, 
        organizationId: previousDefaultOrgId, 
        isDefault: false 
      });
      expect(mockTransactionalRepoInstance.updateMembershipDefaultStatus).toHaveBeenCalledTimes(2);
    });

  });

  // --- Test findDefaultMembershipByUserId ---
  describe('findDefaultMembershipByUserId', () => {
    const userId = 90;
    const now = new Date();
    const defaultMembership: Selectable<OrganizationsMembership> = {
      organization_id: 100, 
      user_id: userId, 
      role: 'admin', 
      is_default: true, 
      created_at: now, 
      updated_at: now 
    };

    it('should return the default membership if found', async () => {
      // Mock the direct repo instance
      mockDirectRepoInstance.findDefaultMembershipByUserId.mockResolvedValue(defaultMembership);

      const result = await organizationService.findDefaultMembershipByUserId({ userId });

      expect(mockDirectRepoInstance.findDefaultMembershipByUserId).toHaveBeenCalledWith({ userId });
      expect(mockDirectRepoInstance.findDefaultMembershipByUserId).toHaveBeenCalledTimes(1);
      // Ensure transactional repo not called
      expect(mockTransactionalRepoInstance.findDefaultMembershipByUserId).not.toHaveBeenCalled();
      expect(result).toEqual(defaultMembership);
    });

    it('should return null if no default membership exists', async () => {
      // Mock the direct repo instance returns null
      mockDirectRepoInstance.findDefaultMembershipByUserId.mockResolvedValue(null);

      const result = await organizationService.findDefaultMembershipByUserId({ userId });

      expect(mockDirectRepoInstance.findDefaultMembershipByUserId).toHaveBeenCalledWith({ userId });
      expect(result).toBeNull();
    });

    it('should re-throw error if repository call fails', async () => {
      const error = new Error('DB error finding default');
      mockDirectRepoInstance.findDefaultMembershipByUserId.mockRejectedValue(error);

      await expect(organizationService.findDefaultMembershipByUserId({ userId }))
        .rejects
        .toThrow(error);

      expect(mockDirectRepoInstance.findDefaultMembershipByUserId).toHaveBeenCalledWith({ userId });
    });
  });

  // --- Test createMembershipFromInvitation ---
  describe('createMembershipFromInvitation', () => {
    const acceptingUserId = 110;
    const orgId = 120;
    const now = new Date();
    const invitation: Selectable<OrganizationsInvitation> = {
      id: 123, // Use a number if the type expects it
      organization_id: orgId,
      email: 'test@example.com',
      role: 'member',
      token: 'some-token',
      status: 'pending',
      expires_at: new Date(Date.now() + 3600 * 1000),
      invited_by_user_id: 1, // Ensure this is a number if the type requires it
      created_at: now,
      updated_at: now
    };
    const newMembership: Selectable<OrganizationsMembership> = {
      organization_id: orgId,
      user_id: acceptingUserId,
      role: invitation.role,
      is_default: false,
      created_at: now,
      updated_at: now
    };

    it('should create membership using the transactional repo instance when trx is provided', async () => {
      // Mock the createMembership method on the *transactional* instance
      mockTransactionalRepoInstance.createMembership.mockResolvedValue(newMembership);

      // Call the service method WITH the mock transaction
      const result = await organizationService.createMembershipFromInvitation({ 
        invitation, 
        acceptingUserId, 
        trx: mockTrx // Pass the transaction
      });

      // Check factory was called with the provided transaction
      expect(mockRepoFactory).toHaveBeenCalledWith({ db: mockTrx });
      expect(mockRepoFactory).toHaveBeenCalledTimes(1);
      // Check createMembership was called on the transactional instance
      expect(mockTransactionalRepoInstance.createMembership).toHaveBeenCalledWith({
        organization_id: invitation.organization_id,
        user_id: acceptingUserId,
        role: invitation.role
      });
      expect(mockTransactionalRepoInstance.createMembership).toHaveBeenCalledTimes(1);
      // Check direct repo instance was NOT used
      expect(mockDirectRepoInstance.createMembership).not.toHaveBeenCalled();
      // Check result
      expect(result).toEqual(newMembership);
    });

    it('should create membership using a new transactional repo instance when no trx is provided', async () => {
        // Mock the createMembership method on the *transactional* instance
      mockTransactionalRepoInstance.createMembership.mockResolvedValue(newMembership);

      // Call the service method WITHOUT a transaction
      const result = await organizationService.createMembershipFromInvitation({ 
        invitation, 
        acceptingUserId 
        // No trx provided
      });

       // Check factory was called with the main DB mock 
       // because the service creates a new repo instance using `db` when `trx` is absent
      expect(mockRepoFactory).toHaveBeenCalledWith({ db: mockDb });
      expect(mockRepoFactory).toHaveBeenCalledTimes(1);
      // Check createMembership was called on the transactional instance 
      // (because the factory is mocked to always return this one)
      expect(mockTransactionalRepoInstance.createMembership).toHaveBeenCalledWith({
        organization_id: invitation.organization_id,
        user_id: acceptingUserId,
        role: invitation.role
      });
      expect(mockTransactionalRepoInstance.createMembership).toHaveBeenCalledTimes(1);
      // Check direct repo instance was NOT used
      expect(mockDirectRepoInstance.createMembership).not.toHaveBeenCalled();
      // Check result
      expect(result).toEqual(newMembership);
    });

    it('should re-throw error if createMembership fails (with trx)', async () => {
      const error = new Error('DB error creating membership from invite');
      mockTransactionalRepoInstance.createMembership.mockRejectedValue(error);

      await expect(organizationService.createMembershipFromInvitation({ invitation, acceptingUserId, trx: mockTrx }))
        .rejects
        .toThrow(error);
        
      expect(mockRepoFactory).toHaveBeenCalledWith({ db: mockTrx });
      expect(mockTransactionalRepoInstance.createMembership).toHaveBeenCalledWith({
        organization_id: invitation.organization_id,
        user_id: acceptingUserId,
        role: invitation.role
      });
    });

    it('should re-throw error if createMembership fails (without trx)', async () => {
      const error = new Error('DB error creating membership from invite');
      mockTransactionalRepoInstance.createMembership.mockRejectedValue(error);

      await expect(organizationService.createMembershipFromInvitation({ invitation, acceptingUserId }))
        .rejects
        .toThrow(error);
        
      expect(mockRepoFactory).toHaveBeenCalledWith({ db: mockDb });
      expect(mockTransactionalRepoInstance.createMembership).toHaveBeenCalledWith({
        organization_id: invitation.organization_id,
        user_id: acceptingUserId,
        role: invitation.role
      });
    });

  });

}); 
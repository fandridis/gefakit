import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOrganizationInvitationService, OrganizationInvitationService } from './organization-invitation.service';
import { OrganizationInvitationRepository } from './organization-invitation.repository'; // Import real type and factory
import { OrganizationService } from '../organizations/organization.service';
import { AuthService } from '../auth/auth.service';
import { DB, OrganizationsInvitation, AuthUser } from '../../db/db-types';
import { Insertable, Selectable, Kysely, Transaction } from 'kysely';
// --- Import Errors ---
import { organizationInvitationErrors } from './organization-invitation.errors';
import { authErrors } from '../auth/auth.errors';

// --- Mock Dependencies ---

// 1. Mock Repository Module (including factory)
vi.mock('./organization-invitation.repository', () => ({
  createOrganizationInvitationRepository: vi.fn(),
  // Add mocks for any standalone functions if needed, though likely not if using instance methods
}));

// 2. Mock Dependent Services
vi.mock('../organizations/organization.service'); // Mock the entire service module
vi.mock('../auth/auth.service'); // Mock the entire service module

// 3. Mock Kysely DB and Transactions
const mockTrx = {} as unknown as Transaction<DB>;
const mockExecute = vi.fn(async (callback) => await callback(mockTrx));
const mockTransaction = { execute: mockExecute };
const mockDb = {
  transaction: vi.fn(() => mockTransaction),
} as unknown as Kysely<DB>;

// 5. Import Mocked Functions/Modules AFTER mocks
import { createOrganizationInvitationRepository as mockCreateOrganizationInvitationRepositoryFn } from './organization-invitation.repository';


// --- Test Suite Setup ---

// Type for the *instance* methods returned by the (real or mocked) repository factory
type MockOrganizationInvitationRepositoryInstance = {
  findAllInvitationsByUserEmail: ReturnType<typeof vi.fn>;
  findInvitationByToken: ReturnType<typeof vi.fn>;
  acceptInvitation: ReturnType<typeof vi.fn>;
  declineInvitation: ReturnType<typeof vi.fn>;
  deleteInvitation: ReturnType<typeof vi.fn>;
  createInvitation: ReturnType<typeof vi.fn>;
  // Add other methods if the service uses them directly
};

// Type for the mocked OrganizationService instance methods
type MockOrganizationServiceInstance = {
    createMembershipFromInvitation: ReturnType<typeof vi.fn>;
    // Add other methods if needed
};

// Type for the mocked AuthService instance methods
type MockAuthServiceInstance = {
    findUserById: ReturnType<typeof vi.fn>;
    // Add other methods if needed
};


describe('OrganizationInvitationService', () => {
  let organizationInvitationService: OrganizationInvitationService;
  let mockDirectRepoInstance: MockOrganizationInvitationRepositoryInstance;
  let mockTransactionalRepoInstance: MockOrganizationInvitationRepositoryInstance;
  let mockRepoFactory: ReturnType<typeof vi.fn>;
  let mockOrgServiceInstance: MockOrganizationServiceInstance;
  let mockAuthServiceInstance: MockAuthServiceInstance;

  // --- Mock Data ---
  const userId = 1;
  const userEmail = 'delivered@resend.dev';
  const token = 'valid-token-123';
  const organizationId = 10;
  const now = new Date();
  const expiresSoon = new Date(Date.now() + 3600 * 1000);
  const expiredDate = new Date(Date.now() - 3600 * 1000);

  const mockUser: Selectable<AuthUser> = {
    id: userId,
    email: userEmail,
    username: 'tester',
    password_hash: 'hash',
    email_verified: true,
    created_at: now,
    role: 'USER',
  };

  const mockPendingInvitation: Selectable<OrganizationsInvitation> = {
    id: 1,
    organization_id: organizationId,
    email: userEmail,
    role: 'member',
    token: token,
    status: 'pending',
    expires_at: expiresSoon,
    invited_by_user_id: 2,
    created_at: now,
    updated_at: now
  };

  const mockAcceptedInvitation: Selectable<OrganizationsInvitation> = {
      ...mockPendingInvitation,
      status: 'accepted',
      updated_at: new Date()
  };

   const mockDeclinedInvitation: Selectable<OrganizationsInvitation> = {
      ...mockPendingInvitation,
      status: 'declined',
      updated_at: new Date()
  };

  const mockExpiredInvitation: Selectable<OrganizationsInvitation> = {
      ...mockPendingInvitation,
      expires_at: expiredDate,
  };

  beforeEach(() => {
    vi.clearAllMocks(); // Clear all mocks including execute calls

    // Create mock instances for repository methods
    mockDirectRepoInstance = {
      findAllInvitationsByUserEmail: vi.fn(),
      findInvitationByToken: vi.fn(),
      acceptInvitation: vi.fn(),
      declineInvitation: vi.fn(),
      deleteInvitation: vi.fn(),
      createInvitation: vi.fn(),
    };
    mockTransactionalRepoInstance = {
      findAllInvitationsByUserEmail: vi.fn(),
      findInvitationByToken: vi.fn(),
      acceptInvitation: vi.fn(),
      declineInvitation: vi.fn(),
      deleteInvitation: vi.fn(),
      createInvitation: vi.fn(),
    };

    // Create mock instances for service methods
    mockOrgServiceInstance = {
        createMembershipFromInvitation: vi.fn(),
    };
    mockAuthServiceInstance = {
        findUserById: vi.fn(),
    };

    // Get the mocked factory function
    mockRepoFactory = vi.mocked(mockCreateOrganizationInvitationRepositoryFn);

    // Configure the factory mock
    mockRepoFactory.mockImplementation(({ db: transactionObject }) => {
        // Generally, tests involving transactions will pass mockTrx
        if (transactionObject === mockTrx) {
            return mockTransactionalRepoInstance as unknown as OrganizationInvitationRepository;
        }
        // If called with the main db (less common in this service structure, but handle defensively)
        // It might indicate an issue if the service isn't using transactions where expected
        console.warn('Mock Repo Factory called unexpectedly with main DB');
        return mockDirectRepoInstance as unknown as OrganizationInvitationRepository; // Fallback? Or throw?
    });

    // Create the service instance
    organizationInvitationService = createOrganizationInvitationService({
      db: mockDb,
      // Pass the direct instance mock
      organizationInvitationRepository: mockDirectRepoInstance as unknown as OrganizationInvitationRepository,
      // Pass the mocked factory function
      createOrganizationInvitationRepository: mockRepoFactory,
       // Pass mocked services (cast needed because the imported *module* is mocked)
      organizationService: mockOrgServiceInstance as unknown as OrganizationService,
      authService: mockAuthServiceInstance as unknown as AuthService,
    });
  });

  it('should be defined', () => {
    expect(organizationInvitationService).toBeDefined();
  });

  // --- Test findAllInvitationsByUserId ---
  describe('findAllInvitationsByUserId', () => {
    it('should find user by id, then find invitations by email', async () => {
      const expectedInvitations = [mockPendingInvitation];
      mockAuthServiceInstance.findUserById.mockResolvedValue(mockUser);
      mockDirectRepoInstance.findAllInvitationsByUserEmail.mockResolvedValue(expectedInvitations);

      const result = await organizationInvitationService.findAllInvitationsByUserId({ userId });

      expect(mockAuthServiceInstance.findUserById).toHaveBeenCalledWith({ id: userId });
      expect(mockDirectRepoInstance.findAllInvitationsByUserEmail).toHaveBeenCalledWith({ email: userEmail });
      expect(result).toEqual(expectedInvitations);
     //  expect(mockErrors.auth.userNotFound).not.toHaveBeenCalled();
    });

    it('should throw userNotFound if authService returns null', async () => {
      mockAuthServiceInstance.findUserById.mockResolvedValue(null);

      await expect(organizationInvitationService.findAllInvitationsByUserId({ userId }))
        .rejects.toThrow(authErrors.userNotFound());

      expect(mockAuthServiceInstance.findUserById).toHaveBeenCalledWith({ id: userId });
      expect(mockDirectRepoInstance.findAllInvitationsByUserEmail).not.toHaveBeenCalled();
      // expect(mockErrors.auth.userNotFound).toHaveBeenCalledTimes(1);
    });
  });

  // --- Test findInvitationByToken ---
  describe('findInvitationByToken', () => {
    it('should call repository.findInvitationByToken with the token', async () => {
      mockDirectRepoInstance.findInvitationByToken.mockResolvedValue(mockPendingInvitation);

      const result = await organizationInvitationService.findInvitationByToken({ token });

      expect(mockDirectRepoInstance.findInvitationByToken).toHaveBeenCalledWith({ token });
      expect(result).toEqual(mockPendingInvitation);
    });

     it('should return null if repository returns null', async () => {
      mockDirectRepoInstance.findInvitationByToken.mockResolvedValue(null);

      const result = await organizationInvitationService.findInvitationByToken({ token: 'non-existent' });

      expect(mockDirectRepoInstance.findInvitationByToken).toHaveBeenCalledWith({ token: 'non-existent' });
      expect(result).toBeNull();
    });
  });

  // --- Test acceptInvitation ---
  describe('acceptInvitation', () => {
    const acceptingUserId = userId;

    it('should accept invitation, create membership within transaction', async () => {
      // 1. Initial find (direct repo)
      mockDirectRepoInstance.findInvitationByToken.mockResolvedValue(mockPendingInvitation);
      // 2. Accept within transaction (transactional repo)
      mockTransactionalRepoInstance.acceptInvitation.mockResolvedValue(mockAcceptedInvitation);
      // 3. Create membership within transaction (org service)
      mockOrgServiceInstance.createMembershipFromInvitation.mockResolvedValue({} as any); // Mock return doesn't matter much here

      const result = await organizationInvitationService.acceptInvitation({ token, acceptingUserId });

      // Verify initial check
      expect(mockDirectRepoInstance.findInvitationByToken).toHaveBeenCalledWith({ token });
      // Verify transaction started
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledTimes(1);
      // Verify factory called within transaction
      expect(mockRepoFactory).toHaveBeenCalledWith({ db: mockTrx });
      // Verify transactional repo method called
      expect(mockTransactionalRepoInstance.acceptInvitation).toHaveBeenCalledWith({ token });
      // Verify org service method called with transaction
      expect(mockOrgServiceInstance.createMembershipFromInvitation).toHaveBeenCalledWith({
        invitation: mockAcceptedInvitation,
        acceptingUserId,
        trx: mockTrx
      });
      // Verify final result
      expect(result).toEqual(mockAcceptedInvitation);
      // Ensure errors not thrown
     // expect(mockErrors.organizationInvitations.invitationNotFound).not.toHaveBeenCalled();
     // expect(mockErrors.organizationInvitations.actionNotAllowed).not.toHaveBeenCalled();
    });

    it('should throw invitationNotFound if initial find returns null', async () => {
      mockDirectRepoInstance.findInvitationByToken.mockResolvedValue(null);

      await expect(organizationInvitationService.acceptInvitation({ token, acceptingUserId }))
        .rejects.toThrow(organizationInvitationErrors.invitationNotFound());

      expect(mockDirectRepoInstance.findInvitationByToken).toHaveBeenCalledWith({ token });
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should throw invitationExpired if invitation is expired', async () => {
      mockDirectRepoInstance.findInvitationByToken.mockResolvedValue(mockExpiredInvitation);

      await expect(organizationInvitationService.acceptInvitation({ token, acceptingUserId }))
        .rejects.toThrow(organizationInvitationErrors.invitationExpired());

      expect(mockDirectRepoInstance.findInvitationByToken).toHaveBeenCalledWith({ token });
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should throw invitationAlreadyProcessed if invitation status is not pending', async () => {
      mockDirectRepoInstance.findInvitationByToken.mockResolvedValue(mockAcceptedInvitation); // Or mockDeclinedInvitation

      await expect(organizationInvitationService.acceptInvitation({ token, acceptingUserId }))
        .rejects.toThrow(organizationInvitationErrors.invitationAlreadyProcessed());

      expect(mockDirectRepoInstance.findInvitationByToken).toHaveBeenCalledWith({ token });
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should throw invitationNotFound if transactional accept returns null', async () => {
        // 1. Initial find (direct repo) - success
        mockDirectRepoInstance.findInvitationByToken.mockResolvedValue(mockPendingInvitation);
        // 2. Accept within transaction (transactional repo) - returns null!
        mockTransactionalRepoInstance.acceptInvitation.mockResolvedValue(null);

        await expect(organizationInvitationService.acceptInvitation({ token, acceptingUserId }))
            .rejects.toThrow(organizationInvitationErrors.invitationNotFound());

        // Verify initial check and transaction start
        expect(mockDirectRepoInstance.findInvitationByToken).toHaveBeenCalledWith({ token });
        expect(mockDb.transaction).toHaveBeenCalledTimes(1);
        expect(mockExecute).toHaveBeenCalledTimes(1);
        // Verify factory called within transaction
        expect(mockRepoFactory).toHaveBeenCalledWith({ db: mockTrx });
        // Verify transactional repo method called
        expect(mockTransactionalRepoInstance.acceptInvitation).toHaveBeenCalledWith({ token });
        // Verify org service method was NOT called
        expect(mockOrgServiceInstance.createMembershipFromInvitation).not.toHaveBeenCalled();
    });

    it('should re-throw error if organizationService.createMembershipFromInvitation fails', async () => {
      const membershipError = new Error('Failed to create membership');
      mockDirectRepoInstance.findInvitationByToken.mockResolvedValue(mockPendingInvitation);
      mockTransactionalRepoInstance.acceptInvitation.mockResolvedValue(mockAcceptedInvitation);
      // Mock org service to throw
      mockOrgServiceInstance.createMembershipFromInvitation.mockRejectedValue(membershipError);

      await expect(organizationInvitationService.acceptInvitation({ token, acceptingUserId }))
        .rejects.toThrow(membershipError);

      expect(mockDirectRepoInstance.findInvitationByToken).toHaveBeenCalledWith({ token });
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockRepoFactory).toHaveBeenCalledWith({ db: mockTrx });
      expect(mockTransactionalRepoInstance.acceptInvitation).toHaveBeenCalledWith({ token });
      expect(mockOrgServiceInstance.createMembershipFromInvitation).toHaveBeenCalledWith({
        invitation: mockAcceptedInvitation,
        acceptingUserId,
        trx: mockTrx
      });
    });
  });

  // --- Test declineInvitation ---
  describe('declineInvitation', () => {
    it('should decline invitation and return the declined invitation', async () => {
      mockDirectRepoInstance.findInvitationByToken.mockResolvedValue(mockPendingInvitation);
      mockDirectRepoInstance.declineInvitation.mockResolvedValue(mockDeclinedInvitation);

      const result = await organizationInvitationService.declineInvitation({ token });

      expect(mockDirectRepoInstance.findInvitationByToken).toHaveBeenCalledWith({ token });
      expect(mockDirectRepoInstance.declineInvitation).toHaveBeenCalledWith({ token });
      expect(result).toEqual(mockDeclinedInvitation);
    });

    it('should throw invitationNotFound if initial find returns null', async () => {
      mockDirectRepoInstance.findInvitationByToken.mockResolvedValue(null);

      await expect(organizationInvitationService.declineInvitation({ token }))
        .rejects.toThrow(organizationInvitationErrors.invitationNotFound());

      expect(mockDirectRepoInstance.findInvitationByToken).toHaveBeenCalledWith({ token });
      expect(mockDirectRepoInstance.declineInvitation).not.toHaveBeenCalled();
    });

    it('should throw invitationExpired if invitation is expired', async () => {
      mockDirectRepoInstance.findInvitationByToken.mockResolvedValue(mockExpiredInvitation);

      await expect(organizationInvitationService.declineInvitation({ token }))
        .rejects.toThrow(organizationInvitationErrors.invitationExpired());

      expect(mockDirectRepoInstance.findInvitationByToken).toHaveBeenCalledWith({ token });
      expect(mockDirectRepoInstance.declineInvitation).not.toHaveBeenCalled();
    });

    it('should throw invitationAlreadyProcessed if invitation status is not pending', async () => {
      mockDirectRepoInstance.findInvitationByToken.mockResolvedValue(mockDeclinedInvitation); // Or mockAcceptedInvitation

      await expect(organizationInvitationService.declineInvitation({ token }))
        .rejects.toThrow(organizationInvitationErrors.invitationAlreadyProcessed());

      expect(mockDirectRepoInstance.findInvitationByToken).toHaveBeenCalledWith({ token });
      expect(mockDirectRepoInstance.declineInvitation).not.toHaveBeenCalled();
    });

     it('should throw invitationNotFound if declineInvitation returns null', async () => {
        // 1. Initial find - success
        mockDirectRepoInstance.findInvitationByToken.mockResolvedValue(mockPendingInvitation);
        // 2. Decline call - returns null!
        mockDirectRepoInstance.declineInvitation.mockResolvedValue(null);

        await expect(organizationInvitationService.declineInvitation({ token }))
            .rejects.toThrow(organizationInvitationErrors.invitationNotFound());

        // Verify initial check
        expect(mockDirectRepoInstance.findInvitationByToken).toHaveBeenCalledWith({ token });
        // Verify decline method called
        expect(mockDirectRepoInstance.declineInvitation).toHaveBeenCalledWith({ token });
    });
  });

  // --- Test deleteInvitation ---
  describe('deleteInvitation', () => {
    it('should call repository.deleteInvitation with the token', async () => {
      const deleteResult = { count: 1n }; // Kysely delete result
      mockDirectRepoInstance.deleteInvitation.mockResolvedValue(deleteResult);

      const result = await organizationInvitationService.deleteInvitation({ token });

      expect(mockDirectRepoInstance.deleteInvitation).toHaveBeenCalledWith({ token });
      expect(result).toEqual(deleteResult);
      // No transaction expected
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });
  });

  // --- Test createInvitation ---
  describe('createInvitation', () => {
     it('should call repository.createInvitation with the invitation data', async () => {
      const invitationData: Insertable<OrganizationsInvitation> = {
        organization_id: organizationId,
        email: 'delivered@resend.dev',
        role: 'admin',
        token: 'new-token-456',
        status: 'pending',
        expires_at: expiresSoon,
        invited_by_user_id: userId,
      };
      const createdInvitation = { ...invitationData, id: 5, created_at: now, updated_at: now } as Selectable<OrganizationsInvitation>;
      mockDirectRepoInstance.createInvitation.mockResolvedValue(createdInvitation);

      const result = await organizationInvitationService.createInvitation({ organizationInvitation: invitationData });

      expect(mockDirectRepoInstance.createInvitation).toHaveBeenCalledWith({ organizationInvitation: invitationData });
      expect(result).toEqual(createdInvitation);
      // No transaction expected
      expect(mockDb.transaction).not.toHaveBeenCalled();
     });
  });

}); 
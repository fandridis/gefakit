import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createOnboardingService, OnboardingService } from './onboarding.service';
import { AuthRepository } from '../auth/auth.repository';
import { OrganizationRepository } from '../organizations/organization.repository';
import { Kysely, Transaction, Selectable } from 'kysely';
import { DB } from '../../db/db-types';
import { AppError } from '../../errors/app-error';
import { hashPassword, isMyPasswordPwned } from '../../lib/crypto';
import { randomUUID } from 'node:crypto';

// --- Mock Dependencies ---

// 1. Kysely DB and Transaction Mocking
const mockTrx = {} as Transaction<DB>;
// Create the mock execute function separately
const mockExecute = vi.fn().mockImplementation(async (transactionalLogic) => {
  // Simulate transaction execution by immediately calling the logic
  // with the mock transaction object.
  return await transactionalLogic(mockTrx);
});
// Create the mock transaction object containing the execute spy
const mockTransactionResult = { 
  execute: mockExecute 
};
// Mock the db.transaction() method to consistently return the same object
const mockDb = {
  transaction: vi.fn(() => mockTransactionResult),
} as unknown as Kysely<DB>;

// 2. Mock Repository *Instances* (for return values)
const mockTxAuthRepo = {
  createUser: vi.fn(),
  createEmailVerificationToken: vi.fn(),
};
const mockTxOrgRepo = {
  createOrganization: vi.fn(),
  createMembership: vi.fn(),
};
const mockFindUserWithPasswordByEmail = vi.fn();
const mockTopLevelAuthRepo = {
    findUserWithPasswordByEmail: mockFindUserWithPasswordByEmail,
} as unknown as AuthRepository;

// 3. Mock Repository *Factory Functions*
const mockCreateAuthRepository = vi.fn(() => mockTxAuthRepo as unknown as AuthRepository);
const mockCreateOrganizationRepository = vi.fn(() => mockTxOrgRepo as unknown as OrganizationRepository);

// 4. Mock Utility Functions (using the import-after-mock pattern)
vi.mock('../../lib/crypto', () => ({
  hashPassword: vi.fn(),
  isMyPasswordPwned: vi.fn(),
}));
const mockCrypto = {
    hashPassword: vi.mocked(hashPassword),
    isMyPasswordPwned: vi.mocked(isMyPasswordPwned)
};

vi.mock('../../errors', () => {
  const mockWeakPasswordError = vi.fn((msg = 'Weak password') => new AppError(msg, 400));
  const mockUserCreationFailedError = vi.fn((msg = 'User creation failed') => new AppError(msg, 500));
  return {
    createAppError: {
      auth: {
        weakPassword: mockWeakPasswordError,
        userCreationFailed: mockUserCreationFailedError,
      },
    },
  };
});
import { createAppError as mockErrors } from '../../errors';

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(),
}));
import { randomUUID as mockRandomUUID } from 'node:crypto';


// --- Test Setup ---
describe('OnboardingService', () => {
  let onboardingService: OnboardingService;

  // --- Mock Data Definitions ---
  const email = 'test@example.com';
  const password = 'ValidPassword123';
  const username = 'tester';
  const orgName = 'Test Org';
  const passwordHash = 'hashed_password_abc';
  const mockUserId = 1;
  const mockOrgId = 10;
  const mockVerificationToken = '123e4567-e89b-12d3-a456-426614174000';

  const mockCreatedUser: Selectable<DB['auth.users']> = { id: mockUserId, email, username, password_hash: passwordHash, created_at: new Date(), email_verified: false, recovery_code: null };
  const mockCreatedOrg: Selectable<DB['organizations.organizations']> = { id: mockOrgId, name: orgName, created_at: new Date(), updated_at: new Date() };
  const mockCreatedMembership: Selectable<DB['organizations.memberships']> = { organization_id: mockOrgId, user_id: mockUserId, role: 'owner', is_default: true, created_at: new Date(), updated_at: new Date() };
  const mockCreatedToken: Selectable<DB['auth.email_verifications']> = { id: 200, user_id: mockUserId, value: mockVerificationToken, expires_at: new Date(Date.now() + 86400000), identifier: email, created_at: new Date(), updated_at: new Date() };

  beforeEach(() => {
    // Reset all mocks (rely on vi.clearAllMocks for transaction and execute spies)
    vi.clearAllMocks();
    // mockExecute.mockClear(); // Removed - handled by clearAllMocks
    // mockDb.transaction.mockClear(); // Removed - handled by clearAllMocks

    // Reset other mocks...
    mockCrypto.hashPassword.mockResolvedValue(passwordHash);
    mockCrypto.isMyPasswordPwned.mockResolvedValue(false);
    vi.mocked(mockRandomUUID).mockReturnValue(mockVerificationToken);
    mockFindUserWithPasswordByEmail.mockResolvedValue(null);
    mockTxAuthRepo.createUser.mockResolvedValue(mockCreatedUser);
    mockTxAuthRepo.createEmailVerificationToken.mockResolvedValue(mockCreatedToken); 
    mockTxOrgRepo.createOrganization.mockResolvedValue(mockCreatedOrg);
    mockTxOrgRepo.createMembership.mockResolvedValue(mockCreatedMembership); 
    vi.mocked(mockErrors.auth.weakPassword).mockClear();
    vi.mocked(mockErrors.auth.userCreationFailed).mockClear();
    mockCreateAuthRepository.mockClear();
    mockCreateOrganizationRepository.mockClear();

    onboardingService = createOnboardingService({ 
        db: mockDb, 
        authRepository: mockTopLevelAuthRepo, 
        createAuthRepository: mockCreateAuthRepository,
        createOrganizationRepository: mockCreateOrganizationRepository
    }); 
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- Test Cases ---

  it('should sign up user, create org/membership/token within transaction, and return details', async () => {
    const result = await onboardingService.signUpAndCreateOrganization({
      email,
      password,
      username,
      orgName,
    });
    expect(mockFindUserWithPasswordByEmail).toHaveBeenCalledWith({ email });
    expect(mockCrypto.isMyPasswordPwned).toHaveBeenCalledWith(password);
    expect(mockCrypto.hashPassword).toHaveBeenCalledWith(password);
    expect(mockDb.transaction).toHaveBeenCalledTimes(1); // Check transaction was called
    // Fix: Assert against the specific mockExecute spy
    expect(mockExecute).toHaveBeenCalledTimes(1); 
    expect(mockCreateAuthRepository).toHaveBeenCalledWith({ db: mockTrx });
    expect(mockCreateOrganizationRepository).toHaveBeenCalledWith({ db: mockTrx });
    expect(mockTxAuthRepo.createUser).toHaveBeenCalledWith({ user: { email, username, password_hash: passwordHash } });
    expect(mockTxAuthRepo.createEmailVerificationToken).toHaveBeenCalledWith(expect.objectContaining({ 
        user_id: mockUserId, 
        value: mockVerificationToken,
        identifier: email 
    }));
    expect(mockTxOrgRepo.createOrganization).toHaveBeenCalledWith({ name: orgName });
    expect(mockTxOrgRepo.createMembership).toHaveBeenCalledWith({ organization_id: mockOrgId, user_id: mockUserId, role: 'owner', is_default: true });
    expect(result).toEqual({ 
        user: mockCreatedUser, 
        orgId: mockOrgId, 
        verificationToken: mockVerificationToken 
    });
    expect(mockErrors.auth.weakPassword).not.toHaveBeenCalled();
    expect(mockErrors.auth.userCreationFailed).not.toHaveBeenCalled();
  });

  it('should throw error if user is found (using userCreationFailed)', async () => {
    mockFindUserWithPasswordByEmail.mockResolvedValue({ ...mockCreatedUser, password_hash: 'some_hash' } as any);
    await expect(onboardingService.signUpAndCreateOrganization({
      email,
      password,
      username,
      orgName,
    })).rejects.toThrow(AppError);
    expect(mockErrors.auth.userCreationFailed).toHaveBeenCalledWith('Email already exists');
    expect(mockDb.transaction).not.toHaveBeenCalled();
    expect(mockCreateAuthRepository).not.toHaveBeenCalled();
    expect(mockCreateOrganizationRepository).not.toHaveBeenCalled();
  });

  it('should throw weakPassword error if password is too short', async () => {
    const shortPassword = 'short';
    await expect(onboardingService.signUpAndCreateOrganization({
      email,
      password: shortPassword,
      username,
      orgName,
    })).rejects.toThrow(AppError);
    expect(mockErrors.auth.weakPassword).toHaveBeenCalledWith('Password must be between 8 and 255 characters long.');
    expect(mockDb.transaction).not.toHaveBeenCalled();
    expect(mockCreateAuthRepository).not.toHaveBeenCalled();
    expect(mockCreateOrganizationRepository).not.toHaveBeenCalled();
  });

  it('should throw weakPassword error if password is pwned', async () => {
    mockCrypto.isMyPasswordPwned.mockResolvedValue(true);
    await expect(onboardingService.signUpAndCreateOrganization({
      email,
      password,
      username,
      orgName,
    })).rejects.toThrow(AppError);
    expect(mockErrors.auth.weakPassword).toHaveBeenCalledWith(expect.stringContaining('found in a data breach'));
    expect(mockCrypto.hashPassword).toHaveBeenCalledWith(password);
    expect(mockDb.transaction).not.toHaveBeenCalled();
    expect(mockCreateAuthRepository).not.toHaveBeenCalled();
    expect(mockCreateOrganizationRepository).not.toHaveBeenCalled();
  });

}); 
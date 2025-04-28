import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Kysely, Transaction, Selectable } from 'kysely';
import { createAuthService, AuthService, OAuthUserDetails } from './auth.service';
import { AuthRepository, createAuthRepository } from './auth.repository'; // Import real type and factory
import { OrganizationRepository, createOrganizationRepository } from '../organizations/organization.repository'; // Import related factories
import { DB, AuthUser, AuthSession, AuthPasswordResetToken, AuthEmailVerification, OrganizationsOrganization, OrganizationsMembership, AuthOauthAccount } from '../../db/db-types';
import { UserDTO, SessionDTO,} from '@gefakit/shared';

// --- Mock Dependencies ---

// 1. Mock Repository Modules (including factories)
vi.mock('./auth.repository', () => ({
  createAuthRepository: vi.fn(),
}));
vi.mock('../organizations/organization.repository', () => ({
  createOrganizationRepository: vi.fn(),
}));

// 2. Mock Kysely DB and Transaction
const mockTrx = {} as Transaction<DB>;
const mockExecute = vi.fn().mockImplementation(async (transactionalLogic) => {
  return await transactionalLogic(mockTrx);
});
const mockTransactionResult = { execute: mockExecute };
const mockDb = {
  transaction: vi.fn(() => mockTransactionResult),
} as unknown as Kysely<DB>;

// 3. Mock Crypto Functions
vi.mock('../../lib/crypto', () => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));
vi.mock('@oslojs/crypto/sha2', () => ({
  sha256: vi.fn(),
}));
vi.mock('@oslojs/encoding', () => ({
  encodeHexLowerCase: vi.fn((input) => Buffer.from(input).toString('hex')), // Simple mock implementation
  encodeBase32LowerCaseNoPadding: vi.fn(() => 'mockbase32token'),
  encodeBase64url: vi.fn(() => 'mockbase64urltoken'),
}));
// Mock native crypto if needed (e.g., for getRandomValues)
const originalCrypto = (global as any).crypto;
const mockGetRandomValues = vi.fn((array: Uint8Array) => { // Explicitly type array
    // Fill with non-zero values for testing if needed
    for (let i = 0; i < array.length; i++) {
        array[i] = i + 1;
    }
    return array;
});

// 4. Mock Error Factory - Corrected
vi.mock('../../core/api-error', async (importOriginal) => {
  // Import the factory module we are mocking
  const actualFactoryModule = await importOriginal() as typeof import('../../core/api-error');
  // Import the *real* ApiError class from its actual location
  const { ApiError } = await import('@gefakit/shared');

  return {
    // Do NOT spread the original module here (actualFactoryModule)
    // Only return the mocked parts
    createApiError: { // Mock only the factory object
      auth: {
        invalidCredentials: vi.fn(() => new ApiError('Invalid credentials mock', 401)),
        emailNotVerified: vi.fn(() => new ApiError('Email not verified mock', 401)),
        oauthEmailRequired: vi.fn(({ provider }: { provider: string }) => new ApiError(`OAuth email required mock for ${provider}`, 400)),
        userNotFound: vi.fn(() => new ApiError('User not found mock', 404)),
        userCreationFailed: vi.fn((reason: string) => new ApiError(reason || 'User creation failed mock', 500)),
        weakPassword: vi.fn((reason: string) => new ApiError(reason || 'Weak password mock', 400)),
        invalidOtp: vi.fn(() => new ApiError('Invalid OTP mock', 400)),
        expiredOtp: vi.fn(() => new ApiError('Expired OTP mock', 400)),
      },
      organizations: {
          notFound: vi.fn((id: any) => new ApiError(`Organization not found mock: ${id}`, 404)),
      }
    },
    // If the original module had other exports needed by the test file,
    // explicitly re-export them from actualFactoryModule here.
    // e.g., someErrorCode: actualFactoryModule.someErrorCode
  };
});

// 5. Import Mocked Functions/Modules AFTER mocks
import { createAuthRepository as mockCreateAuthRepositoryFn } from './auth.repository';
import { createOrganizationRepository as mockCreateOrganizationRepositoryFn } from '../organizations/organization.repository';
// Import the mocked factory
import { createApiError as mockErrors } from '../../core/api-error';
// Import the REAL ApiError class from its actual location
import { ApiError } from '@gefakit/shared';
import { hashPassword as mockHashPassword, verifyPassword as mockVerifyPassword } from '../../lib/crypto';
import { sha256 as mockSha256 } from '@oslojs/crypto/sha2';
import { encodeHexLowerCase as mockEncodeHexLowerCase, encodeBase32LowerCaseNoPadding as mockEncodeBase32, encodeBase64url as mockEncodeBase64url } from '@oslojs/encoding';


// --- Test Suite Setup ---

// Types for mock repository instances
type MockAuthRepositoryInstance = {
  findUserById: ReturnType<typeof vi.fn>;
  findUserWithPasswordByEmail: ReturnType<typeof vi.fn>;
  findSessionWithUser: ReturnType<typeof vi.fn>;
  createSession: ReturnType<typeof vi.fn>;
  deleteSession: ReturnType<typeof vi.fn>;
  updateSessionExpiry: ReturnType<typeof vi.fn>;
  updateSessionIdAndExpiry: ReturnType<typeof vi.fn>;
  deleteAllUserSessions: ReturnType<typeof vi.fn>;
  findPasswordResetTokenByHashedToken: ReturnType<typeof vi.fn>;
  createPasswordResetToken: ReturnType<typeof vi.fn>;
  deletePasswordResetToken: ReturnType<typeof vi.fn>;
  deletePasswordResetTokensByUserId: ReturnType<typeof vi.fn>; // Added
  updateUserPassword: ReturnType<typeof vi.fn>;
  findEmailVerificationTokenByValue: ReturnType<typeof vi.fn>;
  updateUserEmailVerified: ReturnType<typeof vi.fn>;
  deleteEmailVerificationToken: ReturnType<typeof vi.fn>;
  findUserByProviderId: ReturnType<typeof vi.fn>;
  linkOAuthAccount: ReturnType<typeof vi.fn>;
  createUser: ReturnType<typeof vi.fn>;
};

type MockOrganizationRepositoryInstance = {
    createOrganization: ReturnType<typeof vi.fn>;
    createMembership: ReturnType<typeof vi.fn>;
    // Add other methods if needed
};

describe('AuthService', () => {
  let authService: AuthService;
  let mockAuthRepoInstance: MockAuthRepositoryInstance;
  let mockTxAuthRepoInstance: MockAuthRepositoryInstance; // For transactions
  let mockOrgRepoInstance: MockOrganizationRepositoryInstance; // Org repo only used in transactions
  let mockAuthRepoFactory: ReturnType<typeof vi.fn>;
  let mockOrgRepoFactory: ReturnType<typeof vi.fn>;

  // --- Mock Data ---
  const userId = 1;
  const email = 'delivered@resend.dev';
  const password = 'password123';
  const passwordHash = 'hashed_password';
  const sessionToken = 'mockbase32token';
  const sessionId = 'hashed_session_token';
  const resetTokenPlain = 'mockbase64urltoken';
  const resetTokenHashed = 'hashed_reset_token';
  const verificationToken = 'verify-token-abc';
  const now = new Date();
  const expiresSoon = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
  const expiresFar = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  const expired = new Date(Date.now() - 1000);

  // Use Selectable<DBType> for mock data representing DB records
  const mockUser: Selectable<AuthUser> = {
    id: userId,
    email: email,
    username: 'testuser',
    password_hash: passwordHash, // Crucial for verifyPassword tests
    email_verified: true,
    created_at: now,
    role: 'USER',
    recovery_code: null,
  };
  const mockUserUnverified: Selectable<AuthUser> = { ...mockUser, email_verified: false };
  const mockSession: Selectable<AuthSession> = {
    id: sessionId,
    user_id: userId,
    expires_at: expiresFar,
    impersonator_user_id: null,
    active_organization_id: null,
  };
  // Use DTOs for expected results from service functions where appropriate
  const mockUserDTO: UserDTO = {
    id: userId,
    email: email,
    username: 'testuser',
    created_at: now,
    email_verified: true,
    role: 'USER',
  };
  const mockSessionDTO: SessionDTO = {
    id: sessionId,
    user_id: userId,
    expires_at: expiresFar,
    impersonator_user_id: null,
    role: 'USER' // Role comes from joined user data in service logic
  };
    // This represents the joined result from findSessionWithUser repo method
    // Define its shape based on the actual join in the repository
    type SessionWithUserResult = Selectable<AuthSession> & Pick<Selectable<AuthUser>, 'email' | 'username' | 'created_at' | 'email_verified' | 'role'>
    const mockSessionWithUser: SessionWithUserResult = {
      id: sessionId,
      user_id: userId,
      expires_at: expiresFar,
      impersonator_user_id: null,
      active_organization_id: null,
      // Session fields from AuthSession
      // Joined user fields
      email: email,
      username: 'testuser',
      created_at: now,
      email_verified: true,
      role: 'USER' // Role comes from the user table in this join
    };
    const mockPasswordReset: Selectable<AuthPasswordResetToken> = {
        id: 1,
        user_id: userId,
        hashed_token: resetTokenHashed,
        expires_at: expiresSoon,
        created_at: now,
    };
     const mockEmailVerification: Selectable<AuthEmailVerification> = {
        id: 1,
        user_id: userId,
        value: verificationToken,
        expires_at: expiresSoon,
        identifier: email,
        created_at: now,
        updated_at: now
    };
    const mockOrg: Selectable<OrganizationsOrganization> = {
        id: 10, name: 'Test Org', created_at: now, updated_at: now
    };
    const mockMembership: Selectable<OrganizationsMembership> = {
        organization_id: mockOrg.id, user_id: userId, role: 'owner', is_default: true, created_at: now, updated_at: now
    };
    // Mock for the return value of linkOAuthAccount repo method
    const mockLinkedAccount: Selectable<AuthOauthAccount> = {
        id: 100,
        user_id: userId,
        provider: 'github',
        provider_user_id: 'github-123',
        created_at: now,
        updated_at: now
    };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock native crypto
    (global as any).crypto = { ...originalCrypto, getRandomValues: mockGetRandomValues };

    // Create mock instances for repository methods
    mockAuthRepoInstance = {
      findUserById: vi.fn(),
      findUserWithPasswordByEmail: vi.fn(),
      findSessionWithUser: vi.fn(),
      createSession: vi.fn(),
      deleteSession: vi.fn(),
      updateSessionExpiry: vi.fn(),
      updateSessionIdAndExpiry: vi.fn(),
      deleteAllUserSessions: vi.fn(),
      findPasswordResetTokenByHashedToken: vi.fn(),
      createPasswordResetToken: vi.fn(),
      deletePasswordResetToken: vi.fn(),
      deletePasswordResetTokensByUserId: vi.fn(),
      updateUserPassword: vi.fn(),
      findEmailVerificationTokenByValue: vi.fn(),
      updateUserEmailVerified: vi.fn(),
      deleteEmailVerificationToken: vi.fn(),
      findUserByProviderId: vi.fn(),
      linkOAuthAccount: vi.fn(),
      createUser: vi.fn(),
    };
     mockTxAuthRepoInstance = { // Separate instance for transactions
      findUserById: vi.fn(),
      findUserWithPasswordByEmail: vi.fn(),
      findSessionWithUser: vi.fn(),
      createSession: vi.fn(),
      deleteSession: vi.fn(),
      updateSessionExpiry: vi.fn(),
      updateSessionIdAndExpiry: vi.fn(),
      deleteAllUserSessions: vi.fn(),
      findPasswordResetTokenByHashedToken: vi.fn(),
      createPasswordResetToken: vi.fn(),
      deletePasswordResetToken: vi.fn(),
      deletePasswordResetTokensByUserId: vi.fn(),
      updateUserPassword: vi.fn(),
      findEmailVerificationTokenByValue: vi.fn(),
      updateUserEmailVerified: vi.fn(),
      deleteEmailVerificationToken: vi.fn(),
      findUserByProviderId: vi.fn(),
      linkOAuthAccount: vi.fn(),
      createUser: vi.fn(),
    };
    mockOrgRepoInstance = { // Only needed for transactions in this service
        createOrganization: vi.fn(),
        createMembership: vi.fn(),
    };

    // Get the mocked factory functions
    mockAuthRepoFactory = vi.mocked(mockCreateAuthRepositoryFn);
    mockOrgRepoFactory = vi.mocked(mockCreateOrganizationRepositoryFn);

    // Configure factory mocks
    mockAuthRepoFactory.mockImplementation(({ db: transactionObject }) => {
        if (transactionObject === mockTrx) {
            return mockTxAuthRepoInstance as unknown as AuthRepository;
        }
        // Fallback for unexpected calls (shouldn't happen if service uses transactions correctly)
        // console.warn('Auth Repo Factory mock called unexpectedly with main DB');
        return mockAuthRepoInstance as unknown as AuthRepository;
    });
     mockOrgRepoFactory.mockImplementation(({ db: transactionObject }) => {
        if (transactionObject === mockTrx) {
            return mockOrgRepoInstance as unknown as OrganizationRepository;
        }
         // Fallback for unexpected calls
        //  console.warn('Org Repo Factory mock called unexpectedly with main DB');
        return mockOrgRepoInstance as unknown as OrganizationRepository;
    });


    // Configure crypto mocks
    // IMPORTANT: Must mock the result of the hash/encode functions used internally
    vi.mocked(mockSha256).mockImplementation((input: Uint8Array) => {
        const text = new TextDecoder().decode(input);
        if (text === sessionToken) return new TextEncoder().encode('hashed_session_token_bytes');
        if (text === resetTokenPlain) return new TextEncoder().encode('hashed_reset_token_bytes');
        return new TextEncoder().encode('generic_hash_bytes'); // Default hash
    });
    vi.mocked(mockEncodeHexLowerCase).mockImplementation((input: Uint8Array) => {
        const text = new TextDecoder().decode(input);
        if (text === 'hashed_session_token_bytes') return sessionId;
        if (text === 'hashed_reset_token_bytes') return resetTokenHashed;
        return 'generic_hex_hash'; // Default hex hash
    });
    vi.mocked(mockEncodeBase32).mockReturnValue(sessionToken); // Consistent session token
    vi.mocked(mockEncodeBase64url).mockReturnValue(resetTokenPlain); // Consistent reset token


    // Create the service instance
    authService = createAuthService({
        db: mockDb,
        // Pass the direct repo instance (for methods outside transactions)
        authRepository: mockAuthRepoInstance as unknown as AuthRepository,
        // Pass the mocked factories
        createAuthRepository: mockAuthRepoFactory,
        createOrganizationRepository: mockOrgRepoFactory,
    });
  });

   afterEach(() => {
    // Restore original crypto
    (global as any).crypto = originalCrypto;
  });


  it('should be defined', () => {
    expect(authService).toBeDefined();
  });

  // --- Test findUserById ---
  describe('findUserById', () => {
    it('should call repository.findUserById with the correct id', async () => {
      mockAuthRepoInstance.findUserById.mockResolvedValue(mockUser);
      const result = await authService.findUserById({ id: userId });
      // The service method `findUserById` calls the repository method `findUserById`
      expect(mockAuthRepoInstance.findUserById).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockUser);
    });
  });

  // --- Test findSessionById ---
  describe('findSessionById', () => {
    it('should call repository.findSessionWithUser with the correct session id', async () => {
      mockAuthRepoInstance.findSessionWithUser.mockResolvedValue(mockSessionWithUser);
      const result = await authService.findSessionById({ id: sessionId });
      expect(mockAuthRepoInstance.findSessionWithUser).toHaveBeenCalledWith({ sessionId });
      expect(result).toEqual(mockSessionWithUser);
    });
  });

  // --- Test signInWithEmail ---
  describe('signInWithEmail', () => {
    it('should sign in user and return user DTO and session token on success', async () => {
      // Mock repo calls needed for this flow
      mockAuthRepoInstance.findUserWithPasswordByEmail.mockResolvedValue(mockUser); // Use Selectable<AuthUser>
      vi.mocked(mockVerifyPassword).mockResolvedValue(true);
      mockAuthRepoInstance.createSession.mockResolvedValue(mockSession); // Use Selectable<AuthSession>

      const result = await authService.signInWithEmail({ email, password });

      expect(mockAuthRepoInstance.findUserWithPasswordByEmail).toHaveBeenCalledWith({ email });
      // Expect verifyPassword to be called with correct hash from mockUser
      expect(vi.mocked(mockVerifyPassword)).toHaveBeenCalledWith(password, mockUser.password_hash);
      expect(mockAuthRepoInstance.createSession).toHaveBeenCalledWith({
         session: expect.objectContaining({
            id: sessionId, // Ensure crypto mocks generate this
            user_id: userId,
            expires_at: expect.any(Date),
         })
      });
      expect({...result.user}).toEqual({...mockUserDTO, recovery_code: null});
      expect(result.sessionToken).toBe(sessionToken); // Ensure crypto mocks generate this
      expect(mockErrors.auth.invalidCredentials).not.toHaveBeenCalled();
      expect(mockErrors.auth.emailNotVerified).not.toHaveBeenCalled();
    });

     it('should throw invalidCredentials if user not found', async () => {
      mockAuthRepoInstance.findUserWithPasswordByEmail.mockResolvedValue(null);

      await expect(authService.signInWithEmail({ email, password }))
        .rejects.toThrow('Invalid credentials mock');

      expect(mockAuthRepoInstance.findUserWithPasswordByEmail).toHaveBeenCalledWith({ email });
      expect(vi.mocked(mockVerifyPassword)).not.toHaveBeenCalled();
      expect(mockAuthRepoInstance.createSession).not.toHaveBeenCalled();
      expect(mockErrors.auth.invalidCredentials).toHaveBeenCalledTimes(1);
    });

    it('should throw emailNotVerified if user email is not verified', async () => {
      mockAuthRepoInstance.findUserWithPasswordByEmail.mockResolvedValue(mockUserUnverified);

      await expect(authService.signInWithEmail({ email, password }))
        .rejects.toThrow('Email not verified mock');

      expect(mockAuthRepoInstance.findUserWithPasswordByEmail).toHaveBeenCalledWith({ email });
      expect(vi.mocked(mockVerifyPassword)).not.toHaveBeenCalled();
       expect(mockAuthRepoInstance.createSession).not.toHaveBeenCalled();
      expect(mockErrors.auth.emailNotVerified).toHaveBeenCalledTimes(1);
    });

    it('should throw invalidCredentials if password verification fails', async () => {
      mockAuthRepoInstance.findUserWithPasswordByEmail.mockResolvedValue(mockUser);
      vi.mocked(mockVerifyPassword).mockResolvedValue(false);

      await expect(authService.signInWithEmail({ email, password }))
        .rejects.toThrow('Invalid credentials mock');

      expect(mockAuthRepoInstance.findUserWithPasswordByEmail).toHaveBeenCalledWith({ email });
       // Expect verifyPassword to be called with correct hash from mockUser
      expect(vi.mocked(mockVerifyPassword)).toHaveBeenCalledWith(password, mockUser.password_hash);
       expect(mockAuthRepoInstance.createSession).not.toHaveBeenCalled();
      expect(mockErrors.auth.invalidCredentials).toHaveBeenCalledTimes(1);
    });
  });

  // --- Test validateSession ---
  describe('validateSession', () => {
    it('should return session and user DTO for a valid, non-expired token', async () => {
      const sessionData = { ...mockSessionWithUser, expires_at: expiresFar };
      mockAuthRepoInstance.findSessionWithUser.mockResolvedValue(sessionData);

      const { session, user } = await authService.validateSession({ token: sessionToken });

      expect(mockAuthRepoInstance.findSessionWithUser).toHaveBeenCalledWith({ sessionId });
      expect(session).toEqual(mockSessionDTO);
      expect(user).toEqual(mockUserDTO);
      expect(mockAuthRepoInstance.deleteSession).not.toHaveBeenCalled();
      expect(mockAuthRepoInstance.updateSessionExpiry).not.toHaveBeenCalled();
    });

     it('should return null session/user if session not found', async () => {
      mockAuthRepoInstance.findSessionWithUser.mockResolvedValue(null);

      const { session, user } = await authService.validateSession({ token: sessionToken });

      expect(mockAuthRepoInstance.findSessionWithUser).toHaveBeenCalledWith({ sessionId });
      expect(session).toBeNull();
      expect(user).toBeNull();
      expect(mockAuthRepoInstance.deleteSession).not.toHaveBeenCalled();
      expect(mockAuthRepoInstance.updateSessionExpiry).not.toHaveBeenCalled();
    });

    it('should delete session and return null if session is expired', async () => {
      const sessionData = { ...mockSessionWithUser, expires_at: expired };
      mockAuthRepoInstance.findSessionWithUser.mockResolvedValue(sessionData);
      mockAuthRepoInstance.deleteSession.mockResolvedValue({ count: 1n }); // Simulate successful delete

      const { session, user } = await authService.validateSession({ token: sessionToken });

      expect(mockAuthRepoInstance.findSessionWithUser).toHaveBeenCalledWith({ sessionId });
      expect(mockAuthRepoInstance.deleteSession).toHaveBeenCalledWith({ sessionId });
      expect(session).toBeNull();
      expect(user).toBeNull();
      expect(mockAuthRepoInstance.updateSessionExpiry).not.toHaveBeenCalled();
    });

    it('should renew session, return new token, and updated session details if near expiry threshold', async () => {
        // Set expiry just inside the renewal window (15 days)
        const nearExpiry = new Date(Date.now() + (14 * 24 * 60 * 60 * 1000)); // 14 days from now
        const sessionData = { ...mockSessionWithUser, id: sessionId, expires_at: nearExpiry }; // Start with old ID
        const updatedExpiry = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)); // Expected new expiry
        const newMockToken = 'new_mock_session_token';
        const newMockSessionId = 'new_hashed_session_id';

        // Mock crypto for the *new* token generation within this specific test
        vi.mocked(mockEncodeBase32).mockReturnValueOnce(newMockToken); // The next call to generateSessionToken
        vi.mocked(mockSha256).mockImplementation((input: Uint8Array) => {
            const text = new TextDecoder().decode(input);
            if (text === sessionToken) return new TextEncoder().encode('hashed_session_token_bytes'); // Original session ID lookup
            if (text === newMockToken) return new TextEncoder().encode('new_hashed_session_token_bytes'); // New session ID generation
            return new TextEncoder().encode('generic_hash_bytes'); 
        });
        vi.mocked(mockEncodeHexLowerCase).mockImplementation((input: Uint8Array) => {
            const text = new TextDecoder().decode(input);
            if (text === 'hashed_session_token_bytes') return sessionId;
            if (text === 'new_hashed_session_token_bytes') return newMockSessionId;
            return 'generic_hex_hash';
        });

        mockAuthRepoInstance.findSessionWithUser.mockResolvedValue(sessionData);
        mockAuthRepoInstance.updateSessionIdAndExpiry.mockResolvedValue({ count: 1n }); // Simulate successful update

        const { session, user, newToken } = await authService.validateSession({ token: sessionToken });

        expect(mockAuthRepoInstance.findSessionWithUser).toHaveBeenCalledWith({ sessionId });
        expect(mockAuthRepoInstance.updateSessionIdAndExpiry).toHaveBeenCalledWith({
            oldSessionId: sessionId,          // Expect the original session ID
            newSessionId: newMockSessionId,   // Expect the newly generated session ID
            expiresAt: expect.any(Date)       // Check it's a date, value checked below
        });
        
        // Check the new token was returned
        expect(newToken).toBe(newMockToken);

        // Check the returned session object has the *new* ID and expiry
        expect(session?.id).toBe(newMockSessionId);
        expect(session?.expires_at.getTime()).toBeGreaterThanOrEqual(updatedExpiry.getTime() - 1000);
        expect(session?.expires_at.getTime()).toBeLessThanOrEqual(updatedExpiry.getTime() + 1000);
        
        expect(user).toEqual(mockUserDTO);
        expect(mockAuthRepoInstance.deleteSession).not.toHaveBeenCalled();
        expect(mockAuthRepoInstance.updateSessionExpiry).not.toHaveBeenCalled(); // Ensure the old method wasn't called
    });
  });

  // --- Test requestPasswordReset ---
  describe('requestPasswordReset', () => {
     it('should find user, delete old tokens, create new token, and return plain token', async () => {
        mockAuthRepoInstance.findUserWithPasswordByEmail.mockResolvedValue(mockUser);
        mockAuthRepoInstance.deletePasswordResetTokensByUserId.mockResolvedValue({ count: 0n }); // Assume no old tokens
        mockAuthRepoInstance.createPasswordResetToken.mockResolvedValue(mockPasswordReset); // Simulate creation

        const result = await authService.requestPasswordReset({ email });

        expect(mockAuthRepoInstance.findUserWithPasswordByEmail).toHaveBeenCalledWith({ email });
        expect(mockAuthRepoInstance.deletePasswordResetTokensByUserId).toHaveBeenCalledWith({ userId });
        expect(mockAuthRepoInstance.createPasswordResetToken).toHaveBeenCalledWith({
            user_id: userId,
            hashed_token: resetTokenHashed, // From crypto mocks
            expires_at: expect.any(Date)
        });
        expect(result).toBe(resetTokenPlain); // From crypto mocks
     });

      it('should return null without error if user not found', async () => {
        mockAuthRepoInstance.findUserWithPasswordByEmail.mockResolvedValue(null);
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {}); // Suppress console output in test

        const result = await authService.requestPasswordReset({ email });

        expect(mockAuthRepoInstance.findUserWithPasswordByEmail).toHaveBeenCalledWith({ email });
        expect(mockAuthRepoInstance.deletePasswordResetTokensByUserId).not.toHaveBeenCalled();
        expect(mockAuthRepoInstance.createPasswordResetToken).not.toHaveBeenCalled();
        expect(result).toBeNull();
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('non-existent email'));
        consoleWarnSpy.mockRestore();
    });
  });

   // --- Test resetPassword ---
   describe('resetPassword', () => {
        const newPassword = 'newPassword123';
        const newPasswordHash = 'hashed_new_password';

        it('should reset password, delete token, verify email and invalidate sessions on valid token', async () => {
            mockAuthRepoInstance.findPasswordResetTokenByHashedToken.mockResolvedValue(mockPasswordReset);
            vi.mocked(mockHashPassword).mockResolvedValue(newPasswordHash);
            // Transaction mocks
            mockTxAuthRepoInstance.updateUserPassword.mockResolvedValue({ count: 1n });
            mockTxAuthRepoInstance.updateUserEmailVerified.mockResolvedValue({ count: 1n }); // Added email verification step
            mockTxAuthRepoInstance.deletePasswordResetToken.mockResolvedValue({ count: 1n });
            mockTxAuthRepoInstance.deleteAllUserSessions.mockResolvedValue({ count: 1n });

            await authService.resetPassword({ token: resetTokenPlain, newPassword });

            expect(mockAuthRepoInstance.findPasswordResetTokenByHashedToken).toHaveBeenCalledWith({ hashedToken: resetTokenHashed });
            expect(vi.mocked(mockHashPassword)).toHaveBeenCalledWith(newPassword);
            // Verify transaction executed
            expect(mockDb.transaction).toHaveBeenCalledTimes(1);
            expect(mockExecute).toHaveBeenCalledTimes(1);
            // Verify calls within transaction
            expect(mockTxAuthRepoInstance.updateUserPassword).toHaveBeenCalledWith({ userId: userId, passwordHash: newPasswordHash });
            expect(mockTxAuthRepoInstance.updateUserEmailVerified).toHaveBeenCalledWith({ userId: userId, verified: true }); // Verify this call
            expect(mockTxAuthRepoInstance.deletePasswordResetToken).toHaveBeenCalledWith({ tokenId: mockPasswordReset.id });
            expect(mockTxAuthRepoInstance.deleteAllUserSessions).toHaveBeenCalledWith({ userId: userId });
        });

         it('should throw error if reset token not found', async () => {
            mockAuthRepoInstance.findPasswordResetTokenByHashedToken.mockResolvedValue(null);

            await expect(authService.resetPassword({ token: resetTokenPlain, newPassword }))
                .rejects.toThrow(ApiError); // Expecting ApiError
            expect(mockAuthRepoInstance.findPasswordResetTokenByHashedToken).toHaveBeenCalledWith({ hashedToken: resetTokenHashed });
            expect(vi.mocked(mockHashPassword)).not.toHaveBeenCalled();
            expect(mockDb.transaction).not.toHaveBeenCalled();
         });

        it('should throw error and delete token if token is expired', async () => {
            const expiredResetRecord = { ...mockPasswordReset, expires_at: expired }; // Use Selectable type
            mockAuthRepoInstance.findPasswordResetTokenByHashedToken.mockResolvedValue(expiredResetRecord);
            // Mock deletion outside transaction (as done in service for expired check)
            mockAuthRepoInstance.deletePasswordResetToken.mockResolvedValue({ count: 1n });

            await expect(authService.resetPassword({ token: resetTokenPlain, newPassword }))
                .rejects.toThrow(ApiError); // Expecting ApiError for expiry
            expect(mockAuthRepoInstance.findPasswordResetTokenByHashedToken).toHaveBeenCalledWith({ hashedToken: resetTokenHashed });
            expect(mockAuthRepoInstance.deletePasswordResetToken).toHaveBeenCalledWith({ tokenId: expiredResetRecord.id }); // Should clean up expired token
            expect(vi.mocked(mockHashPassword)).not.toHaveBeenCalled();
            expect(mockDb.transaction).not.toHaveBeenCalled();
        });

        it('should throw error if transaction fails', async () => {
            const txError = new Error('Transaction failed');
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); // Suppress console output
            mockAuthRepoInstance.findPasswordResetTokenByHashedToken.mockResolvedValue(mockPasswordReset);
            vi.mocked(mockHashPassword).mockResolvedValue(newPasswordHash);
            // Make transaction execute fail
            mockExecute.mockRejectedValueOnce(txError);

            await expect(authService.resetPassword({ token: resetTokenPlain, newPassword }))
                .rejects.toThrow(ApiError); // Service wraps tx error in ApiError

            expect(mockAuthRepoInstance.findPasswordResetTokenByHashedToken).toHaveBeenCalledWith({ hashedToken: resetTokenHashed });
            expect(vi.mocked(mockHashPassword)).toHaveBeenCalledWith(newPassword);
            expect(mockDb.transaction).toHaveBeenCalledTimes(1);
            expect(mockExecute).toHaveBeenCalledTimes(1);
            expect(consoleErrorSpy).toHaveBeenCalled();
            consoleErrorSpy.mockRestore();
            // Check if repo methods within tx were called depends on where failure happened,
            // but in this setup, the execute itself fails before/during the callback.
        });
   });

    // --- Test verifyEmail ---
    describe('verifyEmail', () => {
        it('should verify email and delete token on valid token', async () => {
            mockAuthRepoInstance.findEmailVerificationTokenByValue.mockResolvedValue(mockEmailVerification);
            // Transaction mocks
            mockTxAuthRepoInstance.updateUserEmailVerified.mockResolvedValue({ count: 1n });
            mockTxAuthRepoInstance.deleteEmailVerificationToken.mockResolvedValue({ count: 1n });

            await authService.verifyEmail({ token: verificationToken });

            expect(mockAuthRepoInstance.findEmailVerificationTokenByValue).toHaveBeenCalledWith({ tokenValue: verificationToken });
            // Verify transaction executed
            expect(mockDb.transaction).toHaveBeenCalledTimes(1);
            expect(mockExecute).toHaveBeenCalledTimes(1);
            // Verify calls within transaction
            expect(mockTxAuthRepoInstance.updateUserEmailVerified).toHaveBeenCalledWith({ userId: userId, verified: true });
            expect(mockTxAuthRepoInstance.deleteEmailVerificationToken).toHaveBeenCalledWith({ tokenId: mockEmailVerification.id });
        });

        it('should throw error if verification token not found', async () => {
            mockAuthRepoInstance.findEmailVerificationTokenByValue.mockResolvedValue(null);

            await expect(authService.verifyEmail({ token: verificationToken }))
                .rejects.toThrow(ApiError); // Expecting ApiError
            expect(mockAuthRepoInstance.findEmailVerificationTokenByValue).toHaveBeenCalledWith({ tokenValue: verificationToken });
            expect(mockDb.transaction).not.toHaveBeenCalled();
        });

         it('should throw error if verification token is expired', async () => {
            const expiredVerification = { ...mockEmailVerification, expires_at: expired }; // Use Selectable type
            mockAuthRepoInstance.findEmailVerificationTokenByValue.mockResolvedValue(expiredVerification);

            await expect(authService.verifyEmail({ token: verificationToken }))
                .rejects.toThrow(ApiError); // Expecting ApiError for expiry
            expect(mockAuthRepoInstance.findEmailVerificationTokenByValue).toHaveBeenCalledWith({ tokenValue: verificationToken });
            // No cleanup mentioned for expired verification tokens in service, unlike password reset
            expect(mockDb.transaction).not.toHaveBeenCalled();
         });

         it('should throw error if transaction fails', async () => {
            const txError = new Error('Transaction failed');
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); // Suppress console output
            mockAuthRepoInstance.findEmailVerificationTokenByValue.mockResolvedValue(mockEmailVerification);
            // Make transaction execute fail
            mockExecute.mockRejectedValueOnce(txError);

            await expect(authService.verifyEmail({ token: verificationToken }))
                .rejects.toThrow(ApiError); // Service wraps tx error in ApiError

            expect(mockAuthRepoInstance.findEmailVerificationTokenByValue).toHaveBeenCalledWith({ tokenValue: verificationToken });
            expect(mockDb.transaction).toHaveBeenCalledTimes(1);
            expect(mockExecute).toHaveBeenCalledTimes(1);
            expect(consoleErrorSpy).toHaveBeenCalled();
            consoleErrorSpy.mockRestore();
         });
    });

    // --- Test handleOAuthCallback ---
    describe('handleOAuthCallback', () => {
        const oauthDetails: OAuthUserDetails = {
            provider: 'github',
            providerUserId: 'github-123',
            email: 'oauth@example.com',
            username: 'oauthuser',
        };
        const oauthDetailsNoEmail: OAuthUserDetails = {
            provider: 'github',
            providerUserId: 'github-456',
            email: null,
            username: 'oauthnoemail',
        };
        // Use Selectable<AuthUser> for created user data
        const createdOauthUser: Selectable<AuthUser> = {
            id: 2,
            email: oauthDetails.email!,
            username: oauthDetails.username,
            password_hash: 'oauth_no_password',
            email_verified: true, // Assumed verified from OAuth
            created_at: now,
            // updated_at removed
            role: 'USER',
            recovery_code: null
        };

        it('should find user by provider ID and create session if OAuth link exists', async () => {
            const existingOauthUser: Selectable<AuthUser> = { ...mockUser, id: 3 }; // Use Selectable<AuthUser> for repo return
            mockAuthRepoInstance.findUserByProviderId.mockResolvedValue(existingOauthUser);
            mockAuthRepoInstance.createSession.mockResolvedValue({ ...mockSession, user_id: existingOauthUser.id });

            const result = await authService.handleOAuthCallback(oauthDetails);

            expect(mockAuthRepoInstance.findUserByProviderId).toHaveBeenCalledWith({
                provider: oauthDetails.provider,
                providerUserId: oauthDetails.providerUserId
            });
            expect(mockAuthRepoInstance.findUserWithPasswordByEmail).not.toHaveBeenCalled();
            expect(mockDb.transaction).not.toHaveBeenCalled();
             // Check createSession call with the correct STRUCTURE
            expect(mockAuthRepoInstance.createSession).toHaveBeenCalledWith(expect.objectContaining({ session: expect.objectContaining({ user_id: existingOauthUser.id }) }));
            // Return value should be the Selectable<AuthUser> shape as per service return type
            expect(result.user).toEqual(existingOauthUser);
            expect(result.sessionToken).toBe(sessionToken);
        });

        it('should find user by email, link account, and create session if no OAuth link but email matches', async () => {
            mockAuthRepoInstance.findUserByProviderId.mockResolvedValue(null); // No existing link
            mockAuthRepoInstance.findUserWithPasswordByEmail.mockResolvedValue(mockUser); // Found by email (returns Selectable<AuthUser>)
            // Mock linkOAuthAccount return with the expected shape (Selectable<AuthOauthAccount>)
            const specificMockLinkedAccount: Selectable<AuthOauthAccount> = { ...mockLinkedAccount, user_id: mockUser.id, provider: 'github', provider_user_id: 'github-123' };
            mockAuthRepoInstance.linkOAuthAccount.mockResolvedValue(specificMockLinkedAccount);
            mockAuthRepoInstance.findUserById.mockResolvedValue(mockUser); // Refetch user (returns Selectable<AuthUser>)
            mockAuthRepoInstance.createSession.mockResolvedValue(mockSession); // Restore correct mock resolved value

            const result = await authService.handleOAuthCallback(oauthDetails);

            expect(mockAuthRepoInstance.findUserByProviderId).toHaveBeenCalledWith({ provider: oauthDetails.provider, providerUserId: oauthDetails.providerUserId });
            expect(mockAuthRepoInstance.findUserWithPasswordByEmail).toHaveBeenCalledWith({ email: oauthDetails.email });
            expect(mockAuthRepoInstance.linkOAuthAccount).toHaveBeenCalledWith({
                account: {
                    user_id: mockUser.id,
                    provider: oauthDetails.provider,
                    provider_user_id: oauthDetails.providerUserId,
                }
            });
            expect(mockAuthRepoInstance.findUserById).toHaveBeenCalledWith(mockUser.id); // Refetch uses ID
            // Check createSession call with the correct STRUCTURE
            expect(mockAuthRepoInstance.createSession).toHaveBeenCalledWith(expect.objectContaining({ session: expect.objectContaining({ user_id: mockUser.id }) }));
             // Return value should be the Selectable<AuthUser> shape
            expect(result.user).toEqual(mockUser);
            expect(result.sessionToken).toBe(sessionToken);
        });

        it('should create user, org, membership, link account in transaction, and create session if user not found', async () => {
            mockAuthRepoInstance.findUserByProviderId.mockResolvedValue(null); // No link
            mockAuthRepoInstance.findUserWithPasswordByEmail.mockResolvedValue(null); // No email match

            // Transaction mocks
            mockTxAuthRepoInstance.createUser.mockResolvedValue(createdOauthUser); // Returns Selectable<AuthUser>
            mockOrgRepoInstance.createOrganization.mockResolvedValue(mockOrg);
            mockOrgRepoInstance.createMembership.mockResolvedValue(mockMembership);
             // Mock linkOAuthAccount return within transaction
            const mockLinkedAccountTx: Selectable<AuthOauthAccount> = { ...mockLinkedAccount, id: 101, user_id: createdOauthUser.id, provider: 'github', provider_user_id: 'github-123' };
            mockTxAuthRepoInstance.linkOAuthAccount.mockResolvedValue(mockLinkedAccountTx);
            // Mock the final findUserById within the transaction
            mockTxAuthRepoInstance.findUserById.mockResolvedValue(createdOauthUser); // Returns Selectable<AuthUser>

            // Session creation (outside transaction)
            mockAuthRepoInstance.createSession.mockResolvedValue({ ...mockSession, user_id: createdOauthUser.id });

            const result = await authService.handleOAuthCallback(oauthDetails);

            expect(mockAuthRepoInstance.findUserByProviderId).toHaveBeenCalledWith({ provider: oauthDetails.provider, providerUserId: oauthDetails.providerUserId });
            expect(mockAuthRepoInstance.findUserWithPasswordByEmail).toHaveBeenCalledWith({ email: oauthDetails.email });

            // Verify transaction
            expect(mockDb.transaction).toHaveBeenCalledTimes(1);
            expect(mockExecute).toHaveBeenCalledTimes(1);

            // Verify calls within transaction
            expect(mockTxAuthRepoInstance.createUser).toHaveBeenCalledWith({
                user: expect.objectContaining({
                    email: oauthDetails.email,
                    username: oauthDetails.username,
                    password_hash: 'oauth_no_password',
                    email_verified: true,
                    role: 'USER'
                })
            });
            expect(mockOrgRepoInstance.createOrganization).toHaveBeenCalledWith({ name: `${createdOauthUser.username}'s org` });
            expect(mockOrgRepoInstance.createMembership).toHaveBeenCalledWith({
                organization_id: mockOrg.id,
                user_id: createdOauthUser.id,
                is_default: true,
                role: 'owner'
            });
             expect(mockTxAuthRepoInstance.linkOAuthAccount).toHaveBeenCalledWith({
                account: {
                    user_id: createdOauthUser.id,
                    provider: oauthDetails.provider,
                    provider_user_id: oauthDetails.providerUserId,
                }
            });

            // Verify session creation (outside tx)
             // Check createSession call with the correct STRUCTURE
            expect(mockAuthRepoInstance.createSession).toHaveBeenCalledWith(expect.objectContaining({ session: expect.objectContaining({ user_id: createdOauthUser.id }) }));
            // Return value should be the Selectable<AuthUser> shape
            expect(result.user).toEqual(createdOauthUser);
            expect(result.sessionToken).toBe(sessionToken);
        });

        it('should throw oauthEmailRequired error if OAuth details have no email and user cannot be found', async () => {
            mockAuthRepoInstance.findUserByProviderId.mockResolvedValue(null); // No link

            await expect(authService.handleOAuthCallback(oauthDetailsNoEmail))
                .rejects.toThrow('OAuth email required mock for github');

            expect(mockAuthRepoInstance.findUserByProviderId).toHaveBeenCalledWith({
                provider: oauthDetailsNoEmail.provider,
                providerUserId: oauthDetailsNoEmail.providerUserId
            });
            // Should not attempt email lookup if email is null
            expect(mockAuthRepoInstance.findUserWithPasswordByEmail).not.toHaveBeenCalled();
            expect(mockDb.transaction).not.toHaveBeenCalled();
            expect(mockErrors.auth.oauthEmailRequired).toHaveBeenCalledWith({ provider: oauthDetailsNoEmail.provider });
        });

        it('should re-throw ApiError if transaction fails during user creation', async () => {
             mockAuthRepoInstance.findUserByProviderId.mockResolvedValue(null); // No link
             mockAuthRepoInstance.findUserWithPasswordByEmail.mockResolvedValue(null); // No email match
             const txError = new Error("DB constraint failed");
             const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); // Suppress console output
             // Make one of the transactional calls fail
             mockTxAuthRepoInstance.createUser.mockRejectedValue(txError);

             await expect(authService.handleOAuthCallback(oauthDetails))
                .rejects.toThrow(ApiError); // Service should wrap the error

             expect(mockDb.transaction).toHaveBeenCalledTimes(1);
             expect(mockExecute).toHaveBeenCalledTimes(1);
             expect(mockTxAuthRepoInstance.createUser).toHaveBeenCalled(); // It was attempted
             expect(mockOrgRepoInstance.createOrganization).not.toHaveBeenCalled(); // Should not proceed
             expect(mockAuthRepoInstance.createSession).not.toHaveBeenCalled(); // No session created
             expect(consoleErrorSpy).toHaveBeenCalled();
             consoleErrorSpy.mockRestore();
        });
    });
});
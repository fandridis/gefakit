import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Kysely, Transaction, Selectable } from 'kysely';
import { createAuthService, AuthService, OAuthUserDetails } from './auth.service';
import { AuthRepository } from './auth.repository';
import { OrganizationRepository } from '../organizations/organization.repository';
import { DB, AuthUser, AuthSession, AuthPasswordResetToken, AuthEmailVerification, OrganizationsOrganization, OrganizationsMembership, AuthOauthAccount } from '../../db/db-types';
import { UserDTO, SessionDTO,} from '@gefakit/shared';
import { randomUUID } from 'node:crypto'; // Added static import

// --- Mock Dependencies ---

// --- Mock Data --- Moved up
const userId = 1;
const email = 'delivered@resend.dev';
const password = 'password123';
const passwordHash = 'hashed_password';
const sessionToken = 'mockbase32token';
const sessionId = 'hashed_session_token';
const resetTokenPlain = 'mockbase64urltoken';
const resetTokenHashed = 'hashed_reset_token';
const verificationToken = 'verify-token-abc';
const verificationTokenHashed = 'hashed_verify_token_hex';
const now = new Date();
const expiresSoon = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
const expiresFar = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
const expired = new Date(Date.now() - 1000);

const mockUser: Selectable<AuthUser> = {
  id: userId,
  email: email,
  username: 'testuser',
  password_hash: passwordHash,
  email_verified: true,
  created_at: now,
  role: 'USER',
};
const mockUserUnverified: Selectable<AuthUser> = { ...mockUser, email_verified: false };
const mockSession: Selectable<AuthSession> = {
  id: sessionId,
  user_id: userId,
  expires_at: expiresFar,
  impersonator_user_id: null,
  active_organization_id: null,
};

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
  role: 'USER'
};

  type SessionWithUserResult = Selectable<AuthSession> & Pick<Selectable<AuthUser>, 'email' | 'username' | 'created_at' | 'email_verified' | 'role'>
  const mockSessionWithUser: SessionWithUserResult = {
    id: sessionId,
    user_id: userId,
    expires_at: expiresFar,
    impersonator_user_id: null,
    active_organization_id: null,
    email: email,
    username: 'testuser',
    created_at: now,
    email_verified: true,
    role: 'USER'
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
      value: verificationTokenHashed,
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
  const mockLinkedAccount: Selectable<AuthOauthAccount> = {
      id: 100,
      user_id: userId,
      provider: 'github',
      provider_user_id: 'github-123',
      created_at: now,
      updated_at: now
  };


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
  encodeHexLowerCase: vi.fn((input) => Buffer.from(input).toString('hex')), 
  encodeBase32LowerCaseNoPadding: vi.fn(() => 'mockbase32token'),
  encodeBase64url: vi.fn(() => 'mockbase64urltoken'),
}));

const originalCrypto = (global as any).crypto;
const mockGetRandomValues = vi.fn((array: Uint8Array) => {
    // Fill with non-zero values for testing if needed
    for (let i = 0; i < array.length; i++) {
        array[i] = i + 1;
    }
    return array;
});

// Mock randomUUID from node:crypto
vi.mock('node:crypto', async (importOriginal) => {
    const actual = await importOriginal() as typeof import('node:crypto');
    return {
        ...actual,
        randomUUID: vi.fn(() => verificationToken),
    };
});

// 5. Import Mocked Functions/Modules AFTER mocks
import { createAuthRepository as mockCreateAuthRepositoryFn } from './auth.repository';
import { createOrganizationRepository as mockCreateOrganizationRepositoryFn } from '../organizations/organization.repository';
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
  updateSessionIdAndExpiry: ReturnType<typeof vi.fn>;
  deleteAllUserSessions: ReturnType<typeof vi.fn>;
  findPasswordResetTokenByHashedToken: ReturnType<typeof vi.fn>;
  createPasswordResetToken: ReturnType<typeof vi.fn>;
  deletePasswordResetToken: ReturnType<typeof vi.fn>;
  deletePasswordResetTokensByUserId: ReturnType<typeof vi.fn>; 
  updateUserPassword: ReturnType<typeof vi.fn>;
  findEmailVerificationTokenByValue: ReturnType<typeof vi.fn>;
  createEmailVerificationToken: ReturnType<typeof vi.fn>;
  deleteEmailVerificationTokensByUserId: ReturnType<typeof vi.fn>;
  updateUserEmailVerified: ReturnType<typeof vi.fn>;
  deleteEmailVerificationToken: ReturnType<typeof vi.fn>;
  findUserByProviderId: ReturnType<typeof vi.fn>;
  linkOAuthAccount: ReturnType<typeof vi.fn>;
  createUser: ReturnType<typeof vi.fn>;
};

type MockOrganizationRepositoryInstance = {
    createOrganization: ReturnType<typeof vi.fn>;
    createMembership: ReturnType<typeof vi.fn>;
};

describe('AuthService', () => {
  let authService: AuthService;
  let mockAuthRepoInstance: MockAuthRepositoryInstance;
  let mockTxAuthRepoInstance: MockAuthRepositoryInstance;
  let mockOrgRepoInstance: MockOrganizationRepositoryInstance;
  let mockAuthRepoFactory: ReturnType<typeof vi.fn>;
  let mockOrgRepoFactory: ReturnType<typeof vi.fn>;

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
      updateSessionIdAndExpiry: vi.fn(),
      deleteAllUserSessions: vi.fn(),
      findPasswordResetTokenByHashedToken: vi.fn(),
      createPasswordResetToken: vi.fn(),
      deletePasswordResetToken: vi.fn(),
      deletePasswordResetTokensByUserId: vi.fn(),
      updateUserPassword: vi.fn(),
      findEmailVerificationTokenByValue: vi.fn(),
      createEmailVerificationToken: vi.fn(),
      deleteEmailVerificationTokensByUserId: vi.fn(),
      updateUserEmailVerified: vi.fn(),
      deleteEmailVerificationToken: vi.fn(),
      findUserByProviderId: vi.fn(),
      linkOAuthAccount: vi.fn(),
      createUser: vi.fn(),
    };
     mockTxAuthRepoInstance = {
      findUserById: vi.fn(),
      findUserWithPasswordByEmail: vi.fn(),
      findSessionWithUser: vi.fn(),
      createSession: vi.fn(),
      deleteSession: vi.fn(),
      updateSessionIdAndExpiry: vi.fn(),
      deleteAllUserSessions: vi.fn(),
      findPasswordResetTokenByHashedToken: vi.fn(),
      createPasswordResetToken: vi.fn(),
      deletePasswordResetToken: vi.fn(),
      deletePasswordResetTokensByUserId: vi.fn(),
      updateUserPassword: vi.fn(),
      findEmailVerificationTokenByValue: vi.fn(),
      createEmailVerificationToken: vi.fn(),
      deleteEmailVerificationTokensByUserId: vi.fn(),
      updateUserEmailVerified: vi.fn(),
      deleteEmailVerificationToken: vi.fn(),
      findUserByProviderId: vi.fn(),
      linkOAuthAccount: vi.fn(),
      createUser: vi.fn(),
    };
    mockOrgRepoInstance = {
        createOrganization: vi.fn(),
        createMembership: vi.fn(),
    };

    mockAuthRepoFactory = vi.mocked(mockCreateAuthRepositoryFn);
    mockOrgRepoFactory = vi.mocked(mockCreateOrganizationRepositoryFn);

    // Configure factory mocks
    mockAuthRepoFactory.mockImplementation(({ db: transactionObject }) => {
        if (transactionObject === mockTrx) {
            return mockTxAuthRepoInstance as unknown as AuthRepository;
        }
        return mockAuthRepoInstance as unknown as AuthRepository;
    });
     mockOrgRepoFactory.mockImplementation(({ db: transactionObject }) => {
        if (transactionObject === mockTrx) {
            return mockOrgRepoInstance as unknown as OrganizationRepository;
        }
        return mockOrgRepoInstance as unknown as OrganizationRepository;
    });

    vi.mocked(mockSha256).mockImplementation((input: Uint8Array) => {
        const text = new TextDecoder().decode(input);
        if (text === sessionToken) return new TextEncoder().encode('hashed_session_token_bytes');
        if (text === resetTokenPlain) return new TextEncoder().encode('hashed_reset_token_bytes');
        if (text === verificationToken) return new TextEncoder().encode('hashed_verify_token_bytes');
        return new TextEncoder().encode('generic_hash_bytes');
    });
    vi.mocked(mockEncodeHexLowerCase).mockImplementation((input: Uint8Array) => {
        const text = new TextDecoder().decode(input);
        if (text === 'hashed_session_token_bytes') return sessionId;
        if (text === 'hashed_reset_token_bytes') return resetTokenHashed;
        if (text === 'hashed_verify_token_bytes') return verificationTokenHashed;
        return 'generic_hex_hash';
    });
    vi.mocked(mockEncodeBase32).mockReturnValue(sessionToken);
    vi.mocked(mockEncodeBase64url).mockReturnValue(resetTokenPlain);

    authService = createAuthService({
        db: mockDb,
        authRepository: mockAuthRepoInstance as unknown as AuthRepository,
        createAuthRepository: mockAuthRepoFactory,
        createOrganizationRepository: mockOrgRepoFactory,
    });
  });

   afterEach(() => {
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
      expect({...result.user}).toEqual({...mockUserDTO});
      expect(result.sessionToken).toBe(sessionToken); // Ensure crypto mocks generate this
      // expect(mockErrors.auth.invalidCredentials).not.toHaveBeenCalled();
      // expect(mockErrors.auth.emailNotVerified).not.toHaveBeenCalled();
    });

     it('should throw invalidCredentials if user not found', async () => {
      mockAuthRepoInstance.findUserWithPasswordByEmail.mockResolvedValue(null);

      await expect(authService.signInWithEmail({ email, password }))
        .rejects.toThrow('Invalid credentials');

      expect(mockAuthRepoInstance.findUserWithPasswordByEmail).toHaveBeenCalledWith({ email });
      expect(vi.mocked(mockVerifyPassword)).not.toHaveBeenCalled();
      expect(mockAuthRepoInstance.createSession).not.toHaveBeenCalled();
     //  expect(mockErrors.auth.invalidCredentials).toHaveBeenCalledTimes(1);
    });

    it('should throw emailNotVerified if user email is not verified', async () => {
      mockAuthRepoInstance.findUserWithPasswordByEmail.mockResolvedValue(mockUserUnverified);

      await expect(authService.signInWithEmail({ email, password }))
        .rejects.toThrow('Email not verified');

      expect(mockAuthRepoInstance.findUserWithPasswordByEmail).toHaveBeenCalledWith({ email });
      expect(vi.mocked(mockVerifyPassword)).not.toHaveBeenCalled();
       expect(mockAuthRepoInstance.createSession).not.toHaveBeenCalled();
     // expect(mockErrors.auth.emailNotVerified).toHaveBeenCalledTimes(1);
    });

    it('should throw invalidCredentials if password verification fails', async () => {
      mockAuthRepoInstance.findUserWithPasswordByEmail.mockResolvedValue(mockUser);
      vi.mocked(mockVerifyPassword).mockResolvedValue(false);

      await expect(authService.signInWithEmail({ email, password }))
        .rejects.toThrow('Invalid credentials');

      expect(mockAuthRepoInstance.findUserWithPasswordByEmail).toHaveBeenCalledWith({ email });
       // Expect verifyPassword to be called with correct hash from mockUser
      expect(vi.mocked(mockVerifyPassword)).toHaveBeenCalledWith(password, mockUser.password_hash);
       expect(mockAuthRepoInstance.createSession).not.toHaveBeenCalled();
     //  expect(mockErrors.auth.invalidCredentials).toHaveBeenCalledTimes(1);
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
    });

     it('should return null session/user if session not found', async () => {
      mockAuthRepoInstance.findSessionWithUser.mockResolvedValue(null);

      const { session, user } = await authService.validateSession({ token: sessionToken });

      expect(mockAuthRepoInstance.findSessionWithUser).toHaveBeenCalledWith({ sessionId });
      expect(session).toBeNull();
      expect(user).toBeNull();
      expect(mockAuthRepoInstance.deleteSession).not.toHaveBeenCalled();
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
            oldSessionId: sessionId,
            newSessionId: newMockSessionId,
            expiresAt: expect.any(Date)
        });
        
        // Check the new token was returned
        expect(newToken).toBe(newMockToken);

        // Check the returned session object has the *new* ID and expiry
        expect(session?.id).toBe(newMockSessionId);
        expect(session?.expires_at.getTime()).toBeGreaterThanOrEqual(updatedExpiry.getTime() - 1000);
        expect(session?.expires_at.getTime()).toBeLessThanOrEqual(updatedExpiry.getTime() + 1000);
        
        expect(user).toEqual(mockUserDTO);
        expect(mockAuthRepoInstance.deleteSession).not.toHaveBeenCalled();
    });
  });

  // --- Test requestPasswordReset ---
  describe('requestPasswordReset', () => {
     it('should find user, delete old tokens, create new token, and return plain token', async () => {
        mockAuthRepoInstance.findUserWithPasswordByEmail.mockResolvedValue(mockUser);
        mockAuthRepoInstance.deletePasswordResetTokensByUserId.mockResolvedValue({ count: 0n });
        mockAuthRepoInstance.createPasswordResetToken.mockResolvedValue(mockPasswordReset);

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
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

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
            mockTxAuthRepoInstance.updateUserEmailVerified.mockResolvedValue({ count: 1n })
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
            expect(mockTxAuthRepoInstance.updateUserEmailVerified).toHaveBeenCalledWith({ userId: userId, verified: true });
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
            const expiredResetRecord = { ...mockPasswordReset, expires_at: expired };
            mockAuthRepoInstance.findPasswordResetTokenByHashedToken.mockResolvedValue(expiredResetRecord);
            // Mock deletion outside transaction (as done in service for expired check)
            mockAuthRepoInstance.deletePasswordResetToken.mockResolvedValue({ count: 1n });

            await expect(authService.resetPassword({ token: resetTokenPlain, newPassword }))
                .rejects.toThrow(ApiError); // Expecting ApiError for expiry
            expect(mockAuthRepoInstance.findPasswordResetTokenByHashedToken).toHaveBeenCalledWith({ hashedToken: resetTokenHashed });
            expect(mockAuthRepoInstance.deletePasswordResetToken).toHaveBeenCalledWith({ tokenId: expiredResetRecord.id });
            expect(vi.mocked(mockHashPassword)).not.toHaveBeenCalled();
            expect(mockDb.transaction).not.toHaveBeenCalled();
        });

        it('should throw error if transaction fails', async () => {
            const txError = new Error('Transaction failed');
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
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

            expect(mockAuthRepoInstance.findEmailVerificationTokenByValue).toHaveBeenCalledWith({ tokenValue: verificationTokenHashed });
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
            expect(mockAuthRepoInstance.findEmailVerificationTokenByValue).toHaveBeenCalledWith({ tokenValue: verificationTokenHashed });
            expect(mockDb.transaction).not.toHaveBeenCalled();
        });

         it('should throw error if verification token is expired', async () => {
            const expiredVerification = { ...mockEmailVerification, expires_at: expired };
            mockAuthRepoInstance.findEmailVerificationTokenByValue.mockResolvedValue(expiredVerification);

            await expect(authService.verifyEmail({ token: verificationToken }))
                .rejects.toThrow(ApiError); // Expecting ApiError for expiry
            expect(mockAuthRepoInstance.findEmailVerificationTokenByValue).toHaveBeenCalledWith({ tokenValue: verificationTokenHashed });
            // No cleanup mentioned for expired verification tokens in service, unlike password reset
            expect(mockDb.transaction).not.toHaveBeenCalled();
         });

         it('should throw error if transaction fails', async () => {
            const txError = new Error('Transaction failed');
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            mockAuthRepoInstance.findEmailVerificationTokenByValue.mockResolvedValue(mockEmailVerification);
            // Make transaction execute fail
            mockExecute.mockRejectedValueOnce(txError);

            await expect(authService.verifyEmail({ token: verificationToken }))
                .rejects.toThrow(ApiError);

            expect(mockAuthRepoInstance.findEmailVerificationTokenByValue).toHaveBeenCalledWith({ tokenValue: verificationTokenHashed });
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
        };

        it('should find user by provider ID and create session if OAuth link exists', async () => {
            const existingOauthUser: Selectable<AuthUser> = { ...mockUser, id: 3 };
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
            mockAuthRepoInstance.findUserByProviderId.mockResolvedValue(null);
            mockAuthRepoInstance.findUserWithPasswordByEmail.mockResolvedValue(mockUser);
            // Mock linkOAuthAccount return with the expected shape (Selectable<AuthOauthAccount>)
            const specificMockLinkedAccount: Selectable<AuthOauthAccount> = { ...mockLinkedAccount, user_id: mockUser.id, provider: 'github', provider_user_id: 'github-123' };
            mockAuthRepoInstance.linkOAuthAccount.mockResolvedValue(specificMockLinkedAccount);
            mockAuthRepoInstance.findUserById.mockResolvedValue(mockUser);
            mockAuthRepoInstance.createSession.mockResolvedValue(mockSession);

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
            expect(mockAuthRepoInstance.findUserById).toHaveBeenCalledWith(mockUser.id);
            // Check createSession call with the correct STRUCTURE
            expect(mockAuthRepoInstance.createSession).toHaveBeenCalledWith(expect.objectContaining({ session: expect.objectContaining({ user_id: mockUser.id }) }));
             // Return value should be the Selectable<AuthUser> shape
            expect(result.user).toEqual(mockUser);
            expect(result.sessionToken).toBe(sessionToken);
        });

        it('should create user, org, membership, link account in transaction, and create session if user not found', async () => {
            mockAuthRepoInstance.findUserByProviderId.mockResolvedValue(null);
            mockAuthRepoInstance.findUserWithPasswordByEmail.mockResolvedValue(null);

            // Transaction mocks
            mockTxAuthRepoInstance.createUser.mockResolvedValue(createdOauthUser);
            mockOrgRepoInstance.createOrganization.mockResolvedValue(mockOrg);
            mockOrgRepoInstance.createMembership.mockResolvedValue(mockMembership);
             // Mock linkOAuthAccount return within transaction
            const mockLinkedAccountTx: Selectable<AuthOauthAccount> = { ...mockLinkedAccount, id: 101, user_id: createdOauthUser.id, provider: 'github', provider_user_id: 'github-123' };
            mockTxAuthRepoInstance.linkOAuthAccount.mockResolvedValue(mockLinkedAccountTx);
            mockTxAuthRepoInstance.findUserById.mockResolvedValue(createdOauthUser);

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
                .rejects.toThrow('An email address is required to sign up or link your github account. Please ensure your github account has a public email address or try another sign-in method');

            expect(mockAuthRepoInstance.findUserByProviderId).toHaveBeenCalledWith({
                provider: oauthDetailsNoEmail.provider,
                providerUserId: oauthDetailsNoEmail.providerUserId
            });
            // Should not attempt email lookup if email is null
            expect(mockAuthRepoInstance.findUserWithPasswordByEmail).not.toHaveBeenCalled();
            expect(mockDb.transaction).not.toHaveBeenCalled();
            // expect(mockErrors.auth.oauthEmailRequired).toHaveBeenCalledWith({ provider: oauthDetailsNoEmail.provider });
        });

        it('should re-throw ApiError if transaction fails during user creation', async () => {
             mockAuthRepoInstance.findUserByProviderId.mockResolvedValue(null);
             mockAuthRepoInstance.findUserWithPasswordByEmail.mockResolvedValue(null);
             const txError = new Error("DB constraint failed");
             const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
             mockTxAuthRepoInstance.createUser.mockRejectedValue(txError);

             await expect(authService.handleOAuthCallback(oauthDetails))
                .rejects.toThrow(ApiError);

             expect(mockDb.transaction).toHaveBeenCalledTimes(1);
             expect(mockExecute).toHaveBeenCalledTimes(1);
             expect(mockTxAuthRepoInstance.createUser).toHaveBeenCalled();
             expect(mockOrgRepoInstance.createOrganization).not.toHaveBeenCalled();
             expect(mockAuthRepoInstance.createSession).not.toHaveBeenCalled();
             expect(consoleErrorSpy).toHaveBeenCalled();
             consoleErrorSpy.mockRestore();
        });
    });

    // --- Test resendVerificationEmail ---
    describe('resendVerificationEmail', () => {
        const mockCreatedVerification: Selectable<AuthEmailVerification> = {
            id: 2,
            user_id: mockUserUnverified.id,
            value: verificationTokenHashed,
            expires_at: expect.any(Date),
            identifier: mockUserUnverified.email!,
            created_at: expect.any(Date),
            updated_at: expect.any(Date)
        };

        it('should return null if user not found', async () => {
            mockAuthRepoInstance.findUserWithPasswordByEmail.mockResolvedValue(null);

            const result = await authService.resendVerificationEmail({ email: mockUserUnverified.email! });

            expect(result).toBeNull();
            expect(mockAuthRepoInstance.findUserWithPasswordByEmail).toHaveBeenCalledWith({ email: mockUserUnverified.email });
            expect(mockDb.transaction).not.toHaveBeenCalled();
        });

        it('should return null if user email is already verified', async () => {
            mockAuthRepoInstance.findUserWithPasswordByEmail.mockResolvedValue(mockUser);

            const result = await authService.resendVerificationEmail({ email: mockUser.email! });

            expect(result).toBeNull();
            expect(mockAuthRepoInstance.findUserWithPasswordByEmail).toHaveBeenCalledWith({ email: mockUser.email });
            expect(mockDb.transaction).not.toHaveBeenCalled();
        });

        it('should delete old tokens, create new token (hashed), and return plain token for unverified user', async () => {
            mockAuthRepoInstance.findUserWithPasswordByEmail.mockResolvedValue(mockUserUnverified);
            // Transaction mocks
            mockTxAuthRepoInstance.deleteEmailVerificationTokensByUserId.mockResolvedValue({ count: 1n });
            mockTxAuthRepoInstance.createEmailVerificationToken.mockResolvedValue(mockCreatedVerification);


            const result = await authService.resendVerificationEmail({ email: mockUserUnverified.email! });

            expect(mockAuthRepoInstance.findUserWithPasswordByEmail).toHaveBeenCalledWith({ email: mockUserUnverified.email });
             // Verify transaction executed
            expect(mockDb.transaction).toHaveBeenCalledTimes(1);
            expect(mockExecute).toHaveBeenCalledTimes(1);
            // Verify calls within transaction
            expect(mockTxAuthRepoInstance.deleteEmailVerificationTokensByUserId).toHaveBeenCalledWith({ userId: mockUserUnverified.id });
            expect(mockTxAuthRepoInstance.createEmailVerificationToken).toHaveBeenCalledWith({
                user_id: mockUserUnverified.id,
                value: verificationTokenHashed,
                identifier: mockUserUnverified.email,
                expires_at: expect.any(Date)
            });
            expect(result).toEqual({
                user: mockUserUnverified,
                verificationToken: verificationToken
            });
            expect(vi.mocked(randomUUID)).toHaveBeenCalledTimes(1);
        });

        it('should return null if transaction fails', async () => {
            const txError = new Error("DB error during resend");
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            mockAuthRepoInstance.findUserWithPasswordByEmail.mockResolvedValue(mockUserUnverified);
            mockExecute.mockRejectedValueOnce(txError);

            const result = await authService.resendVerificationEmail({ email: mockUserUnverified.email! });

            expect(result).toBeNull();
            expect(mockAuthRepoInstance.findUserWithPasswordByEmail).toHaveBeenCalledWith({ email: mockUserUnverified.email });
            expect(mockDb.transaction).toHaveBeenCalledTimes(1);
            expect(mockExecute).toHaveBeenCalledTimes(1);
            expect(consoleErrorSpy).toHaveBeenCalled();
            consoleErrorSpy.mockRestore();
        });
    });
});
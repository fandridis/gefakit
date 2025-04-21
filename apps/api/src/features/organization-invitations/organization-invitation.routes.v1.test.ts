import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { organizationInvitationRoutesV1 } from './organization-invitation.routes.v1';
import { OrganizationInvitationService } from './organization-invitation.service';
import { OrganizationService } from '../organizations/organization.service'; // Needed for middleware setup
import { UserDTO } from '@gefakit/shared';
import { AppError } from '../../errors/app-error';
import { Bindings } from '../../types/hono';
import { Kysely, Selectable } from 'kysely';
import { DB, OrganizationsInvitation } from '../../db/db-types';
import { ZodError } from 'zod';
import { DbMiddleWareVariables } from '../../middleware/db'; // Assuming this type exists
import { AuthMiddleWareVariables } from '../../middleware/auth'; // Assuming this type exists

// --- Define Types Matching Route Variables ---
type OrganizationInvitationRouteVariables = DbMiddleWareVariables & AuthMiddleWareVariables & {
  organizationInvitationService: OrganizationInvitationService;
  organizationService: OrganizationService; // Included as it's in the original route type
  // Note: AuthService isn't directly set in variables but used by OrgInvitationService setup
};

// --- Define Expected JSON Response Structures ---
interface ErrorResponse {
  ok: false;
  errors?: { field: string; message: string }[];
  errorMessage?: string;
  errorDetails?: any;
  error?: string;
}

// Define CoreInvitation type based on DB schema if not already shared
type CoreInvitation = Selectable<OrganizationsInvitation>;

interface GetInvitationsResponse { invitations: CoreInvitation[] }
interface AcceptInvitationResponse { invitation: CoreInvitation }
interface DeclineInvitationResponse { invitation: CoreInvitation }


// --- Mock Dependencies ---

// Mock Service Factories and Methods
const mockFindAllInvitationsByUserId = vi.fn();
const mockAcceptInvitation = vi.fn();
const mockDeclineInvitation = vi.fn();
vi.mock('./organization-invitation.service', () => ({
  createOrganizationInvitationService: vi.fn(() => ({
    findAllInvitationsByUserId: mockFindAllInvitationsByUserId,
    acceptInvitation: mockAcceptInvitation,
    declineInvitation: mockDeclineInvitation,
  })),
}));

// Mock dependent services needed for middleware instantiation
vi.mock('../organizations/organization.service', () => ({
  createOrganizationService: vi.fn(() => ({
    // Mock methods if OrgInvitationService creation depends on them
  })),
}));
vi.mock('../auth/auth.service', () => ({
  createAuthService: vi.fn(() => ({
    // Mock methods if OrgInvitationService creation depends on them
  })),
}));

// Mock Repository Factories (less critical if services are fully mocked, but good practice)
vi.mock('./organization-invitation.repository', () => ({
  createOrganizationInvitationRepository: vi.fn(() => ({})),
}));
vi.mock('../organizations/organization.repository', () => ({
  createOrganizationRepository: vi.fn(() => ({})),
}));
vi.mock('../auth/auth.repository', () => ({
  createAuthRepository: vi.fn(() => ({})),
}));

// --- Test Setup ---

describe('Organization Invitation Routes V1', () => {
  let app: Hono<{ Bindings: Bindings; Variables: OrganizationInvitationRouteVariables }>;
  const mockUser: UserDTO = { id: 1, email: 'delivered@resend.dev', username: 'tester', email_verified: true, created_at: new Date() };
  const mockDb = { /* mock db instance */ } as Kysely<DB>;
  const now = new Date();
  const mockInvitation: CoreInvitation = {
    id: 1,
    organization_id: 10,
    invited_by_user_id: 2,
    email: mockUser.email, // Invitation targetting the mock user
    role: 'member',
    token: 'test-token-123',
    status: 'pending',
    expires_at: new Date(now.getTime() + 1000 * 60 * 60 * 24),
    created_at: now,
    updated_at: now,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    app = new Hono<{ Bindings: Bindings; Variables: OrganizationInvitationRouteVariables }>();

    // Apply mock middleware to set db and user context
    app.use(async (c, next) => {
      c.set('db', mockDb);
      c.set('user', mockUser);
      // Services are set within the route file's middleware, so no need to set them here directly
      await next();
    });

    // Apply global error handler (copied from other tests)
    app.onError((err, c) => {
      if (err instanceof ZodError) {
        return c.json({
          ok: false,
          errors: err.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
        }, 400);
      }
      if (err instanceof Error && err.cause instanceof ZodError) {
        const zodError = err.cause;
        return c.json({
          ok: false,
          errors: zodError.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
        }, 400);
      }

      if (err instanceof AppError) {
        const statusCode = typeof err.status === 'number' && err.status >= 100 && err.status <= 599
          ? err.status
          : 500;
        return c.json({
          ok: false,
          errorMessage: err.message,
          errorDetails: err.details
        }, statusCode as any);
      }

      return c.json({ ok: false, error: "Internal Server Error" }, 500);
    });

    // Mount the organization invitation routes under a base path if necessary, or root
    // Assuming they are mounted at the root of this Hono instance for testing
    app.route('/', organizationInvitationRoutesV1);
  });

  // --- Test Cases ---

  describe('GET /', () => {
    it('should call service findAllInvitationsByUserId and return invitations', async () => {
      const invitations = [mockInvitation, { ...mockInvitation, id: 2, token: 'token-2' }];
      mockFindAllInvitationsByUserId.mockResolvedValue(invitations);

      const res = await app.request('/'); // Request root path

      expect(res.status).toBe(201); // Route uses 201
      const body = await res.json() as GetInvitationsResponse;
      expect(body.invitations).toEqual(invitations.map(inv => ({
          ...inv,
          created_at: inv.created_at.toISOString(),
          updated_at: inv.updated_at.toISOString(),
          expires_at: inv.expires_at.toISOString(),
      })));
      expect(mockFindAllInvitationsByUserId).toHaveBeenCalledWith({ userId: mockUser.id });
    });

    it('should return 500 if service fails', async () => {
        const error = new Error('Database connection lost');
        mockFindAllInvitationsByUserId.mockRejectedValue(error);

        const res = await app.request('/');

        expect(res.status).toBe(500);
        const body = await res.json() as ErrorResponse;
        expect(body.ok).toBe(false);
        expect(body.error).toBe('Internal Server Error');
        expect(mockFindAllInvitationsByUserId).toHaveBeenCalledWith({ userId: mockUser.id });
    });
  });

  describe('POST /:token/accept', () => {
    const tokenToAccept = mockInvitation.token;

    it('should call service acceptInvitation and return accepted invitation', async () => {
      const acceptedInvitation = { ...mockInvitation, status: 'accepted' as const }; // Cast status
      mockAcceptInvitation.mockResolvedValue(acceptedInvitation);

      const res = await app.request(`/${tokenToAccept}/accept`, {
        method: 'POST',
      });

      expect(res.status).toBe(201); // Route uses 201
      const body = await res.json() as AcceptInvitationResponse;
      expect(body.invitation).toEqual({
          ...acceptedInvitation,
          created_at: acceptedInvitation.created_at.toISOString(),
          updated_at: acceptedInvitation.updated_at.toISOString(),
          expires_at: acceptedInvitation.expires_at.toISOString(),
      });
      expect(mockAcceptInvitation).toHaveBeenCalledWith({ token: tokenToAccept, acceptingUserId: mockUser.id });
    });

    it('should return 404 if service throws AppError (e.g., invitation not found)', async () => {
        const error = new AppError('Invitation not found or expired', 404);
        mockAcceptInvitation.mockRejectedValue(error);

        const res = await app.request(`/${tokenToAccept}/accept`, {
            method: 'POST',
        });

        expect(res.status).toBe(404);
        const body = await res.json() as ErrorResponse;
        expect(body.ok).toBe(false);
        expect(body.errorMessage).toBe(error.message);
        expect(mockAcceptInvitation).toHaveBeenCalledWith({ token: tokenToAccept, acceptingUserId: mockUser.id });
    });

     it('should return 500 if service fails unexpectedly', async () => {
        const error = new Error('Failed to update database');
        mockAcceptInvitation.mockRejectedValue(error);

        const res = await app.request(`/${tokenToAccept}/accept`, {
            method: 'POST',
        });

        expect(res.status).toBe(500);
        const body = await res.json() as ErrorResponse;
        expect(body.ok).toBe(false);
        expect(body.error).toBe('Internal Server Error');
        expect(mockAcceptInvitation).toHaveBeenCalledWith({ token: tokenToAccept, acceptingUserId: mockUser.id });
    });
  });

  describe('POST /:token/decline', () => {
    const tokenToDecline = mockInvitation.token;

    it('should call service declineInvitation and return declined invitation', async () => {
      const declinedInvitation = { ...mockInvitation, status: 'declined' as const }; // Cast status
      mockDeclineInvitation.mockResolvedValue(declinedInvitation);

      const res = await app.request(`/${tokenToDecline}/decline`, {
        method: 'POST',
      });

      expect(res.status).toBe(201); // Route uses 201
      const body = await res.json() as DeclineInvitationResponse;
      expect(body.invitation).toEqual({
          ...declinedInvitation,
          created_at: declinedInvitation.created_at.toISOString(),
          updated_at: declinedInvitation.updated_at.toISOString(),
          expires_at: declinedInvitation.expires_at.toISOString(),
      });
      expect(mockDeclineInvitation).toHaveBeenCalledWith({ token: tokenToDecline });
    });

    it('should return 404 if service throws AppError (e.g., invitation not found)', async () => {
        const error = new AppError('Invitation not found or already processed', 404);
        mockDeclineInvitation.mockRejectedValue(error);

        const res = await app.request(`/${tokenToDecline}/decline`, {
            method: 'POST',
        });

        expect(res.status).toBe(404);
        const body = await res.json() as ErrorResponse;
        expect(body.ok).toBe(false);
        expect(body.errorMessage).toBe(error.message);
        expect(mockDeclineInvitation).toHaveBeenCalledWith({ token: tokenToDecline });
    });

     it('should return 500 if service fails unexpectedly', async () => {
        const error = new Error('Unexpected database issue');
        mockDeclineInvitation.mockRejectedValue(error);

        const res = await app.request(`/${tokenToDecline}/decline`, {
            method: 'POST',
        });

        expect(res.status).toBe(500);
        const body = await res.json() as ErrorResponse;
        expect(body.ok).toBe(false);
        expect(body.error).toBe('Internal Server Error');
        expect(mockDeclineInvitation).toHaveBeenCalledWith({ token: tokenToDecline });
    });
  });
}); 
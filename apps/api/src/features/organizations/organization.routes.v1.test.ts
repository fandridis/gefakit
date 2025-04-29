import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { organizationRoutesV1 } from './organization.routes.v1';
import { OrganizationService } from './organization.service';
import { OrganizationMembershipService } from '../organization-memberships/organization-membership.service';
import { OrganizationInvitationService } from '../organization-invitations/organization-invitation.service';
import { EmailService } from '../emails/email.service';
import { UserDTO } from '@gefakit/shared';
import { ApiError } from '@gefakit/shared';
import { Bindings } from '../../types/hono';
import { Kysely, Selectable } from 'kysely';
import { DB, OrganizationsOrganization, OrganizationsInvitation } from '../../db/db-types';
import { ZodError } from 'zod';
import { CreateOrganizationResponseDTO, DeleteOrganizationResponseDTO, CreateOrganizationInvitationResponseDTO } from '@gefakit/shared/src/types/organization'; // Add required DTOs

// --- Define Types Matching Route Variables ---
type DbMiddleWareVariables = { db: Kysely<DB> };
type AuthMiddleWareVariables = { user: UserDTO };
type OrganizationRouteVariables = DbMiddleWareVariables & AuthMiddleWareVariables & {
  organizationService: OrganizationService;
  organizationMembershipService: OrganizationMembershipService;
  organizationInvitationService: OrganizationInvitationService;
  emailService: EmailService;
  // Note: AuthService isn't directly set in variables but used by OrganizationInvitationService setup
};

// --- Define Expected JSON Response Structures ---
interface ErrorResponse {
  ok: false;
  errors?: { field: string; message: string }[];
  errorMessage?: string;
  errorDetails?: any;
  error?: string;
}

interface SuccessResponse {
    success: boolean;
}


// --- Mock Dependencies ---

// Mock the error factory
const mockOrganizationNotFound = vi.fn(() => new ApiError('Organization not found mock', 404, {
    code: 'ORGANIZATION_NOT_FOUND',
}));
const mockActionNotAllowed = vi.fn((msg?: string) => new ApiError(msg || 'Action not allowed mock', 403, {
    code: 'ACTION_NOT_ALLOWED',
}));
const createApiError = {
  organizations: {
    organizationNotFound: mockOrganizationNotFound,
    actionNotAllowed: mockActionNotAllowed,
  },
  // Add other domains if needed by other routes
};

// Mock Service Factories and Methods
const mockCreateOrganization = vi.fn();
const mockDeleteOrganization = vi.fn();
const mockFindOrganizationById = vi.fn();
const mockUpdateMembershipDefaultStatus = vi.fn();
vi.mock('./organization.service', () => ({
  createOrganizationService: vi.fn(() => ({
    createOrganization: mockCreateOrganization,
    deleteOrganization: mockDeleteOrganization,
    findOrganizationById: mockFindOrganizationById,
    updateMembershipDefaultStatus: mockUpdateMembershipDefaultStatus,
    // Add other methods used by routes if any in the future
  })),
}));

const mockRemoveCurrentUserMembershipFromOrg = vi.fn();
const mockRemoveUserMembershipFromOrg = vi.fn();
vi.mock('../organization-memberships/organization-membership.service', () => ({
  createOrganizationMembershipService: vi.fn(() => ({
    removeCurrentUserMembershipFromOrg: mockRemoveCurrentUserMembershipFromOrg,
    removeUserMembershipFromOrg: mockRemoveUserMembershipFromOrg,
  })),
}));

const mockCreateInvitation = vi.fn();
vi.mock('../organization-invitations/organization-invitation.service', () => ({
  createOrganizationInvitationService: vi.fn(() => ({
    createInvitation: mockCreateInvitation,
  })),
}));

const mockSendOrganizationInvitationEmail = vi.fn();
vi.mock('../emails/email.service', () => ({
  createEmailService: vi.fn(() => ({
    sendOrganizationInvitationEmail: mockSendOrganizationInvitationEmail,
  })),
}));

// Mock Auth Service (needed for Invitation Service setup within the route middleware)
vi.mock('../auth/auth.service', () => ({
    createAuthService: vi.fn(() => ({
        // Add methods if needed by invitation service creation logic
    }))
}));


// Mock Repository Factories (less critical if services are fully mocked, but good practice)
vi.mock('./organization.repository', () => ({
  createOrganizationRepository: vi.fn(() => ({})),
}));
vi.mock('../organization-memberships/organization-membership.repository', () => ({
  createOrganizationMembershipRepository: vi.fn(() => ({})),
}));
vi.mock('../organization-invitations/organization-invitation.repository', () => ({
  createOrganizationInvitationRepository: vi.fn(() => ({})),
}));
vi.mock('../auth/auth.repository', () => ({
    createAuthRepository: vi.fn(() => ({})),
}));


// --- Test Setup ---

describe('Organization Routes V1', () => {
  let app: Hono<{ Bindings: Bindings; Variables: OrganizationRouteVariables }>;
  const mockUser: UserDTO = { id: 1, email: 'owner@test.com', username: 'owner', email_verified: true, created_at: new Date(), role: "USER" };
  const mockDb = { /* mock db instance */ } as Kysely<DB>;
  const now = new Date();
  const mockOrganization: Selectable<OrganizationsOrganization> = { id: 10, name: 'Test Org', created_at: now, updated_at: now };

  beforeEach(() => {
    vi.clearAllMocks();

    app = new Hono<{ Bindings: Bindings; Variables: OrganizationRouteVariables }>();

    // Apply mock middleware to set db and user context
    app.use(async (c, next) => {
      c.set('db', mockDb);
      c.set('user', mockUser);
      // Services are set within the route file's middleware, so no need to set them here
      await next();
    });

    // Apply global error handler
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

      if (err instanceof ApiError) {
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

    // Mount the organization routes
    app.route('/organizations', organizationRoutesV1);
  });

  // --- Test Cases ---

  it('should be defined', () => {
    expect(app).toBeDefined();
  });

  // Placeholder for POST / test
  describe('POST /organizations', () => {
      it('should call organizationService.createOrganization and return the created org', async () => {
            const requestBody = { name: 'New Org Inc.' };
            const createdOrg = { ...mockOrganization, id: 11, name: requestBody.name };
            mockCreateOrganization.mockResolvedValue(createdOrg);

            const res = await app.request('/organizations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });

            expect(res.status).toBe(201);
            const body = await res.json() as CreateOrganizationResponseDTO;
            expect(body).toEqual({ 
                createdOrganization: { 
                    ...createdOrg, 
                    created_at: createdOrg.created_at.toISOString(), 
                    updated_at: createdOrg.updated_at.toISOString()
                }
            });
            expect(mockCreateOrganization).toHaveBeenCalledWith({ data: requestBody, userId: mockUser.id });
      });

      it('should return 400 for invalid data (missing name)', async () => {
            const invalidRequestBody = {}; // Missing name
            const res = await app.request('/organizations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(invalidRequestBody),
            });

            expect(res.status).toBe(400);
            const body = await res.json() as ErrorResponse;
            expect(body.ok).toBe(false);
            expect(body.errors).toBeInstanceOf(Array);
            expect(body.errors?.some(e => e.field === 'name')).toBe(true);
            expect(mockCreateOrganization).not.toHaveBeenCalled();
      });

      it('should return 500 if service throws an unexpected error', async () => {
            const requestBody = { name: 'Error Org' };
            const error = new Error('Database exploded');
            mockCreateOrganization.mockRejectedValue(error);

            const res = await app.request('/organizations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });

            expect(res.status).toBe(500);
            const body = await res.json() as ErrorResponse;
            expect(body.ok).toBe(false);
            expect(body.error).toBe('Internal Server Error');
            expect(mockCreateOrganization).toHaveBeenCalledWith({ data: requestBody, userId: mockUser.id });
      });
  });

  // Placeholder for DELETE /:orgId test
  describe('DELETE /organizations/:orgId', () => {
      const orgIdToDelete = mockOrganization.id;

      it('should call organizationService.deleteOrganization and return the result', async () => {
            // Mock service to return a number for count, as BigInt causes JSON serialization issues
            const deleteResult = { count: 1 }; 
            // The DTO expects DeleteResult shape { count: number | null }
            mockDeleteOrganization.mockResolvedValue(deleteResult); 

            const res = await app.request(`/organizations/${orgIdToDelete}`, {
                method: 'DELETE',
            });

            expect(res.status).toBe(200);
            const body = await res.json() as DeleteOrganizationResponseDTO;
             // Expect the response to match the DTO shape with the number count
            expect(body).toEqual({ deletedOrganization: { count: 1 } }); 
            expect(mockDeleteOrganization).toHaveBeenCalledWith({ organizationId: orgIdToDelete, userId: mockUser.id });
      });

      it('should return 404 if service throws organizationNotFound ApiError', async () => {
            const notFoundError = createApiError.organizations.organizationNotFound();
            mockDeleteOrganization.mockRejectedValue(notFoundError);

            const res = await app.request(`/organizations/${orgIdToDelete}`, {
                method: 'DELETE',
            });

            expect(res.status).toBe(404);
            const body = await res.json() as ErrorResponse;
            expect(body.ok).toBe(false);
            expect(body.errorMessage).toBe('Organization not found mock');
            expect(mockDeleteOrganization).toHaveBeenCalledWith({ organizationId: orgIdToDelete, userId: mockUser.id });
      });

      it('should return 403 if service throws actionNotAllowed ApiError', async () => {
            const actionNotAllowedError = createApiError.organizations.actionNotAllowed('Cannot delete');
            mockDeleteOrganization.mockRejectedValue(actionNotAllowedError);

            const res = await app.request(`/organizations/${orgIdToDelete}`, {
                method: 'DELETE',
            });

            expect(res.status).toBe(403);
            const body = await res.json() as ErrorResponse;
            expect(body.ok).toBe(false);
            expect(body.errorMessage).toBe('Cannot delete');
            expect(mockDeleteOrganization).toHaveBeenCalledWith({ organizationId: orgIdToDelete, userId: mockUser.id });
      });
  });

  // Test DELETE /:orgId/memberships/me
  describe('DELETE /organizations/:orgId/memberships/me', () => {
      const orgId = mockOrganization.id;

      it('should call organizationMembershipService.removeCurrentUserMembershipFromOrg', async () => {
          mockRemoveCurrentUserMembershipFromOrg.mockResolvedValue(undefined); // Assume void return

          const res = await app.request(`/organizations/${orgId}/memberships/me`, {
              method: 'DELETE',
          });

          expect(res.status).toBe(200);
          const body = await res.json() as SuccessResponse;
          expect(body).toEqual({ success: true });
          expect(mockRemoveCurrentUserMembershipFromOrg).toHaveBeenCalledWith({ organizationId: orgId, userId: mockUser.id });
      });

      it('should return 403 if service throws ApiError (e.g., owner cannot leave)', async () => {
          const error = createApiError.organizations.actionNotAllowed("Owner cannot leave"); // Assuming this error exists or is mocked
          mockRemoveCurrentUserMembershipFromOrg.mockRejectedValue(error);

          const res = await app.request(`/organizations/${orgId}/memberships/me`, {
              method: 'DELETE',
          });

          expect(res.status).toBe(403);
          const body = await res.json() as ErrorResponse;
          expect(body.ok).toBe(false);
          expect(body.errorMessage).toBe(error.message);
          expect(mockRemoveCurrentUserMembershipFromOrg).toHaveBeenCalledWith({ organizationId: orgId, userId: mockUser.id });
      });
  });

  // Test DELETE /:orgId/memberships/:membershipId
  describe('DELETE /organizations/:orgId/memberships/:membershipId', () => {
      const orgId = mockOrganization.id;
      const membershipUserIdToRemove = 5; // Different user ID

      it('should call organizationMembershipService.removeUserMembershipFromOrg', async () => {
          mockRemoveUserMembershipFromOrg.mockResolvedValue(undefined); // Assume void return

          const res = await app.request(`/organizations/${orgId}/memberships/${membershipUserIdToRemove}`, {
              method: 'DELETE',
          });

          expect(res.status).toBe(200);
          const body = await res.json() as SuccessResponse;
          expect(body).toEqual({ success: true });
          // Note: Route does not check *who* is making the request, just removes the target user ID.
          // Authorization might happen in the service layer.
          expect(mockRemoveUserMembershipFromOrg).toHaveBeenCalledWith({ organizationId: orgId, userId: membershipUserIdToRemove });
      });

       it('should return 403 if service throws ApiError (e.g., permission denied)', async () => {
          // Assume the service layer handles authorization and throws if needed.
          const error = createApiError.organizations.actionNotAllowed("Permission denied to remove member");
          mockRemoveUserMembershipFromOrg.mockRejectedValue(error);

          const res = await app.request(`/organizations/${orgId}/memberships/${membershipUserIdToRemove}`, {
              method: 'DELETE',
          });

          expect(res.status).toBe(403);
          const body = await res.json() as ErrorResponse;
          expect(body.ok).toBe(false);
          expect(body.errorMessage).toBe(error.message);
          expect(mockRemoveUserMembershipFromOrg).toHaveBeenCalledWith({ organizationId: orgId, userId: membershipUserIdToRemove });
      });
  });

  // Test POST /:orgId/invitations
  describe('POST /organizations/:orgId/invitations', () => {
      const orgId = mockOrganization.id;
      const requestBody = { email: 'invitee@test.com' };
      const now = new Date();
      const createdInvitation: Selectable<OrganizationsInvitation> = {
          id: 1, // Assuming number ID
          organization_id: orgId,
          invited_by_user_id: mockUser.id,
          role: 'member',
          email: requestBody.email,
          status: 'pending',
          token: 'mock-token',
          expires_at: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7),
          created_at: now,
          updated_at: now
      };

      beforeEach(() => {
          // Mock the findOrganizationById call made at the start of the handler
          mockFindOrganizationById.mockResolvedValue(mockOrganization);
          // Mock the email service call
          mockSendOrganizationInvitationEmail.mockResolvedValue(undefined);
      });

      it('should call services and return created invitation', async () => {
          mockCreateInvitation.mockResolvedValue(createdInvitation);

          const res = await app.request(`/organizations/${orgId}/invitations`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody),
          });

          expect(res.status).toBe(201);
          const body = await res.json() as CreateOrganizationInvitationResponseDTO;
          expect(body).toEqual({ 
              createdInvitation: { 
                  ...createdInvitation, 
                  created_at: createdInvitation.created_at.toISOString(), 
                  expires_at: createdInvitation.expires_at.toISOString(), 
                  updated_at: createdInvitation.updated_at.toISOString()
              }
          });

          expect(mockFindOrganizationById).toHaveBeenCalledWith({ organizationId: orgId });
          expect(mockCreateInvitation).toHaveBeenCalledWith(expect.objectContaining({
              organizationInvitation: expect.objectContaining({
                  organization_id: orgId,
                  invited_by_user_id: mockUser.id,
                  email: requestBody.email,
                  role: 'member', // Default role in route
                  // We don't strictly check expires_at or token here as they are generated
              })
          }));
          expect(mockSendOrganizationInvitationEmail).toHaveBeenCalledWith({
              email: createdInvitation.email,
              orgName: mockOrganization.name,
              token: createdInvitation.token
          });
      });

       it('should return 400 for invalid data (missing email)', async () => {
            const invalidRequestBody = {}; // Missing email
            const res = await app.request(`/organizations/${orgId}/invitations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(invalidRequestBody),
            });

            expect(res.status).toBe(400);
            const body = await res.json() as ErrorResponse;
            expect(body.ok).toBe(false);
            expect(body.errors).toBeInstanceOf(Array);
            expect(body.errors?.some(e => e.field === 'email')).toBe(true);
            expect(mockFindOrganizationById).not.toHaveBeenCalled(); // Shouldn't be called if validation fails
            expect(mockCreateInvitation).not.toHaveBeenCalled();
            expect(mockSendOrganizationInvitationEmail).not.toHaveBeenCalled();
      });

      it('should return 404 if organization is not found', async () => {
          mockFindOrganizationById.mockResolvedValue(null); // Org not found

          const res = await app.request(`/organizations/${orgId}/invitations`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody),
          });

          expect(res.status).toBe(404); // Expecting 404 based on createApiError.organizations.organizationNotFound()
          const body = await res.json() as ErrorResponse;
          expect(body.ok).toBe(false);
          // Assuming the route throws the specific error
          expect(body.errorMessage).toContain('Organization not found');

          expect(mockFindOrganizationById).toHaveBeenCalledWith({ organizationId: orgId });
          expect(mockCreateInvitation).not.toHaveBeenCalled();
          expect(mockSendOrganizationInvitationEmail).not.toHaveBeenCalled();
      });

      it('should return 500 if createInvitation service fails', async () => {
          const error = new Error('Invite creation failed');
          mockCreateInvitation.mockRejectedValue(error);

          const res = await app.request(`/organizations/${orgId}/invitations`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody),
          });

          expect(res.status).toBe(500);
          const body = await res.json() as ErrorResponse;
          expect(body.ok).toBe(false);
          expect(body.error).toBe('Internal Server Error');

          expect(mockFindOrganizationById).toHaveBeenCalledWith({ organizationId: orgId });
          expect(mockCreateInvitation).toHaveBeenCalled(); // It was called but failed
          expect(mockSendOrganizationInvitationEmail).not.toHaveBeenCalled(); // Should not be called if invitation fails
      });

       it('should return 500 if email sending fails (route does not catch)', async () => {
          // Invitation creation succeeds
          mockCreateInvitation.mockResolvedValue(createdInvitation);
          // Email sending fails
          const emailError = new Error('Email service down');
          mockSendOrganizationInvitationEmail.mockRejectedValue(emailError);
          // Spy on console.error
          const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

          const res = await app.request(`/organizations/${orgId}/invitations`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody),
          });

          // The route currently proceeds even if email fails, letting the error bubble up
          // Hono's default error handler or our custom one catches it -> 500
          expect(res.status).toBe(500); 
          // Check for the generic error response
          const body = await res.json() as ErrorResponse;
          expect(body.ok).toBe(false);
          expect(body.error).toBe('Internal Server Error');

          expect(mockFindOrganizationById).toHaveBeenCalledWith({ organizationId: orgId });
          expect(mockCreateInvitation).toHaveBeenCalled();
          expect(mockSendOrganizationInvitationEmail).toHaveBeenCalled(); 

          consoleErrorSpy.mockRestore();
      });
  });

   // Test PUT /organizations/memberships/active/:orgId
   describe('PUT /organizations/memberships/active/:orgId', () => {
      const orgIdToActivate = 20;

      it('should call organizationService.updateMembershipDefaultStatus', async () => {
          mockUpdateMembershipDefaultStatus.mockResolvedValue({ count: 1n }); // Assuming service returns update result

          const res = await app.request(`/organizations/memberships/active/${orgIdToActivate}`, {
              method: 'PUT',
          });

          expect(res.status).toBe(200);
          const body = await res.json() as SuccessResponse;
          expect(body).toEqual({ success: true });
          expect(mockUpdateMembershipDefaultStatus).toHaveBeenCalledWith({ userId: mockUser.id, organizationId: orgIdToActivate });
      });

      it('should return 500 if service throws an error', async () => {
          const error = new Error('Failed to update default status');
          mockUpdateMembershipDefaultStatus.mockRejectedValue(error);

          const res = await app.request(`/organizations/memberships/active/${orgIdToActivate}`, {
              method: 'PUT',
          });

          expect(res.status).toBe(500);
          const body = await res.json() as ErrorResponse;
          expect(body.ok).toBe(false);
          expect(body.error).toBe('Internal Server Error');
          expect(mockUpdateMembershipDefaultStatus).toHaveBeenCalledWith({ userId: mockUser.id, organizationId: orgIdToActivate });
      });
  });

}); 
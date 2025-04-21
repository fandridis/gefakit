import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import type { Bindings } from '../../types/hono'; 
import { organizationMembershipRoutesV1 } from './organization-membership.routes.v1';
import { AuthMiddleWareVariables } from '../../middleware/auth';
import type { OrganizationMembershipService } from './organization-membership.service';
import { Selectable } from 'kysely';
import { OrganizationsMembership } from '../../db/db-types';
import { AppError } from '../../errors/app-error';
import { ZodError } from 'zod';

// --- Mock Dependencies ---

// 1. Mock the service instance methods
const mockOrganizationMembershipService = {
  findAllOrganizationMembershipsByUserId: vi.fn(),
  removeCurrentUserMembershipFromOrg: vi.fn(), 
  removeUserMembershipFromOrg: vi.fn(),      
};

// *** ADD MOCK FOR SERVICE FACTORY ***
// Mock the actual factory function BEFORE routes are imported
vi.mock('./organization-membership.service', () => ({
  // Mock the named export 'createOrganizationMembershipService'
  createOrganizationMembershipService: vi.fn(() => mockOrganizationMembershipService),
  // We also need to provide a mock for the type if it's used elsewhere, 
  // but usually mocking the factory is sufficient for runtime.
  // OrganizationMembershipService: vi.fn() // Optional: mock type if needed
}));


// 2. Mock the auth middleware
const mockAuthMiddleware = vi.fn();


// --- Test Setup ---
// Define the specific variables structure for these tests
type TestRouteVariables = AuthMiddleWareVariables & { 
  // The service will be set by the (mocked) factory in the route middleware
  // We might not strictly need it in the Hono Variables type for the test app itself,
  // but keeping it doesn't hurt.
  organizationMembershipService: OrganizationMembershipService 
};

describe('Organization Membership Routes v1', () => {
  let app: Hono<{ Bindings: Bindings; Variables: TestRouteVariables }>

  const testUserId = 1;
  const testOrgId = 10;
  const testUser = { id: testUserId, email: 'delivered@resend.dev' };

  // Flag to control auth middleware behavior
  let simulateAuthFailure = false;

  beforeEach(() => {
    vi.resetAllMocks();
    simulateAuthFailure = false; // Reset flag

    // Clear the mock factory calls as well
    // vi.mocked(require('./organization-membership.service').createOrganizationMembershipService).mockClear();

    // Instead, clear the mocks on the service methods
    mockOrganizationMembershipService.findAllOrganizationMembershipsByUserId.mockClear();
    mockOrganizationMembershipService.removeCurrentUserMembershipFromOrg.mockClear();
    mockOrganizationMembershipService.removeUserMembershipFromOrg.mockClear();

    app = new Hono<{ Bindings: Bindings; Variables: TestRouteVariables }>()

    // --- Middleware Setup ---
    // a) *** MODIFIED Auth middleware ***
    app.use('/*', async (c, next) => {
      if (simulateAuthFailure) {
        // Simulate auth failure by throwing an error that onError will catch
        throw new AppError('Unauthorized', 401);
      } else {
        // Simulate successful auth
        c.set('user', testUser as AuthMiddleWareVariables['user']);
        mockAuthMiddleware(c); // Keep track if needed
        await next();
      }
    });

    // b) Error Handler (ensure this is present)
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

    // Register the actual routes AFTER the middleware and error handler
    app.route('/api/v1/organization-memberships', organizationMembershipRoutesV1);

  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- Test Cases ---

  // Test GET /api/v1/organization-memberships
  describe('GET /api/v1/organization-memberships', () => {
    it('should return 200 and the user\'s memberships on success', async () => {
      const now = new Date();
      const expectedMemberships: Selectable<OrganizationsMembership>[] = [
        { organization_id: 10, user_id: testUserId, role: 'member', is_default: false, created_at: now, updated_at: now },
        { organization_id: 11, user_id: testUserId, role: 'owner', is_default: true, created_at: now, updated_at: now },
      ];
      vi.mocked(mockOrganizationMembershipService.findAllOrganizationMembershipsByUserId).mockResolvedValue(expectedMemberships);

      const response = await app.request('/api/v1/organization-memberships');
      
      // Use 200 for GET success, not 201 (which is typically for creation)
      expect(response.status).toBe(200); 
      // Cast the response body
      const body = await response.json() as { memberships: Selectable<OrganizationsMembership>[] };
      // Need to stringify/parse dates for comparison if they aren't serialized consistently
      expect(body.memberships).toEqual(expectedMemberships.map(m => ({...m, created_at: m.created_at.toISOString(), updated_at: m.updated_at.toISOString()})));
      expect(mockOrganizationMembershipService.findAllOrganizationMembershipsByUserId).toHaveBeenCalledWith({ userId: testUserId });
      expect(mockAuthMiddleware).toHaveBeenCalledTimes(1); // Check auth middleware was hit
    });

    it('should return 500 if the service fails unexpectedly', async () => {
      const error = new Error('Internal Server Error');
      vi.mocked(mockOrganizationMembershipService.findAllOrganizationMembershipsByUserId).mockRejectedValue(error);

      const response = await app.request('/api/v1/organization-memberships');

      expect(response.status).toBe(500);
      // Cast the response body
      const body = await response.json() as { error: string };
      expect(body.error).toBe('Internal Server Error');
      expect(mockOrganizationMembershipService.findAllOrganizationMembershipsByUserId).toHaveBeenCalledWith({ userId: testUserId });
    });

    // Test for 401
    it('should return 401 if user is not authenticated', async () => {
      // *** Set the flag for this test ***
      simulateAuthFailure = true;
      
      const response = await app.request('/api/v1/organization-memberships');

      expect(response.status).toBe(401);
      const body = await response.json() as { errorMessage: string, ok: boolean, errorDetails?: any };
      expect(body.errorMessage).toBe('Unauthorized'); 
      expect(mockOrganizationMembershipService.findAllOrganizationMembershipsByUserId).not.toHaveBeenCalled(); 
    });
  });

  // --- Add describe blocks for other routes (e.g., DELETE) once known ---

}); 
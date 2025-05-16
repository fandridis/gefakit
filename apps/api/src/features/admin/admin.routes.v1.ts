import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';
import { Bindings } from '../../types/hono';
import { getAdminService, getAuthService } from '../../utils/get-service';
import { adminErrors } from './admin.errors';
import { AppVariables } from '../../create-app';
import { getAuthOrThrow } from '../../utils/get-auth-or-throw';

const ADMIN_ROLES = new Set(['ADMIN', 'SUPPORT']);

const impersonateSchema = z.object({
  targetUserId: z.coerce.number(),
});


// Export a factory function that creates and configures the Hono app
export function createAdminRoutesV1() {
  const app = new Hono<{ Bindings: Bindings, Variables: AppVariables }>();

  app.post(
    '/impersonate',
    authMiddleware({ allowedRoles: ADMIN_ROLES }),
    zValidator('json', impersonateSchema),
    async (c) => {
      const { targetUserId } = c.req.valid('json');
      const { user: adminUser, session } = getAuthOrThrow(c);

      console.log('===========At impersonate route ===============')
      console.log('data: ', { adminUser, session })

      if (!adminUser || !session) {
        throw adminErrors.authenticationRequired();
      }
      if (adminUser.id === targetUserId) {
        throw adminErrors.cannotImpersonateSelf();
      }

      const adminService = getAdminService(c);


      await adminService.startImpersonation(session.id, adminUser.id, targetUserId);

      // Log the action
      console.log(`AUDIT: User ${adminUser.id} started impersonating user ${targetUserId}`);

      return c.json({ ok: true, message: `Admin ${adminUser.id} is now impersonating user ${targetUserId}` });
    }
  );

  app.post(
    '/stop-impersonation',
    authMiddleware(),
    async (c) => {
      const { session } = getAuthOrThrow(c);

      if (!session) {
        throw adminErrors.impersonationSessionNotFound();
      }

      const authService = getAuthService(c);
      const adminService = getAdminService(c);

      const sessionDetails = await authService.findSessionById({ id: session.id });
      if (!sessionDetails || !sessionDetails.impersonator_user_id) {
        throw adminErrors.notImpersonating();
      }

      const adminUserId = sessionDetails.impersonator_user_id;

      await adminService.stopImpersonation(session.id, adminUserId);

      // Log the action
      console.log(`AUDIT: User ${adminUserId} stopped impersonating`);

      return c.json({ ok: true, message: 'Impersonation stopped' });
    }
  );

  // Return the configured app instance
  return app;
}
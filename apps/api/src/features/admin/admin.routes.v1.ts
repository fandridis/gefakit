// apps/api/src/features/admin/admin.routes.v1.ts (Example)
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AuthService, createAuthService } from '../auth/auth.service'; // Might need auth service/repo
import { createAuthRepository } from '../auth/auth.repository';
import { authMiddleware } from '../../middleware/auth';
import { adminAuth } from '../../middleware/admin-auth';
import { AppError } from '../../errors/app-error';
import { dbMiddleware, DbMiddleWareVariables } from '../../middleware/db';
import { createAdminService } from './admin.service';
import { createOrganizationRepository } from '../organizations/organization.repository';
import { Bindings } from '../../types/hono';

type AuthRouteVariables = DbMiddleWareVariables & {
    authService: AuthService;
}
const app = new Hono<{ Bindings: Bindings, Variables: AuthRouteVariables }>();

const impersonateSchema = z.object({
  targetUserId: z.string(),
});

app.post(
  '/impersonate',
  authMiddleware,
  adminAuth,
  dbMiddleware,
  zValidator('json', impersonateSchema),
  async (c) => {
    const { targetUserId } = c.req.valid('json');
    const adminUser = c.get('user'); 
    const session = c.get('session');
    const db = c.get('db');

    if (!adminUser || !session) {
      throw new AppError('Authentication required', 401);
    }
    if (adminUser.id === parseInt(targetUserId)) {
       throw new AppError('Cannot impersonate yourself', 400);
    }

    const authRepository = createAuthRepository({db});
    const adminService = createAdminService({db, authRepository});

    await adminService.startImpersonation(session.id, adminUser.id, parseInt(targetUserId));

    // Log the action
    console.log(`AUDIT: User ${adminUser.id} started impersonating user ${targetUserId}`);

    return c.json({ ok: true, message: 'Impersonation started' });
  }
);

app.post(
    '/stop-impersonation',
    authMiddleware,
    dbMiddleware,
    async (c) => {
      const session = c.get('session');
      const db = c.get('db');
  
      if (!session) {
           throw new AppError('Session not found', 401);
      }
      // We need the *original* admin ID to revert the session correctly.
      // The best way is to fetch it from the session table itself *before* updating.
      const authRepository = createAuthRepository({db});
      const authService = createAuthService({db, authRepository, createAuthRepository, createOrganizationRepository});
      const adminService = createAdminService({db, authRepository});
      
      const sessionDetails = await authService.findSessionById({ id: session.id });
      console.log('[stop-impersonation] sessionDetails: ', sessionDetails);
      if (!sessionDetails || !sessionDetails.impersonator_user_id) {
          throw new AppError('Not currently impersonating or session invalid', 400);
      }
  
      const adminUserId = sessionDetails.impersonator_user_id;
  
      await adminService.stopImpersonation(session.id, adminUserId);
  
      // Log the action
      console.log(`AUDIT: User ${adminUserId} stopped impersonating`);
  
      return c.json({ ok: true, message: 'Impersonation stopped' });
    }
  );

  export const adminRoutesV1 = app;
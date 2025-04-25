// apps/api/src/features/admin/admin.routes.v1.ts (Example)
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AuthService } from '../auth/auth.service'; // Might need auth service/repo
import { createAuthRepository } from '../auth/auth.repository';
import { authMiddleware } from '../../middleware/auth';
import { adminAuth } from '../../middleware/admin-auth';
import { createAppError } from '../../core/app-error';
import { dbMiddleware, DbMiddleWareVariables } from '../../middleware/db';
import { createAdminService } from './admin.service';
import { Bindings } from '../../types/hono';
import { getAdminService, getAuthService } from '../../core/services';

type AuthRouteVariables = DbMiddleWareVariables & {
    authService: AuthService;
}
const app = new Hono<{ Bindings: Bindings, Variables: AuthRouteVariables }>();

const impersonateSchema = z.object({
  targetUserId: z.coerce.number(),
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
      throw createAppError.admin.authenticationRequired();
    }
    if (adminUser.id === targetUserId) {
       throw createAppError.admin.cannotImpersonateSelf();
    }

    const authRepository = createAuthRepository({db});
    const adminService = createAdminService({db, authRepository});

    await adminService.startImpersonation(session.id, adminUser.id, targetUserId);

    // Log the action
    console.log(`AUDIT: User ${adminUser.id} started impersonating user ${targetUserId}`);

    return c.json({ ok: true, message: `Admin ${adminUser.id} is now impersonating user ${targetUserId}` });
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
           throw createAppError.admin.impersonationSessionNotFound();
      }
      
      const authService = getAuthService(db);
      const adminService = getAdminService(db);
      
      const sessionDetails = await authService.findSessionById({ id: session.id });
      if (!sessionDetails || !sessionDetails.impersonator_user_id) {
          throw createAppError.admin.notImpersonating();
      }
  
      const adminUserId = sessionDetails.impersonator_user_id;
  
      await adminService.stopImpersonation(session.id, adminUserId);
  
      // Log the action
      console.log(`AUDIT: User ${adminUserId} stopped impersonating`);
  
      return c.json({ ok: true, message: 'Impersonation stopped' });
    }
  );

  export const adminRoutesV1 = app;
export class AppError extends Error {
  readonly status: number;
  readonly details?: Record<string, any>;
  
  constructor(message: string, status = 400, details?: Record<string, any>) {
    super(message);
    // Set the prototype explicitly for correct instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);

    this.name = 'AppError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Import all feature-specific error creators here.
 */

import { authErrors } from '../features/auth/auth.errors';
import { todoErrors } from '../features/todos/todo.errors';
import { organizationErrors } from '../features/organizations/organization.errors';
import { organizationInvitationErrors } from '../features/organization-invitations/organization-invitation.errors';
import { organizationMembershipErrors } from '../features/organization-memberships/organization-membership.errors';
import { adminErrors } from '../features/admin/admin.errors';

/**
 * Central object for creating application-specific errors.
 * Usage: `throw createAppError.auth.invalidCredentials();`
 * `throw createAppError.todos.notFound('123');`
 */
export const createAppError = {
  auth: authErrors,
  todos: todoErrors,
  organizations: organizationErrors,
  organizationMemberships: organizationMembershipErrors,
  organizationInvitations: organizationInvitationErrors,
  admin: adminErrors,
  // Add other features here...
};
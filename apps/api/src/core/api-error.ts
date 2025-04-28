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
 * Usage: `throw createApiError.auth.invalidCredentials();`
 * `throw createApiError.todos.notFound('123');`
 */
export const createApiError = {
  auth: authErrors,
  todos: todoErrors,
  organizations: organizationErrors,
  organizationMemberships: organizationMembershipErrors,
  organizationInvitations: organizationInvitationErrors,
  admin: adminErrors,
  // Add other features here...
};
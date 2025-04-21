/**
 * Import all feature-specific error creators here.
 */

import { authErrors } from '../features/auth/auth.errors';
import { todoErrors } from '../features/todos/todo.errors';
import { organizationErrors } from '../features/organizations/organization.errors';
import { organizationInvitationErrors } from '../features/organization-invitations/organization-invitation.errors';
import { organizationMembershipErrors } from '../features/organization-memberships/organization-membership.errors';

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
  // Add other features here...
};

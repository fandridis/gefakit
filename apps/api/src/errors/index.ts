/**
 * Import all feature-specific error creators here.
 */

import { authErrors } from '../features/auth/auth.errors';
import { todoErrors } from '../features/todos/todo.errors';
import { organizationErrors } from '../features/organizations/organizations.errors';
/**
 * Central object for creating application-specific errors.
 * Usage: `throw createAppError.auth.invalidCredentials();`
 * `throw createAppError.todos.notFound('123');`
 */
export const createAppError = {
  auth: authErrors,
  todos: todoErrors,
  organizations: organizationErrors,
  // Add other features here...
};

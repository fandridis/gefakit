/**
 * Import all feature-specific error creators here.
 */

import { authErrors } from '../features/auth/auth.errors';
// import { todoErrors } from '../features/todos/todos.errors';

/**
 * Central object for creating application-specific errors.
 * Usage: `throw createAppError.auth.invalidCredentials();`
 * `throw createAppError.todos.notFound('123');`
 */
export const createAppError = {
  auth: authErrors,
  // todos: todoErrors,
  // users: userErrorCreators,
  // Add other features here...
};

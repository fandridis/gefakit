/**
 * This file should be defined at src/errors/index.ts
 */

import { ApiError } from "@gefakit/shared";

export const todoErrors = {
  todoNotFound: () =>
    new ApiError('Todo not found', 404, { code: 'TODO_NOT_FOUND' }),

  actionNotAllowed: (reason: string = 'Action not allowed') =>
    new ApiError('Action not allowed', 403, { code: 'ACTION_NOT_ALLOWED', reason }),

} as const;
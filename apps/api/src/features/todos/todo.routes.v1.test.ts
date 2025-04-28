import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { todoRoutesV1 } from './todo.routes.v1';
import { TodoService } from './todo.service';
import { UserDTO } from '@gefakit/shared';
import { ApiError } from '@gefakit/shared'; // Import ApiError for testing error responses
import { Bindings } from '../../types/hono';
import { Kysely } from 'kysely'; // Import Kysely for DB type
import { DB } from '../../db/db-types'; // Import DB types
import { ZodError } from 'zod'; // Import ZodError for onError handler

// --- Define Types Matching Route Variables ---
// Replicate or import the variable types expected by the routes
type DbMiddleWareVariables = { db: Kysely<DB> };
type AuthMiddleWareVariables = { user: UserDTO };
type TodoRouteVars = DbMiddleWareVariables & AuthMiddleWareVariables & {
  todoService: TodoService;
};

// --- Define Expected JSON Response Structures ---
interface ErrorResponse { 
  ok: false;
  errors?: { field: string; message: string }[];
  errorMessage?: string;
  errorDetails?: any;
  error?: string;
}

interface GetTodosResponse { todos: any[] } // Replace any[] with CoreTodo if needed
interface PostTodoResponse { createdTodo: any } // Replace any with CoreTodo if needed
interface PutTodoResponse { updatedTodo: any } // Replace any with CoreTodo if needed
interface DeleteTodoResponse { deletedTodo: { count: number } }

// --- Mock Dependencies ---

// Mock TodoService factory and its methods
const mockFindAllTodosByAuthorId = vi.fn();
const mockCreateTodo = vi.fn();
const mockUpdateTodo = vi.fn();
const mockDeleteTodo = vi.fn();
vi.mock('./todo.service', () => ({
  createTodoService: vi.fn(() => ({
    findAllTodosByAuthorId: mockFindAllTodosByAuthorId,
    createTodo: mockCreateTodo,
    updateTodo: mockUpdateTodo,
    deleteTodo: mockDeleteTodo,
  })),
}));

// Mock TodoRepository factory (return value doesn't matter much here as service is mocked)
vi.mock('./todo.repository', () => ({
  createTodoRepository: vi.fn(() => ({ /* Mock repository methods if needed, unlikely here */ })),
}));

// --- Test Setup ---

describe('Todo Routes V1', () => {
  let app: Hono<{ Bindings: Bindings; Variables: TodoRouteVars }>; // Use the correct Bindings type
  const mockUser: UserDTO = { id: 123, email: 'delivered@resend.dev', username: 'tester', email_verified: true, created_at: new Date(), role: 'USER' };
  const mockDb = { /* mock db instance if needed by middleware not bypassed */ } as Kysely<DB>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a new Hono app instance for each test with correct types
    app = new Hono<{ Bindings: Bindings; Variables: TodoRouteVars }>();

    // Apply middleware to set db and user context *before* mounting routes
    // This middleware will run for all requests handled by this app instance
    app.use(async (c, next) => {
      c.set('db', mockDb); // Set db context
      c.set('user', mockUser); // Set user context
      // Note: We don't set 'todoService' here, as the routes' internal middleware does that
      await next();
    });

    // Apply the global error handler logic from index.ts to the test app
    app.onError((err, c) => {
      if (err instanceof ZodError) {
        return c.json({
          ok: false,
          errors: err.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
        }, 400);
      }
      // Handle potential wrapped ZodErrors (e.g., from hono/validator)
      if (err instanceof Error && err.cause instanceof ZodError) {
        const zodError = err.cause;
        return c.json({
          ok: false,
          errors: zodError.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
        }, 400); 
      }

      if (err instanceof ApiError) {
        const statusCode = typeof err.status === 'number' && err.status >= 100 && err.status <= 599 
          ? err.status 
          : 500;
        return c.json({ 
          ok: false, 
          errorMessage: err.message,
          errorDetails: err.details 
        }, statusCode as any);
      }

      // Default internal server error
      return c.json({ ok: false, error: "Internal Server Error" }, 500);
    });

    // Mount the routes to be tested
    // Requests like /todos will now pass through the middleware above first
    app.route('/todos', todoRoutesV1);
  });

  // --- Test Cases ---

  describe('GET /todos', () => {
    it('should call todoService.findAllTodosByAuthorId and return todos', async () => {
      const mockTodos = [{ id: 1, title: 'Test', completed: false, author_id: mockUser.id }];
      mockFindAllTodosByAuthorId.mockResolvedValue(mockTodos);

      const res = await app.request('/todos');

      expect(res.status).toBe(200);
      const body = await res.json() as GetTodosResponse;
      expect(body).toEqual({ todos: mockTodos });
      expect(mockFindAllTodosByAuthorId).toHaveBeenCalledWith({ authorId: mockUser.id });
    });
  });

  describe('POST /todos', () => {
    // Add required fields to the valid data
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1); // Set date to tomorrow
    const validTodoData = { 
      title: 'New Todo', 
      completed: false, 
      description: 'A valid description', 
      // Fix: Ensure due_date is in the future to pass .refine() check
      due_date: futureDate.toISOString() 
    };
    // Ensure createdTodo includes the new fields
    const createdTodo = { ...validTodoData, id: 1, author_id: mockUser.id };

    it('should call todoService.createTodo with valid data and return created todo', async () => {
      mockCreateTodo.mockResolvedValue(createdTodo);
      const res = await app.request('/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validTodoData),
      });
      if (res.status !== 200) {
          console.log('POST error response body:', await res.text());
      }
      expect(res.status).toBe(200);
      const body = await res.json() as PostTodoResponse;
      expect(body).toEqual({ createdTodo: createdTodo });
      expect(mockCreateTodo).toHaveBeenCalledWith({ 
        authorId: mockUser.id, 
        todo: { 
          title: validTodoData.title,
          completed: validTodoData.completed,
          description: validTodoData.description,
          due_date: futureDate, // Expect the Date object
          author_id: mockUser.id 
        } 
      });
    });

    it('should return 400 for invalid data (missing title)', async () => {
      // Keep other required fields for a more realistic invalid test
      const futureDateForInvalid = new Date();
      futureDateForInvalid.setDate(futureDateForInvalid.getDate() + 1);
      const invalidData = { 
          completed: true, 
          description: 'Another description',
          due_date: futureDateForInvalid.toISOString()
      }; // Missing title
      const res = await app.request('/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      });
      expect(res.status).toBe(400); 
      expect(mockCreateTodo).not.toHaveBeenCalled();
      const body = await res.json() as ErrorResponse;
      expect(body.ok).toBe(false);
      expect(body.errors).toBeInstanceOf(Array);
      expect(body.errors?.some((e: any) => e.field === 'title')).toBe(true);
      expect(body.errors?.some((e: any) => e.field === 'description')).toBe(false);
      expect(body.errors?.some((e: any) => e.field === 'due_date')).toBe(false); 
    });
  });

  describe('PUT /todos/:id', () => {
    const todoId = 1;
    const validUpdateData = { title: 'Updated Title', completed: true };
    const updatedTodo = { ...validUpdateData, id: todoId, author_id: mockUser.id };

    it('should call todoService.updateTodo with valid data and return updated todo', async () => {
      mockUpdateTodo.mockResolvedValue(updatedTodo);

      const res = await app.request(`/todos/${todoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validUpdateData),
      });

      // Check status first for easier debugging
      if (res.status !== 200) {
          console.log('PUT error response body:', await res.text());
      }
      expect(res.status).toBe(200);
      const body = await res.json() as PutTodoResponse;
      expect(body).toEqual({ updatedTodo: updatedTodo });
      expect(mockUpdateTodo).toHaveBeenCalledWith({ 
        id: todoId, 
        authorId: mockUser.id, 
        todo: { 
          title: validUpdateData.title,
          completed: validUpdateData.completed ?? false,
          author_id: mockUser.id,
          description: null, 
          due_date: null,
        } 
      });
    });

    it('should return 400 for invalid data (invalid title type)', async () => {
      const invalidData = { title: 123, completed: true }; // Invalid title type
      const res = await app.request(`/todos/${todoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      });

      // Check error structure from ZodError handler
      const body = await res.json() as ErrorResponse;
      expect(res.status).toBe(400);
      expect(mockUpdateTodo).not.toHaveBeenCalled();
      expect(body.ok).toBe(false);
      expect(body.errors).toBeInstanceOf(Array);
      expect(body.errors?.some((e: any) => e.field === 'title')).toBe(true);
    });

    it('should return 404 if todoService throws todoNotFound ApiError', async () => {
      // Simulate the service throwing a specific ApiError
      const notFoundError = new ApiError('Todo not found', 404);
      mockUpdateTodo.mockRejectedValue(notFoundError);

      const res = await app.request(`/todos/${todoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validUpdateData),
      });

      expect(res.status).toBe(404); 
      expect(mockUpdateTodo).toHaveBeenCalledTimes(1);
      const body = await res.json() as ErrorResponse;
      expect(body.ok).toBe(false);
      expect(body.errorMessage).toBe('Todo not found');
    });
    
    it('should return 403 if todoService throws actionNotAllowed ApiError', async () => {
      // Simulate the service throwing a specific ApiError
      const notAllowedError = new ApiError('Action not allowed', 403); // Assuming 403 for forbidden
      mockUpdateTodo.mockRejectedValue(notAllowedError);

      const res = await app.request(`/todos/${todoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validUpdateData),
      });

      // Now expecting the onError handler to catch ApiError and set status
      expect(res.status).toBe(403); 
      expect(mockUpdateTodo).toHaveBeenCalledTimes(1);
      const body = await res.json() as ErrorResponse;
      expect(body.ok).toBe(false);
      expect(body.errorMessage).toBe('Action not allowed');
    });
  });

  describe('DELETE /todos/:id', () => {
    const todoId = 1;
    const deletedResult = { count: 1 };

    it('should call todoService.deleteTodo and return result', async () => {
      mockDeleteTodo.mockResolvedValue(deletedResult);

      const res = await app.request(`/todos/${todoId}`, {
        method: 'DELETE',
      });

      // Check status first for easier debugging
      if (res.status !== 200) {
          console.log('DELETE error response body:', await res.text());
      }
      expect(res.status).toBe(200);
      // Ensure the response matches the updated mock result
      const body = await res.json() as DeleteTodoResponse;
      expect(body).toEqual({ deletedTodo: { count: 1 } }); 
      expect(mockDeleteTodo).toHaveBeenCalledWith({ id: todoId, authorId: mockUser.id });
    });

    it('should return 404 if todoService throws todoNotFound ApiError', async () => {
      const notFoundError = new ApiError('Todo not found', 404);
      mockDeleteTodo.mockRejectedValue(notFoundError);

      const res = await app.request(`/todos/${todoId}`, {
        method: 'DELETE',
      });

      // Now expecting the onError handler to catch ApiError and set status
      expect(res.status).toBe(404);
      expect(mockDeleteTodo).toHaveBeenCalledTimes(1);
      const body = await res.json() as ErrorResponse;
      expect(body.ok).toBe(false);
      expect(body.errorMessage).toBe('Todo not found');
    });

    it('should return 403 if todoService throws actionNotAllowed ApiError', async () => {
      const notAllowedError = new ApiError('Action not allowed', 403);
      mockDeleteTodo.mockRejectedValue(notAllowedError);

      const res = await app.request(`/todos/${todoId}`, {
        method: 'DELETE',
      });

      // Now expecting the onError handler to catch ApiError and set status
      expect(res.status).toBe(403);
      expect(mockDeleteTodo).toHaveBeenCalledTimes(1);
      const body = await res.json() as ErrorResponse;
      expect(body.ok).toBe(false);
      expect(body.errorMessage).toBe('Action not allowed');
    });
  });
}); 
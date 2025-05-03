import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTodoService, TodoService } from './todo.service';
import { TodoRepository, createTodoRepository } from './todo.repository'; // Import real type and factory
import { CoreTodo } from '../../db/db-types';
import { Insertable, Updateable } from 'kysely';

// --- Mock Dependencies ---

// 1. Mock Repository Module (including factory)
vi.mock('./todo.repository', () => ({
  createTodoRepository: vi.fn(),
  // Mock any standalone functions if necessary (likely none here)
}));

// 3. Import Mocked Functions/Modules AFTER mocks
import { createTodoRepository as mockCreateTodoRepositoryFn } from './todo.repository';


// --- Test Suite Setup ---

// Type for the *instance* methods returned by the (real or mocked) repository factory
type MockTodoRepositoryInstance = {
  findAllTodosByAuthorId: ReturnType<typeof vi.fn>;
  findTodoById: ReturnType<typeof vi.fn>;
  createTodo: ReturnType<typeof vi.fn>;
  updateTodo: ReturnType<typeof vi.fn>;
  deleteTodo: ReturnType<typeof vi.fn>;
};

describe('TodoService', () => {
  let todoService: TodoService;
  let mockRepoInstance: MockTodoRepositoryInstance;
  let mockRepoFactory: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock instance for repository methods
    mockRepoInstance = {
      findAllTodosByAuthorId: vi.fn(),
      findTodoById: vi.fn(),
      createTodo: vi.fn(),
      updateTodo: vi.fn(),
      deleteTodo: vi.fn(),
    };

    // Get the mocked factory function
    mockRepoFactory = vi.mocked(mockCreateTodoRepositoryFn);

    // Configure the factory mock (though service takes instance directly)
    // This setup assumes the service constructor expects an instance,
    // matching the original structure but using the more explicit mocking style.
    mockRepoFactory.mockReturnValue(mockRepoInstance as unknown as TodoRepository);

    // Create the service instance, directly passing the mocked instance
    // This matches the original createTodoService signature which expects the instance.
    todoService = createTodoService({ todoRepository: mockRepoInstance as unknown as TodoRepository });

  });

  // --- Test findAllTodosByAuthorId ---
  describe('findAllTodosByAuthorId', () => {
    it('should call repository.findAllTodosByAuthorId with the correct authorId', async () => {
      const authorId = 123;
      const expectedTodos: CoreTodo[] = [
        { id: 1, title: 'Test Todo 1', completed: false, author_id: authorId, created_at: new Date(), updated_at: new Date() } as any,
        { id: 2, title: 'Test Todo 2', completed: true, author_id: authorId, created_at: new Date(), updated_at: new Date() } as any,
      ];
      mockRepoInstance.findAllTodosByAuthorId.mockResolvedValue(expectedTodos);

      const result = await todoService.findAllTodosByAuthorId({ authorId });

      expect(mockRepoInstance.findAllTodosByAuthorId).toHaveBeenCalledWith({ authorId });
      expect(result).toEqual(expectedTodos);
    });
  });

  // --- Test createTodo ---
  describe('createTodo', () => {
    it('should call repository.createTodo with the correct authorId and todo data', async () => {
      const authorId = 123;
      const todoData: Insertable<CoreTodo> = { title: 'New Todo', completed: false, author_id: authorId };
      const createdTodo: CoreTodo = { ...todoData, id: 1, created_at: new Date(), updated_at: new Date() } as any;
      mockRepoInstance.createTodo.mockResolvedValue(createdTodo);

      const result = await todoService.createTodo({ authorId, todo: todoData });

      expect(mockRepoInstance.createTodo).toHaveBeenCalledWith({ authorId, todo: todoData });
      expect(result).toEqual(createdTodo);
    });
  });

  // --- Test updateTodo ---
  describe('updateTodo', () => {
    const authorId = 123;
    const todoId = 1;
    const existingTodo: CoreTodo = { id: todoId, title: 'Existing Todo', completed: false, author_id: authorId, created_at: new Date(), updated_at: new Date() } as any;
    const updateData: Updateable<CoreTodo> = { title: 'Updated Todo', completed: true };
    const updatedTodo: CoreTodo = { ...existingTodo, ...updateData, updated_at: new Date() } as any;

    it('should update the todo if found and author matches', async () => {
      mockRepoInstance.findTodoById.mockResolvedValue(existingTodo);
      mockRepoInstance.updateTodo.mockResolvedValue(updatedTodo);

      const result = await todoService.updateTodo({ id: todoId, todo: updateData, authorId });

      expect(mockRepoInstance.findTodoById).toHaveBeenCalledWith({ id: todoId });
      expect(mockRepoInstance.updateTodo).toHaveBeenCalledWith({ id: todoId, todo: updateData });
     // expect(mockErrors.todos.todoNotFound).not.toHaveBeenCalled();
     // expect(mockErrors.todos.actionNotAllowed).not.toHaveBeenCalled();
      expect(result).toEqual(updatedTodo);
    });

    it('should throw todoNotFound error if todo is not found', async () => {
      mockRepoInstance.findTodoById.mockResolvedValue(null);

      await expect(todoService.updateTodo({ id: todoId, todo: updateData, authorId })).rejects.toThrow('Todo not found');

      expect(mockRepoInstance.findTodoById).toHaveBeenCalledWith({ id: todoId });
      expect(mockRepoInstance.updateTodo).not.toHaveBeenCalled();
      //expect(mockErrors.todos.todoNotFound).toHaveBeenCalledTimes(1);
      //expect(mockErrors.todos.actionNotAllowed).not.toHaveBeenCalled();
    });

    it('should throw actionNotAllowed error if author does not match', async () => {
      const otherAuthorId = 456;
      const todoFromOtherAuthor: CoreTodo = { ...existingTodo, author_id: otherAuthorId } as any;
      mockRepoInstance.findTodoById.mockResolvedValue(todoFromOtherAuthor);

      await expect(todoService.updateTodo({ id: todoId, todo: updateData, authorId })).rejects.toThrow('Action not allowed');

      expect(mockRepoInstance.findTodoById).toHaveBeenCalledWith({ id: todoId });
      expect(mockRepoInstance.updateTodo).not.toHaveBeenCalled();
      //expect(mockErrors.todos.todoNotFound).not.toHaveBeenCalled();
      //expect(mockErrors.todos.actionNotAllowed).toHaveBeenCalledTimes(1);
    });
  });

  // --- Test deleteTodo ---
  describe('deleteTodo', () => {
    const authorId = 123;
    const todoId = 1;
    const existingTodo: CoreTodo = { id: todoId, title: 'Existing Todo', completed: false, author_id: authorId, created_at: new Date(), updated_at: new Date() } as any;
    const deletedResult = { count: 1n }; // Example result from Kysely delete

    it('should delete the todo if found and author matches', async () => {
      mockRepoInstance.findTodoById.mockResolvedValue(existingTodo);
      mockRepoInstance.deleteTodo.mockResolvedValue(deletedResult);

      const result = await todoService.deleteTodo({ id: todoId, authorId });

      expect(mockRepoInstance.findTodoById).toHaveBeenCalledWith({ id: todoId });
      expect(mockRepoInstance.deleteTodo).toHaveBeenCalledWith({ id: todoId });
      //expect(mockErrors.todos.todoNotFound).not.toHaveBeenCalled();
      //expect(mockErrors.todos.actionNotAllowed).not.toHaveBeenCalled();
      expect(result).toEqual(deletedResult);
    });

    it('should throw todoNotFound error if todo is not found', async () => {
      mockRepoInstance.findTodoById.mockResolvedValue(null);

      await expect(todoService.deleteTodo({ id: todoId, authorId })).rejects.toThrow('Todo not found');

      expect(mockRepoInstance.findTodoById).toHaveBeenCalledWith({ id: todoId });
      expect(mockRepoInstance.deleteTodo).not.toHaveBeenCalled();
      //expect(mockErrors.todos.todoNotFound).toHaveBeenCalledTimes(1);
      //expect(mockErrors.todos.actionNotAllowed).not.toHaveBeenCalled();
    });

    it('should throw actionNotAllowed error if author does not match', async () => {
      const otherAuthorId = 456;
      const todoFromOtherAuthor: CoreTodo = { ...existingTodo, author_id: otherAuthorId } as any;
      mockRepoInstance.findTodoById.mockResolvedValue(todoFromOtherAuthor);

      await expect(todoService.deleteTodo({ id: todoId, authorId })).rejects.toThrow('Action not allowed');

      expect(mockRepoInstance.findTodoById).toHaveBeenCalledWith({ id: todoId });
      expect(mockRepoInstance.deleteTodo).not.toHaveBeenCalled();
     // expect(mockErrors.todos.todoNotFound).not.toHaveBeenCalled();
      // expect(mockErrors.todos.actionNotAllowed).toHaveBeenCalledTimes(1);
    });
  });
});
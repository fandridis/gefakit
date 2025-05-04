import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTodoService, TodoService } from './todo.service';
import { todoErrors } from './todo.errors';

// Define the structure of the mock instance based on the TodoRepository type
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

  beforeEach(() => {
    vi.clearAllMocks();

    // Create the mock instance for the repository dependency
    mockRepoInstance = {
      findAllTodosByAuthorId: vi.fn(),
      findTodoById: vi.fn(),
      createTodo: vi.fn(),
      updateTodo: vi.fn(),
      deleteTodo: vi.fn(),
    };

    // Create the service instance, passing the mock repository instance directly
    todoService = createTodoService({ todoRepository: mockRepoInstance });
  });

  // --- Test findAllTodosByAuthorId ---
  describe('findAllTodosByAuthorId', () => {
    it('should call repository.findAllTodosByAuthorId with the correct authorId and return the result', async () => {
      const authorId = 123;
      const expectedTodos = [
        { id: 1, title: 'Test Todo 1', completed: false, author_id: authorId, created_at: new Date(), updated_at: new Date() } as any,
        { id: 2, title: 'Test Todo 2', completed: true, author_id: authorId, created_at: new Date(), updated_at: new Date() } as any,
      ];
      // Configure the mock repository method's return value
      mockRepoInstance.findAllTodosByAuthorId.mockResolvedValue(expectedTodos);

      const result = await todoService.findAllTodosByAuthorId({ authorId });

      // Assert that the mock repository method was called correctly
      expect(mockRepoInstance.findAllTodosByAuthorId).toHaveBeenCalledWith({ authorId });
      // Assert that the service returned the result from the repository
      expect(result).toEqual(expectedTodos);
    });
  });

  // --- Test createTodo ---
  describe('createTodo', () => {
    it('should call repository.createTodo with the correct authorId and todo data and return the created todo', async () => {
      const authorId = 123;
      const todoData = { title: 'New Todo', completed: false, author_id: authorId, description: null, due_date: null };
      const createdTodo = { ...todoData, id: 1, created_at: new Date() };

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
    // Use CoreTodo for the existing data pulled from the repo
    const existingTodo = { id: todoId, title: 'Existing Todo', completed: false, author_id: authorId, created_at: new Date(), updated_at: new Date(), description: '...', due_date: null };
     // Use Updateable for the update data input
    const updateData = { title: 'Updated Todo', completed: true };
     // Use CoreTodo for the expected result after update
    const updatedTodo = { ...existingTodo, ...updateData, updated_at: new Date() };

    it('should update the todo if found and author matches', async () => {
      // Mock findTodoById to return the existing todo
      mockRepoInstance.findTodoById.mockResolvedValue(existingTodo);
      // Mock updateTodo to return the expected updated todo
      mockRepoInstance.updateTodo.mockResolvedValue(updatedTodo);

      const result = await todoService.updateTodo({ id: todoId, todo: updateData, authorId });

      // Assert findTodoById was called
      expect(mockRepoInstance.findTodoById).toHaveBeenCalledWith({ id: todoId });
      // Assert updateTodo was called with the correct arguments
      expect(mockRepoInstance.updateTodo).toHaveBeenCalledWith({ id: todoId, todo: updateData });
      // Assert the service returned the result from updateTodo
      expect(result).toEqual(updatedTodo);
    });

    it('should throw todoErrors.todoNotFound error if todo is not found', async () => {
      // Mock findTodoById to return null, simulating not found
      mockRepoInstance.findTodoById.mockResolvedValue(null);

      // Assert that calling updateTodo throws the specific error
      await expect(todoService.updateTodo({ id: todoId, todo: updateData, authorId })).rejects.toThrow(todoErrors.todoNotFound()); // Check the actual error object/message

      // Assert findTodoById was called
      expect(mockRepoInstance.findTodoById).toHaveBeenCalledWith({ id: todoId });
      // Assert updateTodo was NOT called because of the error
      expect(mockRepoInstance.updateTodo).not.toHaveBeenCalled();
    });

    it('should throw todoErrors.actionNotAllowed error if author does not match', async () => {
      const otherAuthorId = 456;
      // Mock findTodoById to return a todo with a different author_id
      const todoFromOtherAuthor = { ...existingTodo, author_id: otherAuthorId } ;
      mockRepoInstance.findTodoById.mockResolvedValue(todoFromOtherAuthor);

      // Assert that calling updateTodo throws the specific error
      await expect(todoService.updateTodo({ id: todoId, todo: updateData, authorId })).rejects.toThrow(todoErrors.actionNotAllowed()); // Check the actual error object/message

      // Assert findTodoById was called
      expect(mockRepoInstance.findTodoById).toHaveBeenCalledWith({ id: todoId });
      // Assert updateTodo was NOT called because of the error
      expect(mockRepoInstance.updateTodo).not.toHaveBeenCalled();
    });
  });

  // --- Test deleteTodo ---
  describe('deleteTodo', () => {
    const authorId = 123;
    const todoId = 1;
    const existingTodo = { id: todoId, title: 'Existing Todo', completed: false, author_id: authorId, created_at: new Date(), updated_at: new Date(), description: '...', due_date: null };
    const deletedResult = { count: 1n };

    it('should delete the todo if found and author matches', async () => {
      mockRepoInstance.findTodoById.mockResolvedValue(existingTodo);
      mockRepoInstance.deleteTodo.mockResolvedValue(deletedResult);

      const result = await todoService.deleteTodo({ id: todoId, authorId });

      expect(mockRepoInstance.findTodoById).toHaveBeenCalledWith({ id: todoId });
      expect(mockRepoInstance.deleteTodo).toHaveBeenCalledWith({ id: todoId });
      expect(result).toEqual(deletedResult);
    });

    it('should throw todoErrors.todoNotFound error if todo is not found', async () => {
      mockRepoInstance.findTodoById.mockResolvedValue(null);

      await expect(todoService.deleteTodo({ id: todoId, authorId })).rejects.toThrow(todoErrors.todoNotFound());

      expect(mockRepoInstance.findTodoById).toHaveBeenCalledWith({ id: todoId });
      expect(mockRepoInstance.deleteTodo).not.toHaveBeenCalled();
    });

    it('should throw todoErrors.actionNotAllowed error if author does not match', async () => {
      const otherAuthorId = 456;
      const todoFromOtherAuthor = { ...existingTodo, author_id: otherAuthorId };
      mockRepoInstance.findTodoById.mockResolvedValue(todoFromOtherAuthor);

      await expect(todoService.deleteTodo({ id: todoId, authorId })).rejects.toThrow(todoErrors.actionNotAllowed());

      expect(mockRepoInstance.findTodoById).toHaveBeenCalledWith({ id: todoId });
      expect(mockRepoInstance.deleteTodo).not.toHaveBeenCalled();
    });
  });
});
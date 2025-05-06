import { CreateTodoRequestBodyDTO, CreateTodoResponseDTO, DeleteTodoResponseDTO, TodoDTO, UpdateTodoRequestBodyDTO, UpdateTodoResponseDTO } from "@gefakit/shared/src/types/todo";

const API_BASE_URL = import.meta.env.VITE_API_URL + '/api/v1/todos';

export const apiGetTodos = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch todos: Server responded with ${response.status}`);
    }

    const data = await response.json();
    return data as { todos: TodoDTO[] };
  } catch (error) {
    console.error("Error during apiGetTodos fetch:", error);
    throw error;
  }
};

export const apiCreateTodo = async (todoData: CreateTodoRequestBodyDTO) => {
  try {
    const response = await fetch(`${API_BASE_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(todoData),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to create todo' }));
      throw new Error(errorData.message || 'Todo creation failed');
    }
    const data = await response.json();
    return data as CreateTodoResponseDTO;
  } catch (error) {
    console.error("Error during apiCreateTodo fetch:", error);
    throw error;
  }
};

export const apiUpdateTodo = async (id: number, todoData: UpdateTodoRequestBodyDTO) => {
  try {
    const response = await fetch(`${API_BASE_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(todoData),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to update todo' }));
      throw new Error(errorData.message || 'Todo update failed');
    }
    const data = await response.json();
    return data as UpdateTodoResponseDTO;
  } catch (error) {
    console.error("Error during apiUpdateTodo fetch:", error);
    throw error;
  }
};

// Note: The backend route for deleting todos (DELETE /:id) might not be implemented yet.
export const apiDeleteTodo = async (id: number) => {
  try {
    const response = await fetch(`${API_BASE_URL}/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      // Handle potential errors, e.g., todo not found (404) or server error (500)
      const errorData = await response.json().catch(() => ({ message: 'Failed to delete todo' }));
      // Check for 404 specifically if needed, or just throw a general error
      throw new Error(errorData.message || `Todo deletion failed with status ${response.status}`);
    }

    const data = await response.json();
    return data as DeleteTodoResponseDTO;
  } catch (error) {
    console.error("Error during apiDeleteTodo fetch:", error);
    throw error;
  }
};

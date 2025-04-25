import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGetTodos, apiCreateTodo, apiUpdateTodo, apiDeleteTodo } from '../api';
import { TodoDTO, UpdateTodoRequestBodyDTO } from '@gefakit/shared/src/types/todo';

export function useTodos() {
    const queryClient = useQueryClient();

    // Fetch Todos Query
    const { data: todosData, isLoading: isLoadingTodos, error: todosError } = useQuery<{ todos: TodoDTO[] }, Error >({
        queryKey: ['todos'],
        queryFn: apiGetTodos,
        // staleTime: 5 * 60 * 1000, // Optional: Configure data freshness
    });

    // Create Todo Mutation
    const { mutate: createTodo, isPending: isCreatingTodo } = useMutation({
        mutationFn: apiCreateTodo,
        onMutate: async (newTodo) => {
            // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
            await queryClient.cancelQueries({ queryKey: ['todos'] });

            // Snapshot the previous value
            const previousTodos = queryClient.getQueryData< { todos: TodoDTO[] } >(['todos']);

            // Optimistically update to the new value
            if (previousTodos) {
                queryClient.setQueryData< { todos: TodoDTO[] } >(['todos'], {
                    todos: [
                        ...previousTodos.todos,
                        // Add a temporary ID for the optimistic update
                        // The actual ID will come from the server response
                        { ...newTodo, id: Date.now(), completed: false, author_id: -1 /* Placeholder */ },
                    ],
                });
            }

            // Return a context object with the snapshotted value
            return { previousTodos };
        },
        // If the mutation fails, use the context returned from onMutate to roll back
        onError: (err, newTodo, context) => {
            if (context?.previousTodos) {
                queryClient.setQueryData(['todos'], context.previousTodos);
            }
            console.error("Error creating todo:", err);
            // Optionally: show a notification to the user
        },
        // Always refetch after error or success:
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['todos'] });
        },
    });

    // Update Todo Mutation
    const { mutate: updateTodo, isPending: isUpdatingTodo } = useMutation({
        mutationFn: ({ id, data }: { id: number; data: UpdateTodoRequestBodyDTO }) => apiUpdateTodo(id, data),
        onMutate: async ({ id, data: updatedTodoData }) => {
            await queryClient.cancelQueries({ queryKey: ['todos'] });
            const previousTodos = queryClient.getQueryData< { todos: TodoDTO[] } >(['todos']);

            if (previousTodos) {
                queryClient.setQueryData< { todos: TodoDTO[] } >(['todos'], {
                    todos: previousTodos.todos.map((todo) =>
                        todo.id === id ? { ...todo, ...updatedTodoData } : todo
                    ),
                });
            }
            return { previousTodos };
        },
        onError: (err, variables, context) => {
            if (context?.previousTodos) {
                queryClient.setQueryData(['todos'], context.previousTodos);
            }
            console.error("Error updating todo:", err);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['todos'] });
        },
    });

    // Delete Todo Mutation
    const { mutate: deleteTodo, isPending: isDeletingTodo } = useMutation({
        mutationFn: apiDeleteTodo,
        onMutate: async (idToDelete) => {
            await queryClient.cancelQueries({ queryKey: ['todos'] });
            const previousTodos = queryClient.getQueryData< { todos: TodoDTO[] } >(['todos']);

            if (previousTodos) {
                queryClient.setQueryData< { todos: TodoDTO[] } >(['todos'], {
                    todos: previousTodos.todos.filter((todo) => todo.id !== idToDelete),
                });
            }
            return { previousTodos };
        },
        onError: (err, idToDelete, context) => {
            if (context?.previousTodos) {
                queryClient.setQueryData(['todos'], context.previousTodos);
            }
            console.error("Error deleting todo:", err);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['todos'] });
        },
    });

    return {
        todos: todosData?.todos ?? [], // Provide a default empty array
        isLoadingTodos,
        todosError,
        createTodo,
        isCreatingTodo,
        updateTodo,
        isUpdatingTodo,
        deleteTodo,
        isDeletingTodo,
    };
}
import { useTodos } from "../hooks/useTodos";
import { useForm } from "@tanstack/react-form";
import type { AnyFieldApi } from '@tanstack/react-form'
import {
    TodoDTO,
    CreateTodoRequestBodyDTO,
    UpdateTodoRequestBodyDTO,
} from "@gefakit/shared/src/types/todo";
import { createTodoRequestBodySchema } from "@gefakit/shared/src/schemas/todo.schema";
import { useAppForm } from "@/components/form/form";

function FieldInfo({ field }: { field: AnyFieldApi }) {
    return (
        <>
            {field.state.meta.isTouched && field.state.meta.errors.length ? (
                <em style={{ color: 'red', marginLeft: '5px' }}>{field.state.meta.errors.join(',')}</em>
            ) : null}
            {field.state.meta.isValidating ? 'Validating...' : null}
        </>
    )
}

export function TodoView() {
    // Destructure the values from the useTodos hook
    const {
        todos,
        isLoadingTodos,
        todosError,
        createTodo,
        isCreatingTodo,
        updateTodo,
        // isUpdatingTodo, // Uncomment if you want to show loading state for updates
        deleteTodo,
        // isDeletingTodo, // Uncomment if you want to show loading state for deletes
    } = useTodos();

    // Use useForm for the new todo input
    const form = useAppForm({
        defaultValues: {
            title: "",
            description: '',
            due_date: null,
            completed: false,
        } as CreateTodoRequestBodyDTO,
        validators: {
            onBlur: createTodoRequestBodySchema,
        },
        onSubmit: async ({ value }) => {
            createTodo(value);
        }
    })

    // const form = useForm({
    //     defaultValues: {
    //         title: "",
    //     },
    //     validators: {
    //         onBlur: createTodoRequestBodySchema,
    //     },
    //     onSubmit: async ({ value }) => {
    //         // Create the full DTO for creation
    //         const newTodoData: CreateTodoRequestBodyDTO = {
    //             title: value.title.trim(),
    //             description: null, // Provide default or null values
    //             due_date: null,
    //             completed: false,
    //         };
    //         createTodo(newTodoData, {
    //             onSuccess: () => {
    //                 form.reset(); // Reset form after successful creation
    //             },
    //         });
    //     },
    // });

    const handleToggleComplete = (todo: TodoDTO) => {
        // Create the full DTO for update, only changing 'completed'
        const updateData: UpdateTodoRequestBodyDTO = {
            title: todo.title,
            description: todo.description,
            due_date: todo.due_date,
            completed: !todo.completed, // Toggle the completed status
        };
        updateTodo({ id: todo.id, data: updateData });
    };

    const handleDeleteTodo = (id: number) => {
        deleteTodo(id);
    };

    if (isLoadingTodos) {
        return <div>Loading todos...</div>;
    }

    if (todosError) {
        return <div>Error loading todos: {todosError.message}</div>;
    }

    return (
        <div>
            <h2>Todos</h2>

            {/* Create Todo Form using @tanstack/react-form */}
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    form.handleSubmit();
                }}
            >
                <form.AppForm>
                    <form.AppField
                        name='title'
                        children={(field) =>
                            <>
                                <field.Label label="Title" />
                                <field.TextInput />
                                <field.Info />
                            </>}
                    />
                    <form.SubmitButton label="Add Todo" loading={isCreatingTodo} />
                </form.AppForm>
            </form>

            {/* Todo List */}
            <ul>
                {todos.map((todo) => (
                    <li key={todo.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                        <input
                            type="checkbox"
                            checked={todo.completed}
                            onChange={() => handleToggleComplete(todo)}
                            style={{ marginRight: '10px' }}
                        />
                        <span style={{ textDecoration: todo.completed ? 'line-through' : 'none', flexGrow: 1 }}>
                            {todo.title} {todo.description ? `(${todo.description})` : ''} {/* Optionally display description */}
                        </span>
                        {/* Optionally display due date */}
                        {todo.due_date && <span style={{ fontStyle: 'italic', marginRight: '10px' }}>Due: {new Date(todo.due_date).toLocaleDateString()}</span>}
                        <button onClick={() => handleDeleteTodo(todo.id)} style={{ marginLeft: '10px' }}>
                            {/* Consider adding disabled state based on isDeletingTodo if needed */}
                            Delete
                        </button>
                    </li>
                ))}
            </ul>
            {todos.length === 0 && !isLoadingTodos && <p>No todos yet!</p>}
        </div>
    );
}
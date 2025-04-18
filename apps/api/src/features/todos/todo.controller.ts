import { Insertable, Kysely, Updateable, Selectable } from "kysely";
import { CoreTodo } from "../../db/db-types";
import { AppError } from "../../errors/app-error";
import { TodoService } from "./todo.service";

export interface TodoController {
    getTodos(authorId: number): Promise<{ todos: Selectable<CoreTodo>[] }>;
    createTodo(authorId: number, todo: Insertable<CoreTodo>): Promise<{ todo: Selectable<CoreTodo> }>;
    updateTodo(id: number, updateableTodo: Updateable<CoreTodo>, userId: number): Promise<{ todo: Selectable<CoreTodo> }>;
    deleteTodo(id: number, userId: number): Promise<{ todo: Selectable<CoreTodo> }>;
}

// Inject the service
export function createTodoController(todoService: TodoService): TodoController {
    async function getTodos(authorId: number) {
        try {
            const result = await todoService.findAllTodosByAuthorId(authorId);
            return { todos: result };
        } catch (err) {
            if (err instanceof AppError) {
                throw err;
            }
            console.error("Unexpected error in controller.getTodos:", err);
            throw err;
        }
    }

    async function createTodo(authorId: number, todo: Insertable<CoreTodo>) {
        try {
            const result = await todoService.createTodo(authorId, todo);
            return { todo: result };
        } catch (err) {
            if (err instanceof AppError) {
                throw err;
            }
            console.error("Unexpected error in controller.createTodo:", err);
            throw err;
        }
    }

    async function updateTodo(id: number, updateableTodo: Updateable<CoreTodo>, userId: number) {
        try {
            const result = await todoService.updateTodo(id, updateableTodo, userId);
            return { todo: result };
        } catch (err) {
            if (err instanceof AppError) {
                throw err;
            }
            console.error("Unexpected error in controller.updateTodo:", err);
            throw err;
        }
    }

    async function deleteTodo(id: number, userId: number) {
        try {
            const result = await todoService.deleteTodo(id, userId);
            return { todo: result };
        } catch (err) {
            if (err instanceof AppError) {
                throw err;  
            }
            console.error("Unexpected error in controller.deleteTodo:", err);
            throw err;
        }
    }


    return {
        getTodos,
        createTodo,
        updateTodo,
        deleteTodo,
    };
}
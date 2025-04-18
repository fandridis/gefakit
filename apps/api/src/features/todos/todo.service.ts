import { Insertable, Kysely, Updateable, Selectable, Transaction } from "kysely";
import { CoreTodo, DB } from "../../db/db-types";
import { TodoRepository } from "./todo.repository";
import { createAppError } from "../../errors";

export interface TodoService {
    findAllTodosByAuthorId(authorId: number): Promise<Selectable<CoreTodo>[]>;
    createTodo(authorId: number, todo: Insertable<CoreTodo>): Promise<Selectable<CoreTodo>>;
    updateTodo(id: number, updateableTodo: Updateable<CoreTodo>, userId: number): Promise<Selectable<CoreTodo>>;
    deleteTodo(id: number, userId: number): Promise<Selectable<CoreTodo>>;
}

export function createTodoService(db: Kysely<DB>, repository: TodoRepository): TodoService {
    /**
     * Fetches all todos for a given author.
     *
     * @param authorId - The id of the author.
     * @returns A Promise resolving to the list of todos.
     */
    async function findAllTodosByAuthorId(authorId: number) {
        return repository.findAllTodosByAuthorId(authorId);
    }

    async function createTodo(authorId: number, todo: Insertable<CoreTodo>) {
        return repository.createTodo(authorId, todo);
    }

    async function updateTodo(id: number, updateableTodo: Updateable<CoreTodo>, userId: number) {
        const todo = await repository.findTodoById(id);

        if (!todo) {
            throw createAppError.todos.todoNotFound();
        }

        if (todo.author_id !== userId) {
            throw createAppError.todos.actionNotAllowed();
        }

        return repository.updateTodo(id, updateableTodo);
    }

    async function deleteTodo(id: number, userId: number) {
        const todo = await repository.findTodoById(id);

        if (!todo) {
            throw createAppError.todos.todoNotFound();
        }

        if (todo.author_id !== userId) {
            throw createAppError.todos.actionNotAllowed('This is not your todo to delete!');
        }

        return repository.deleteTodo(id);
    }

    return {
        findAllTodosByAuthorId,
        createTodo,
        updateTodo,
        deleteTodo
    };
}
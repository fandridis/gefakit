import { Insertable, Kysely, Updateable } from "kysely";
import { CoreTodo, DB } from "../../db/db-types";
import { createTodoRepository } from "./todo.repository";
import { createAppError } from "../../errors";

export function createTodoService(db: Kysely<DB>) {
    const repository = createTodoRepository(db);

    /**
     * Asynchronously hashes a password using bcrypt.
     *
     * @param authorId - The id of the author of the todos.
     * @returns A Promise that resolves to the todos.
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
import { Insertable, Updateable } from "kysely";
import { CoreTodo } from "../../db/db-types";
import { TodoRepository } from "./todo.repository";
import { createAppError } from "../../errors";


export type TodoService = ReturnType<typeof createTodoService>

export function createTodoService({ todoRepository }: { todoRepository: TodoRepository }) {
    async function findAllTodosByAuthorId(authorId: number) {
        return todoRepository.findAllTodosByAuthorId(authorId);
    }

    async function createTodo(authorId: number, todo: Insertable<CoreTodo>) {
        return todoRepository.createTodo(authorId, todo);
    }

    async function updateTodo(id: number, updateableTodo: Updateable<CoreTodo>, userId: number) {
        const todo = await todoRepository.findTodoById(id);

        if (!todo) {
            throw createAppError.todos.todoNotFound();
        }

        if (todo.author_id !== userId) {
            throw createAppError.todos.actionNotAllowed();
        }

        return todoRepository.updateTodo(id, updateableTodo);
    }

    async function deleteTodo(id: number, userId: number) {
        const todo = await todoRepository.findTodoById(id);

        if (!todo) {
            throw createAppError.todos.todoNotFound();
        }

        if (todo.author_id !== userId) {
            throw createAppError.todos.actionNotAllowed('This is not your todo to delete!');
        }

        return todoRepository.deleteTodo(id);
    }

    return {
        findAllTodosByAuthorId,
        createTodo,
        updateTodo,
        deleteTodo
    };
}
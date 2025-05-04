import { Insertable, Updateable } from "kysely";
import { CoreTodo } from "../../db/db-types";
import { TodoRepository } from "./todo.repository";
import { todoErrors } from "./todo.errors";

export type TodoService = ReturnType<typeof createTodoService>

export function createTodoService({ todoRepository }: { todoRepository: TodoRepository }) {
    async function findAllTodosByAuthorId({authorId}: {authorId: number}) {
        return todoRepository.findAllTodosByAuthorId({authorId});
    }

    async function createTodo({authorId, todo}: {authorId: number, todo: Insertable<CoreTodo>}) {
        return todoRepository.createTodo({authorId, todo});
    }

    async function updateTodo({id, todo, authorId}: {id: number, todo: Updateable<CoreTodo>, authorId: number}) {
        const todoFound = await todoRepository.findTodoById({id});

        if (!todoFound) {
            throw todoErrors.todoNotFound();
        }

        if (todoFound.author_id !== authorId) {
            throw todoErrors.actionNotAllowed();
        }

        return todoRepository.updateTodo({id, todo});
    }

    async function deleteTodo({id, authorId}: {id: number, authorId: number}) {
        const todoFound = await todoRepository.findTodoById({id});

        if (!todoFound) {
            throw todoErrors.todoNotFound();
        }

        if (todoFound.author_id !== authorId) {
            throw todoErrors.actionNotAllowed();
        }

        return todoRepository.deleteTodo({id});
    }

    return {
        findAllTodosByAuthorId,
        createTodo,
        updateTodo,
        deleteTodo
    };
}
import { Insertable, Kysely, Updateable } from "kysely";
import { CoreTodo, DB } from "../../db/db-types";

export function createTodoRepository(db: Kysely<DB>) {
    return {
        async findAllTodosByAuthorId(authorId: number) {
            return db
                .selectFrom('core.todos')
                .selectAll()
                .where('author_id', '=', authorId)
                .execute();
        },

        async findTodoById(id: number) {
            return db
                .selectFrom('core.todos')
                .selectAll()
                .where('id', '=', id)
                .executeTakeFirst();
        },

        async createTodo(authorId: number, insertableTodo: Insertable<CoreTodo>) {
            return db
                .insertInto('core.todos')
                .values({ ...insertableTodo, author_id: authorId })
                .returningAll()
                .executeTakeFirstOrThrow();
        },

        async updateTodo(id: number, updateableTodo: Updateable<CoreTodo>) {
            return db
                .updateTable('core.todos')
                .set(updateableTodo)
                .where('id', '=', id)
                .returningAll()
                .executeTakeFirstOrThrow()

        },

        async deleteTodo(id: number) {
            return db
                .deleteFrom('core.todos')
                .where('id', '=', id)
                .returningAll()
                .executeTakeFirstOrThrow();
        },
    };
}

export type TodoRepository = ReturnType<typeof createTodoRepository>;
export type FindAllTodosByAuthorIdResponse = Awaited<ReturnType<TodoRepository['findAllTodosByAuthorId']>>;
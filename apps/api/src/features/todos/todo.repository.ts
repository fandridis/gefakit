import { Insertable, Kysely, Updateable, Transaction, Selectable } from "kysely";
import { CoreTodo, DB } from "../../db/db-types";


export type TodoRepository = ReturnType<typeof createTodoRepository>

export function createTodoRepository({ db }: { db: Kysely<DB> | Transaction<DB> }) {
    return {
        async findAllTodosByAuthorId({authorId}: {authorId: number}) {
            return db
                .selectFrom('core.todos')
                .selectAll()
                .where('author_id', '=', authorId)
                .execute();
        },

        async findTodoById({id}: {id: number}) {
            return db
                .selectFrom('core.todos')
                .selectAll()
                .where('id', '=', id)
                .executeTakeFirst();
        },

        async createTodo({authorId, todo}: {authorId: number, todo: Insertable<CoreTodo>}) {
            return db
                .insertInto('core.todos')
                .values({ ...todo, author_id: authorId })
                .returningAll()
                .executeTakeFirstOrThrow();
        },

        async updateTodo({id, todo}: {id: number, todo: Updateable<CoreTodo>}) {
            return db
                .updateTable('core.todos')
                .set(todo)
                .where('id', '=', id)
                .returningAll()
                .executeTakeFirstOrThrow()

        },

        async deleteTodo({id}: {id: number}) {
            return db
                .deleteFrom('core.todos')
                .where('id', '=', id)
                .returningAll()
                .executeTakeFirstOrThrow();
        },
    };
}

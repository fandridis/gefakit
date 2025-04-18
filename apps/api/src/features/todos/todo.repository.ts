import { Insertable, Kysely, Updateable, Transaction, Selectable } from "kysely";
import { CoreTodo, DB } from "../../db/db-types";

type DbOrTrx = Kysely<DB> | Transaction<DB>;

export interface TodoRepository {
    findAllTodosByAuthorId(authorId: number): Promise<Selectable<CoreTodo>[]>;
    findTodoById(id: number): Promise<Selectable<CoreTodo> | undefined>;
    createTodo(authorId: number, insertableTodo: Insertable<CoreTodo>): Promise<Selectable<CoreTodo>>;
    updateTodo(id: number, updateableTodo: Updateable<CoreTodo>): Promise<Selectable<CoreTodo>>;
    deleteTodo(id: number): Promise<Selectable<CoreTodo>>;
}


export function createTodoRepository(dbOrTrx: DbOrTrx): TodoRepository {
    return {
        async findAllTodosByAuthorId(authorId: number) {
            // Use the injected dbOrTrx
            return dbOrTrx
                .selectFrom('core.todos')
                .selectAll()
                .where('author_id', '=', authorId)
                .execute();
        },

        async findTodoById(id: number) {
            // Use the injected dbOrTrx
            return dbOrTrx
                .selectFrom('core.todos')
                .selectAll()
                .where('id', '=', id)
                .executeTakeFirst();
        },

        async createTodo(authorId: number, insertableTodo: Insertable<CoreTodo>) {
             // Use the injected dbOrTrx
            return dbOrTrx
                .insertInto('core.todos')
                .values({ ...insertableTodo, author_id: authorId })
                .returningAll()
                .executeTakeFirstOrThrow();
        },

        async updateTodo(id: number, updateableTodo: Updateable<CoreTodo>) {
             // Use the injected dbOrTrx
            return dbOrTrx
                .updateTable('core.todos')
                .set(updateableTodo)
                .where('id', '=', id)
                .returningAll()
                .executeTakeFirstOrThrow()

        },

        async deleteTodo(id: number) {
             // Use the injected dbOrTrx
            return dbOrTrx
                .deleteFrom('core.todos')
                .where('id', '=', id)
                .returningAll()
                .executeTakeFirstOrThrow();
        },
    };
}

import { z } from "zod";
import { createTodoRequestBodySchema, todoSchema, updateTodoRequestBodySchema } from "../schemas/todo.schema";

export type TodoDTO = z.infer<typeof todoSchema>;

export type CreateTodoRequestBodyDTO = z.infer<typeof createTodoRequestBodySchema>;
export type CreateTodoResponseDTO = { createdTodo: TodoDTO };

export type UpdateTodoRequestBodyDTO = z.infer<typeof updateTodoRequestBodySchema>;
export type UpdateTodoResponseDTO = { updatedTodo: TodoDTO };

export type DeleteTodoResponseDTO = { deletedTodo: TodoDTO };
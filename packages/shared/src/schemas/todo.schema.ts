import { z } from 'zod';

/** 
 * This is how a complete todo object looks like.
 */
export const todoSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  description: z.string().nullable(),
  due_date: z.coerce.date().nullable(),
  completed: z.boolean(),
  author_id: z.number().int().positive(),
  created_at: z.date(),
});
export type Todo = z.infer<typeof todoSchema>;


/**
 * This is what the client sends to the server and what the service expects.
 */
export const creatableTodoSchema = todoSchema
  .omit({ id: true, author_id: true, created_at: true })
  .extend({
    title: z.string().min(5, 'Title must be at least 5 characters long.'),
    description: z.string().max(250, 'Description must be less than 250 characters.').nullable().optional(),
    due_date: z.coerce.date().nullable().optional(),
    completed: z.boolean().nullable().optional(),
  });
export type CreatableTodo = z.infer<typeof creatableTodoSchema>;


  /**
   * This is what the repository expects so it can create a todo.
   */
  export const insertableTodoSchema = todoSchema
    .omit({ id: true, created_at: true })
export type InsertableTodo = z.infer<typeof insertableTodoSchema>;




export const updatableTodoSchema = creatableTodoSchema.partial()
export const createTodoRequestBodySchema = creatableTodoSchema;
export const updateTodoRequestBodySchema = updatableTodoSchema;

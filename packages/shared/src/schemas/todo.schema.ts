import { z } from 'zod';

export const todoSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  description: z.string().nullable(),
  due_date: z.coerce.date().nullable(),
  completed: z.boolean(),
  author_id: z.number().int().positive(),
  created_at: z.date(),
});


export const creatableTodoSchema = todoSchema
  .omit({ id: true, author_id: true, created_at: true })
  .extend({
    title: z.string().min(5, 'Title must be at least 5 characters long.'),
    description: z.string().max(250, 'Description must be less than 250 characters.').nullable(),
    due_date: z.coerce.date().nullable().refine((date) => date === null || date > new Date(), {
      message: 'Due date cannot be in the past.',
    }),
  });

export const updatableTodoSchema = creatableTodoSchema.partial()

export const createTodoRequestBodySchema = creatableTodoSchema;
export const updateTodoRequestBodySchema = updatableTodoSchema;

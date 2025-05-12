import { Hono } from "hono";
import { Bindings } from "../../types/hono";
import { zValidator } from "../../lib/zod-validator";
import {
    createTodoRequestBodySchema,
    updateTodoRequestBodySchema,
} from "@gefakit/shared/src/schemas/todo.schema";
import { Selectable } from "kysely";
import { CoreTodo } from "../../db/db-types";
import { AppVariables } from "../../create-app";
import { getAuthOrThrow } from "../../utils/get-auth-or-throw";
import { getTodoService } from "../../utils/get-service";
import { Stripe } from "stripe";

type StripeAppVariables = AppVariables & {
    stripe: Stripe;
}

export function createPaymentRoutesV1() {
    const app = new Hono<{ Bindings: Bindings; Variables: StripeAppVariables }>();

    /**
   * Setup Stripe SDK prior to handling a request
   */
    app.use('*', async (c, next) => {
        // Load the Stripe API key from context.


        // Instantiate the Stripe client object 
        const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
            maxNetworkRetries: 3,
            timeout: 30 * 1000,
        });

        // Set the Stripe client to the Variable context object
        c.set("stripe", stripe);

        await next();
    });

    // health check 
    app.get("/health", async (c) => {
        return c.json({ ok: true });
    });

    // GET /api/v1/todos - Get all todos for the current user
    app.get("/", async (c) => {
        const { user } = getAuthOrThrow(c);
        const todoService = getTodoService(c);

        const result = await todoService.findAllTodosByAuthorId({ authorId: user.id });

        // Ensure Selectable and CoreTodo are imported
        const response: { todos: Selectable<CoreTodo>[] } = { todos: result };
        return c.json(response);
    });

    app.get("/a", async (context) => {
        const stripe = context.get('stripe');

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [
                {
                    price_data: {
                        currency: "usd",
                        product_data: {
                            name: "T-shirt",
                        },
                        unit_amount: 2000,
                    },
                    quantity: 1,
                },
            ],
            mode: "payment",
            success_url: "https://example.com/success",
            cancel_url: "https://example.com/cancel",
        });
        return context.redirect(session.url as string, 303);
    });

    // PUT /api/v1/todos/:id - Update a todo
    app.put(
        "/:id",
        zValidator("json", updateTodoRequestBodySchema),
        async (c) => {
            const { user } = getAuthOrThrow(c);
            const id = Number(c.req.param("id"));
            const data = c.req.valid("json");
            const todoService = getTodoService(c);

            const updated = await todoService.updateTodo({
                id, authorId: user.id, todo: {
                    ...data,
                    author_id: user.id,
                    completed: data.completed ?? false,
                    due_date: data.due_date ?? null,
                    description: data.description ?? null,

                }
            });
            return c.json({ updatedTodo: updated });
        }
    );

    // DELETE /api/v1/todos/:id - Delete a todo
    app.delete("/:id", async (c) => {
        const { user } = getAuthOrThrow(c);
        const id = Number(c.req.param("id"));
        const todoService = getTodoService(c);

        const deleted = await todoService.deleteTodo({ id, authorId: user.id });
        return c.json({ deletedTodo: deleted });
    });

    return app;
}

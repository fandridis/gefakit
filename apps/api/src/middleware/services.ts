// --- middleware/services.ts ---
import { Context, Next } from 'hono';

export type ServiceMap = Record<string, unknown>;

/**
 * Loops over a map of named services and sets each one on context.
 * e.g. services = { todoService: new TodoService(), mailer: MailerClient }
 */
export const servicesMiddleware = (services: ServiceMap) => {
  return async (c: Context, next: Next) => {
    for (const [key, service] of Object.entries(services)) {
      // only attach non-null values
      if (service != null) {
        c.set(key, service);
      }
    }
    await next();
  };
};

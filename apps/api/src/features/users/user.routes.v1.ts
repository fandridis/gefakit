import { Hono } from "hono";
import { Bindings } from "../../types/hono";
import { DbMiddleWareVariables } from "../../middleware/db";
import { AuthMiddleWareVariables } from "../../middleware/auth";
import { getUserService } from "../../core/services";
import { UserService } from "./user.service";
import { updateUserRequestBodySchema } from "@gefakit/shared/src/schemas/user.schema";
import { zValidator } from "../../lib/zod-utils";

type UserRouteVars = DbMiddleWareVariables & AuthMiddleWareVariables & {
    userService: UserService;
  };

const app = new Hono<{ Bindings: Bindings; Variables: UserRouteVars }>();

// Initialize service per-request
app.use("/*", async (c, next) => {
  const db = c.get("db");
  const userService = getUserService(db);
  
  c.set("userService", userService);
  await next();
});

// Update user
app.patch("/me",
    zValidator("json", updateUserRequestBodySchema),
    async (c) => {
    const user = c.get("user");
    const data = c.req.valid("json");
    const userService = c.get("userService");
    const name = data.username;

    const updated = await userService.updateUser({userId: user.id, updates: {
        username: name
    }});

    return c.json({ updatedUser: updated });
});

export const userRoutesV1 = app;
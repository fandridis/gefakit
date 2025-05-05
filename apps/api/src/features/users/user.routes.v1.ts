import { Hono } from "hono";
import { Bindings } from "../../types/hono";
import { getUserService } from "../../utils/get-service";
import { UserService } from "./user.service";
import { updateUserRequestBodySchema } from "@gefakit/shared/src/schemas/user.schema";
import { zValidator } from "../../lib/zod-validator";
import { AppVariables } from "../../create-app";
import { getAuthOrThrow } from "../../utils/get-auth-or-throw";

const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

// Update user
app.patch("/me",
  zValidator("json", updateUserRequestBodySchema), async (c) => {
    const data = c.req.valid("json");
    const { user } = getAuthOrThrow(c);
    const userService = getUserService(c);
    const name = data.username;

    const updated = await userService.updateUser({userId: user.id, updates: {
        username: name
    }});

    return c.json({ updatedUser: updated });
});

export const userRoutesV1 = app;
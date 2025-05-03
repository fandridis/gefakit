import { Updateable } from "kysely";
import { AuthUser } from "../../db/db-types";
import { UserRepository } from "./user.repository";

export type UserService = ReturnType<typeof createUserService>

export function createUserService({ userRepository }: { userRepository: UserRepository }) {
    async function findUserById({id}: {id: number}) {
        return userRepository.findUserById(id);
    }

    async function updateUser({ userId, updates }: { userId: number; updates: Updateable<AuthUser> }) {
        // We might want to add authorization checks here later
        // For example, check if the requesting user is the same as userId or an admin
        return userRepository.updateUser({ userId, updates });
    }

    return {
        findUserById,
        updateUser,
    };
}
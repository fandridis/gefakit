import { Kysely, Transaction, Insertable, Selectable } from "kysely";
import { DB, AuthUser } from "../../db/db-types";
import { AuthRepository } from "../auth/auth.repository";
import { OrganizationRepository } from "../organizations/organization.repository";
import { AppError } from "../../core/app-error";

/**
 * Input data for creating a user along with their default organization and membership.
 */
export interface CreateUserWithOrgData {
    email: string;
    username: string;
    password_hash: string; // Use specific placeholder like 'oauth_no_password' for OAuth users
    email_verified?: boolean; // Default to false if not provided
    role?: 'USER' | 'ADMIN' | 'SUPPORT'; // Default to 'USER'
    default_org_name?: string; // Optional custom name, defaults based on username
    default_membership_role?: 'owner' | 'admin' | 'member'; // Default to 'owner'
}

// Define a type that matches the structure returned by createUser (based on error message)
// This avoids the strict dependency on Selectable<AuthUser> if createUser doesn't return all fields.
type CreatedUserType = Omit<Selectable<AuthUser>, 'password_hash' | 'recovery_code'>;

/**
 * Creates a new user, their default organization, and an initial membership
 * within a single database transaction context.
 *
 * IMPORTANT: This function *expects* to be called within an existing
 * Kysely transaction. It binds its repository instances to the provided transaction.
 *
 * @param trx The Kysely Transaction object.
 * @param createAuthRepository Factory function for AuthRepository.
 * @param createOrganizationRepository Factory function for OrganizationRepository.
 * @param data The user and organization details.
 * @returns A promise resolving to the newly created user (as returned by createUser) and organization ID.
 * @throws AppError if any creation step fails. Ensure the calling transaction handles rollbacks.
 */
export async function createUserWithOrganizationAndMembership(
    trx: Transaction<DB>,
    createAuthRepository: (args: { db: Transaction<DB> }) => AuthRepository,
    createOrganizationRepository: (args: { db: Transaction<DB> }) => OrganizationRepository,
    data: CreateUserWithOrgData
): Promise<{ user: CreatedUserType, orgId: number }> {

    const authRepoTx = createAuthRepository({ db: trx });
    const orgRepoTx = createOrganizationRepository({ db: trx });

    // 1. Create the User
    const newUserInsert: Insertable<AuthUser> = {
        email: data.email,
        username: data.username,
        password_hash: data.password_hash,
        email_verified: data.email_verified ?? false, // Default email_verified
        role: data.role ?? 'USER' // Default role
    };
    const createdUser = await authRepoTx.createUser({ user: newUserInsert });
    if (!createdUser) {
        // Throw within the transaction to ensure rollback
        throw new AppError('Failed to create user within transaction', 500);
    }

    // 2. Create the Default Organization
    const orgName = data.default_org_name ?? `${createdUser.username}'s org`;
    const org = await orgRepoTx.createOrganization({ name: orgName });
    if (!org) {
        throw new AppError('Failed to create default organization within transaction', 500);
    }

    // 3. Create the Default Membership
    const membershipRole = data.default_membership_role ?? 'owner';
    const membership = await orgRepoTx.createMembership({
        organization_id: org.id,
        user_id: createdUser.id,
        is_default: true,
        role: membershipRole
    });
    if (!membership) {
        throw new AppError('Failed to create default membership within transaction', 500);
    }

    // Re-fetch user to ensure we have the Selectable type consistency if needed, though createUser might already return it.
    // If createUser already returns Selectable<AuthUser>, this might be redundant.
    // const finalUser = await authRepoTx.findUserById(createdUser.id);
    // if (!finalUser) {
    //      throw new AppError('Failed to re-fetch newly created user within transaction', 500);
    // }

    // Return the user object directly from createUser
    // This assumes createUser returns an object compatible with Selectable<AuthUser>
    // or that the consuming services don't strictly need fields like recovery_code immediately after creation.
    return { user: createdUser, orgId: org.id };
} 
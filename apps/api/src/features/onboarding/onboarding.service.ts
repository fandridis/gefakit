/**
 * This is the service that handles the onboarding process for the user.
 * It is responsible for creating the user and the organization.
 * It is also responsible for sending the welcome email to the user.
 */

// onboarding.service.ts
import { Kysely, Transaction } from "kysely";
import { randomUUID } from 'node:crypto';
import { DB } from "../../db/db-types";
import { createAppError } from "../../errors";
import { hashPassword, isMyPasswordPwned } from "../../lib/crypto";
import { AuthRepository } from "../auth/auth.repository";
import { OrganizationRepository } from "../organizations/organization.repository";

export type OnboardingService = ReturnType<typeof createOnboardingService>;

export function createOnboardingService({
  db,
  authRepository,
  createAuthRepository,
  createOrganizationRepository
}: { 
  db: Kysely<DB>;
  authRepository: AuthRepository;
  createAuthRepository: (args: { db: Kysely<DB> | Transaction<DB> }) => AuthRepository;
  createOrganizationRepository: (args: { db: Kysely<DB> | Transaction<DB> }) => OrganizationRepository;
}) {
  async function signUpAndCreateOrganization({
    email,
    password,
    username,
    orgName,
  }: {
    email: string;
    password: string;
    username: string;
    orgName?: string;
  }) {
    const existingUser = await authRepository.findUserWithPasswordByEmail({email});

    if (password.length < 8 || password.length > 255) {
        throw createAppError.auth.weakPassword('Password must be between 8 and 255 characters long.');
    }

    const isPwned = await isMyPasswordPwned(password);

    if (existingUser) {
        throw createAppError.auth.userCreationFailed('Email already exists')
    }

    const passwordHash = await hashPassword(password);

    if (isPwned) {
        throw createAppError.auth.weakPassword('Password was found in a data breach. Please choose a different password and update it on all your accounts.');
    }

    return db.transaction().execute(async (trx: Transaction<DB>) => {
      const authRepoTx = createAuthRepository({ db: trx });
      const orgRepoTx = createOrganizationRepository({ db: trx });

      const user = await authRepoTx.createUser({
        user: {
          email,
          password_hash: passwordHash,
          username,
        }
      });

      if (!user) {
        throw createAppError.auth.userCreationFailed(); // Can't really happen.
      }

      const verificationToken = randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

      await authRepoTx.createEmailVerificationToken({
        user_id: user.id,
        value: verificationToken,
        expires_at: expiresAt,
        identifier: user.email // Assuming identifier is the email
      });

      const org = await orgRepoTx.createOrganization({
        name: orgName ?? `${user.username}'s org`
      });

      await orgRepoTx.createMembership({
        organization_id: org.id,
        user_id: user.id,
        is_default: true,
        role: 'owner'
      });

      console.log('Send welcome email to ', user.email);

      return { user, orgId: org.id, verificationToken };
    });
  }

  return { signUpAndCreateOrganization };
}
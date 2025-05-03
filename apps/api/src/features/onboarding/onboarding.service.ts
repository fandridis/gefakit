/**
 * This is the service that handles the onboarding process for the user.
 * It is responsible for creating the user and the organization.
 * It is also responsible for sending the welcome email to the user.
 */

// onboarding.service.ts
import { Kysely, Transaction } from "kysely";
import { randomUUID } from 'node:crypto';
import { DB } from "../../db/db-types";
import { hashPassword, isMyPasswordPwned } from "../../lib/crypto";
import { AuthRepository } from "../auth/auth.repository";
import { OrganizationRepository } from "../organizations/organization.repository";
import { createUserWithOrganizationAndMembership } from "../users/user-creation.util";
import { authErrors } from "../auth/auth.errors";

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
        throw authErrors.weakPassword('Password must be between 8 and 255 characters long.');
    }

    const isPwned = await isMyPasswordPwned(password);

    if (existingUser) {
        throw authErrors.userCreationFailed('Email already exists')
    }

    const passwordHash = await hashPassword(password);

    if (isPwned) {
        throw authErrors.weakPassword('Password was found in a data breach. Please choose a different password and update it on all your accounts.');
    }

    return db.transaction().execute(async (trx: Transaction<DB>) => {
      const { user, orgId } = await createUserWithOrganizationAndMembership(
        trx,
        createAuthRepository,
        createOrganizationRepository,
        {
          email,
          username,
          password_hash: passwordHash,
          default_org_name: orgName
        }
      );

      const verificationToken = randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

      const authRepoTx = createAuthRepository({ db: trx });
      await authRepoTx.createEmailVerificationToken({
        user_id: user.id,
        value: verificationToken,
        expires_at: expiresAt,
        identifier: user.email
      });

      return { user, orgId, verificationToken };
    });
  }

  return { signUpAndCreateOrganization };
}
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
import { AuthRepository, createAuthRepository } from "../auth/auth.repository";
import { OrganizationRepository, createOrganizationRepository } from "../organizations/organizations.repository";
import { EmailService } from "../emails/email.service";

export type OnboardingService = ReturnType<typeof createOnboardingService>;

export function createOnboardingService({
  db,
  authRepository,
  orgRepository,
  emailService
}: { 
  db: Kysely<DB>;
  authRepository: AuthRepository;
  orgRepository: OrganizationRepository;
  emailService: EmailService;
}) {
  async function signUpAndCreateOrganization(data: {
    email: string;
    password: string;
    username: string;
    orgName?: string;
  }) {
    const existingUser = await authRepository.findUserWithPasswordByEmail({email: data.email});

    if (data.password.length < 8 || data.password.length > 255) {
        throw createAppError.auth.weakPassword('Password must be between 8 and 255 characters long.');
    }

    const isPwned = await isMyPasswordPwned(data.password);

    if (existingUser) {
        throw createAppError.auth.invalidCredentials();
    }

    const passwordHash = await hashPassword(data.password);

    if (isPwned) {
        throw createAppError.auth.weakPassword('Password was found in a data breach. Please choose a different password and update it on all your accounts.');
    }

    return db.transaction().execute(async (trx: Transaction<DB>) => {
      const txAuthRepo = createAuthRepository({ db: trx });
      const txOrgRepo = createOrganizationRepository({ db: trx });

      const user = await txAuthRepo.createUser({
        email: data.email,
        password_hash: passwordHash,
        username: data.username,
      });

      if (!user) {
        throw createAppError.auth.userCreationFailed(); // Can't really happen.
      }

      const verificationToken = randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

      await txAuthRepo.createEmailVerificationToken({
        id: randomUUID(),
        user_id: user.id,
        value: verificationToken,
        expires_at: expiresAt,
        identifier: user.email // Assuming identifier is the email
      });

      const org = await txOrgRepo.createOrganization({
        name: data.orgName ?? `${user.username}'s org`
      });

      await txOrgRepo.createMembership({
        organization_id: org.id,
        user_id: user.id,
        role: 'owner'
      });

      console.log('Send welcome email to ', user.email);

      await emailService.sendVerificationEmail({ 
        email: user.email, 
        token: verificationToken 
      });

      return { user, orgId: org.id };
    });
  }

  return { signUpAndCreateOrganization };
}
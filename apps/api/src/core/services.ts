import { Kysely } from 'kysely';
import { DB } from '../db/db-types';
import { createOrganizationRepository } from '../features/organizations/organization.repository';
import { createOrganizationService } from '../features/organizations/organization.service';
import { createAuthRepository } from '../features/auth/auth.repository';
import { createAuthService } from '../features/auth/auth.service';
import { createOrganizationInvitationRepository } from '../features/organization-invitations/organization-invitation.repository';
import { createOrganizationInvitationService } from '../features/organization-invitations/organization-invitation.service';
import { createOrganizationMembershipRepository } from '../features/organization-memberships/organization-membership.repository';
import { createOrganizationMembershipService } from '../features/organization-memberships/organization-membership.service';
import { createEmailService } from '../features/emails/email.service';
import { createOnboardingService } from '../features/onboarding/onboarding.service';
import { createTodoRepository } from '../features/todos/todo.repository';
import { createTodoService } from '../features/todos/todo.service';
import { createAdminService } from '../features/admin/admin.service';
import { createUserRepository } from '../features/users/user.repository';
import { createUserService } from '../features/users/user.service';

export function getAuthService(db: Kysely<DB>) {
    const authRepository = createAuthRepository({ db });
    return createAuthService({ db, authRepository, createAuthRepository, createOrganizationRepository });
}

// Centralized factory for OrganizationService
export function getOrganizationService(db: Kysely<DB>) {
    const organizationRepository = createOrganizationRepository({ db });
    return createOrganizationService({ db, organizationRepository, createOrganizationRepository });
}

export function getOrganizationInvitationService(db: Kysely<DB>) {
    const organizationInvitationRepository = createOrganizationInvitationRepository({ db });
    const organizationService = getOrganizationService(db);
    const authService = getAuthService(db);

    return createOrganizationInvitationService({
        db,
        organizationInvitationRepository,
        organizationService,
        authService,
        createOrganizationInvitationRepository
    });
}

export function getOrganizationMembershipService(db: Kysely<DB>) {
    const organizationMembershipRepository = createOrganizationMembershipRepository({ db });
    return createOrganizationMembershipService({
        db,
        organizationMembershipRepository,
    });
}

export function getOnboardingService(db: Kysely<DB>) {
    const authRepository = createAuthRepository({ db });
    const authService = getAuthService(db);
    return createOnboardingService({
        db,
        authRepository,
        createAuthRepository,
        createOrganizationRepository,
       // generateEmailVerificationToken: authService.generateEmailVerificationToken
    });
}

export function getTodoService(db: Kysely<DB>) {
    console.log('======= INITIALIZING SERVICE =======')
    const todoRepository = createTodoRepository({ db });
    return createTodoService({ todoRepository });
}

// Centralized factory for AdminService
export function getAdminService(db: Kysely<DB>) {
    const authRepository = createAuthRepository({ db });
    return createAdminService({ db, authRepository });
}

export function getUserService(db: Kysely<DB>) {
    const userRepository = createUserRepository({ db });
    return createUserService({ userRepository });
}

export function getEmailService() {
    // Currently no dependencies, but structured for future expansion
    // e.g., const resendClient = createResendClient(...);
    // return createEmailService({ resendClient });
    return createEmailService();
}

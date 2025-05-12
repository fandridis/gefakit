import { Kysely } from 'kysely';
import { Context } from 'hono';
import { DB } from '../db/db-types';
import { AppVariables } from '../create-app';
import { Bindings } from '../types/hono';

import { createOrganizationRepository } from '../features/organizations/organization.repository';
import { createOrganizationService, OrganizationService } from '../features/organizations/organization.service';
import { createAuthRepository } from '../features/auth/auth.repository';
import { createAuthService, AuthService } from '../features/auth/auth.service';
import { createOrganizationInvitationRepository } from '../features/organization-invitations/organization-invitation.repository';
import { createOrganizationInvitationService, OrganizationInvitationService } from '../features/organization-invitations/organization-invitation.service';
import { createOrganizationMembershipRepository } from '../features/organization-memberships/organization-membership.repository';
import { createOrganizationMembershipService, OrganizationMembershipService } from '../features/organization-memberships/organization-membership.service';
import { createEmailService, EmailService } from '../features/emails/email.service';
import { createOnboardingService, OnboardingService } from '../features/onboarding/onboarding.service';
import { createTodoRepository } from '../features/todos/todo.repository';
import { createTodoService, TodoService } from '../features/todos/todo.service';
import { createAdminService, AdminService } from '../features/admin/admin.service';
import { createUserRepository } from '../features/users/user.repository';
import { createUserService, UserService } from '../features/users/user.service';

export interface GetServiceProps<T extends AppVariables = AppVariables> {
    Bindings: Bindings;
    Variables: T;
}

export function getAuthService(c: Context<GetServiceProps>): AuthService {
    let service = c.get('authService');
    if (service) {
        return service;
    }
    const db = c.get('db');
    const authRepository = createAuthRepository({ db });
    service = createAuthService({ db, authRepository, createAuthRepository, createOrganizationRepository });
    c.set('authService', service);
    return service;
}

export function getOrganizationService(c: Context<GetServiceProps>): OrganizationService {
    let service = c.get('organizationService');
    if (service) {
        return service;
    }
    const db = c.get('db');
    const organizationRepository = createOrganizationRepository({ db });
    service = createOrganizationService({ db, organizationRepository, createOrganizationRepository });
    c.set('organizationService', service);
    return service;
}

export function getOrganizationInvitationService(c: Context<GetServiceProps>): OrganizationInvitationService {
    let service = c.get('organizationInvitationService');
    if (service) {
        return service;
    }
    const db = c.get('db');
    const organizationInvitationRepository = createOrganizationInvitationRepository({ db });
    const organizationService = getOrganizationService(c);
    const authService = getAuthService(c);

    service = createOrganizationInvitationService({
        db,
        organizationInvitationRepository,
        organizationService,
        authService,
        createOrganizationInvitationRepository
    });
    c.set('organizationInvitationService', service);
    return service;
}

export function getOrganizationMembershipService(c: Context<GetServiceProps>): OrganizationMembershipService {
    let service = c.get('organizationMembershipService');
    if (service) {
        return service;
    }
    const db = c.get('db');
    const organizationMembershipRepository = createOrganizationMembershipRepository({ db });
    service = createOrganizationMembershipService({
        db,
        organizationMembershipRepository,
    });
    c.set('organizationMembershipService', service);
    return service;
}

export function getOnboardingService(c: Context<GetServiceProps>) {
    let service = c.get('onboardingService');
    if (service) {
        return service;
    }
    const db = c.get('db');
    const authRepository = createAuthRepository({ db });
    const authService = getAuthService(c);
    service = createOnboardingService({
        db,
        authRepository,
        createAuthRepository,
        createOrganizationRepository,
        // generateEmailVerificationToken: authService.generateEmailVerificationToken
    });
    c.set('onboardingService', service);
    return service;
}

export function getTodoService<T extends AppVariables>(c: Context<GetServiceProps<T>>): TodoService {
    let service = c.get('todoService');
    if (service) {
        return service;
    }
    console.log('======= INITIALIZING TODO SERVICE =======');
    const db = c.get('db');
    const todoRepository = createTodoRepository({ db });
    service = createTodoService({ todoRepository });
    c.set('todoService', service);
    return service;
}

export function getAdminService(c: Context<GetServiceProps>): AdminService {
    let service = c.get('adminService');
    if (service) {
        return service;
    }
    const db = c.get('db');
    const authRepository = createAuthRepository({ db });
    service = createAdminService({ db, authRepository });
    c.set('adminService', service);
    return service;
}

export function getUserService(c: Context<GetServiceProps>): UserService {
    let service = c.get('userService');
    if (service) {
        return service;
    }
    const db = c.get('db');
    const userRepository = createUserRepository({ db });
    service = createUserService({ userRepository });
    c.set('userService', service);
    return service;
}

export function getEmailService(c: Context<GetServiceProps>): EmailService {
    let service = c.get('emailService');
    if (service) {
        return service;
    }
    service = createEmailService();
    c.set('emailService', service);
    return service;
}

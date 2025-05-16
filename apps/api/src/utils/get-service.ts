import { Context } from 'hono';
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
import { PaymentService } from '../features/payments/payment.service';
import { createPaymentRepository } from '../features/payments/payment.repository';
import { createPaymentService } from '../features/payments/payment.service';
import { createFeatureFlagService, FeatureFlagService } from '../features/feature-flags/feature-flag.service';
import { createFeatureFlagRepository } from '../features/feature-flags/feature-flag.repository';

export interface GetServiceProps<T extends AppVariables = AppVariables> {
    Bindings: Bindings;
    Variables: T;
}

export function getAuthService<T extends AppVariables>(c: Context<GetServiceProps<T>>): AuthService {
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

export function getOrganizationService<T extends AppVariables>(c: Context<GetServiceProps<T>>): OrganizationService {
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

export function getOrganizationInvitationService<T extends AppVariables>(c: Context<GetServiceProps<T>>): OrganizationInvitationService {
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

export function getOrganizationMembershipService<T extends AppVariables>(c: Context<GetServiceProps<T>>): OrganizationMembershipService {
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

export function getOnboardingService<T extends AppVariables>(c: Context<GetServiceProps<T>>): OnboardingService {
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

export function getAdminService<T extends AppVariables>(c: Context<GetServiceProps<T>>): AdminService {
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

export function getUserService<T extends AppVariables>(c: Context<GetServiceProps<T>>): UserService {
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

export function getEmailService<T extends AppVariables>(c: Context<GetServiceProps<T>>): EmailService {
    let service = c.get('emailService');
    if (service) {
        return service;
    }
    service = createEmailService();
    c.set('emailService', service);
    return service;
}

export function getPaymentService<T extends AppVariables>(c: Context<GetServiceProps<T>>): PaymentService {
    let service = c.get('paymentService');
    let stripe = c.get('stripe');
    if (!stripe) {
        throw new Error('Stripe client not available in context');
    }

    if (service) {
        return service;
    }
    const db = c.get('db');
    const paymentRepository = createPaymentRepository({ db });
    const userService = getUserService(c);
    service = createPaymentService({ paymentRepository, stripe, userService });
    c.set('paymentService', service);
    return service;
}

export function getFeatureFlagService<T extends AppVariables>(c: Context<GetServiceProps<T>>): FeatureFlagService {
    let service = c.get('featureFlagService');
    if (service) {
        return service;
    }

    const kv = c.env.GEFAKIT_FEATURE_FLAGS_KV
    const featureFlagRepository = createFeatureFlagRepository({ kv });
    service = createFeatureFlagService({ featureFlagRepository });

    c.set('featureFlagService', service);
    return service;
}

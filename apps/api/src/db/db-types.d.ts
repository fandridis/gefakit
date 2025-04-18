/**
 * This file was generated by kysely-codegen.
 * Please do not edit it manually.
 */

import type { ColumnType } from "kysely";

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;

export type OrganizationsInvitationStatus = "accepted" | "declined" | "expired" | "pending";

export type OrganizationsMembershipRole = "admin" | "member" | "owner";

export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export interface AuthEmailVerification {
  created_at: Generated<Timestamp>;
  expires_at: Timestamp;
  id: string;
  identifier: string;
  updated_at: Generated<Timestamp>;
  user_id: number;
  value: string;
}

export interface AuthSession {
  active_organization_id: number | null;
  expires_at: Timestamp;
  id: string;
  user_id: number;
}

export interface AuthUser {
  created_at: Generated<Timestamp>;
  email: string;
  email_verified: Generated<boolean>;
  id: Generated<number>;
  password_hash: string;
  recovery_code: Buffer | null;
  username: string;
}

export interface CoreTodo {
  author_id: number;
  completed: Generated<boolean>;
  created_at: Generated<Timestamp>;
  description: string | null;
  due_date: Timestamp | null;
  id: Generated<number>;
  title: string;
}

export interface OrganizationsInvitation {
  created_at: Generated<Timestamp>;
  email: string;
  expires_at: Timestamp;
  id: Generated<number>;
  invited_by_user_id: number | null;
  organization_id: number;
  role: OrganizationsMembershipRole;
  status: Generated<OrganizationsInvitationStatus>;
  token: string;
  updated_at: Generated<Timestamp>;
}

export interface OrganizationsMembership {
  created_at: Generated<Timestamp>;
  is_default: Generated<boolean>;
  organization_id: number;
  role: OrganizationsMembershipRole;
  updated_at: Generated<Timestamp>;
  user_id: number;
}

export interface OrganizationsOrganization {
  created_at: Generated<Timestamp>;
  id: Generated<number>;
  name: string;
  updated_at: Generated<Timestamp>;
}

export interface DB {
  "auth.email_verifications": AuthEmailVerification;
  "auth.sessions": AuthSession;
  "auth.users": AuthUser;
  "core.todos": CoreTodo;
  "organizations.invitations": OrganizationsInvitation;
  "organizations.memberships": OrganizationsMembership;
  "organizations.organizations": OrganizationsOrganization;
}

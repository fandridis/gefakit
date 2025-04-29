import { UserDTO } from "./auth";

export type UpdateUserResponseDTO = {
  user: UserDTO;
}

// START OF TEST
export interface TestEnum {
    id: string;
    email: string;
    name: string;
    role: TestEnumRoleType;
}

export const TestEnumRole = {
    ADMIN: 'admin',
    USER: 'user',
} as const;

export type TestEnumRoleType = typeof TestEnumRole[keyof typeof TestEnumRole];
// END OF TEST

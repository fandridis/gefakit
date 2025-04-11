export interface TestType {
    id: string;
    email: string;
    name: string;
    role: TestTypeRole;
  }
  

export const TestTypeRole = {
    ADMIN: 'admin',
    USER: 'user',
} as const;

export type TestTypeRole = typeof TestTypeRole[keyof typeof TestTypeRole];

import { vi } from 'vitest';

vi.stubEnv('DATABASE_URL_POOLED', process.env.TEST_DATABASE_URL);

import { vi } from 'vitest';
import { envConfig } from '../src/lib/env-config';

vi.stubEnv('DATABASE_URL_POOLED', envConfig.TEST_DATABASE_URL);

import { config } from 'dotenv';
import { execa } from 'execa';

// Load environment variables from .env (gitignored)
config({ path: '.dev.vars.test' });

const { NEON_API_KEY, NEON_PROJECT_ID, BRANCH_PREFIX = 'test' } = process.env;

console.log('================ test script =================')
console.log('WITH NODE_ENV: ', process.env.NODE_ENV)

if (!NEON_API_KEY || !NEON_PROJECT_ID) {
    console.error('❌  Must set NEON_API_KEY & NEON_PROJECT_ID in .env');
    process.exit(1);
}

// Generate a unique branch name based on timestamp
const timestamp = Date.now();
const branchName = `${BRANCH_PREFIX}-${timestamp}`;

// Cleanup helper: always delete the branch on exit
async function cleanup() {
    console.log(`🗑  Deleting Neon branch: ${branchName}`);
    try {
        const { stdout } = await execa('npx', [
            'neonctl', 'branches', 'delete',
            '--project-id', NEON_PROJECT_ID!,
            branchName,
            '--api-key', NEON_API_KEY!,
        ]);
        console.log('Cleanup successful!');
    } catch (err) {
        console.warn('⚠️  Cleanup failed:', err instanceof Error ? err.message : String(err));
    }
}

async function main() {
    let cleanupPromise: Promise<void> | null = null;

    // Handle cleanup on process exit
    const handleExit = async () => {
        if (cleanupPromise) {
            await cleanupPromise;
        }
    };

    process.on('exit', handleExit);
    process.on('SIGINT', handleExit);
    process.on('SIGTERM', handleExit);

    try {
        // 1) Create the Neon branch
        console.log(`✨  Creating Neon branch: ${branchName}`);
        const { stdout } = await execa('npx', [
            'neonctl', 'branches', 'create',
            '--project-id', NEON_PROJECT_ID!,
            '--name', branchName,
            '--api-key', NEON_API_KEY!,
            '--output', 'json',
        ]);

        const info = JSON.parse(stdout);

        // 2) Extract the connection URL
        const testDbUrl =
            info.connectionString ||
            (Array.isArray(info.connection_uris) && info.connection_uris[0]?.connection_uri) ||
            info.connectionUri;

        if (!testDbUrl) {
            throw new Error('No connection string found in neonctl output');
        }

        // 3) Export for migrations/tests
        process.env.TEST_DATABASE_URL = testDbUrl;
        process.env.DATABASE_URL = testDbUrl;
        console.log(`🔗  TEST_DATABASE_URL=${testDbUrl}`);
        console.log(`🔗  DATABASE_URL=${testDbUrl}`);

        // 4) Run migrations (uses migrate.ts)
        console.log('🚧  Running migrations...');
        await execa('tsx', ['src/db/migrate.ts'], {
            stdio: 'inherit',
            env: {
                ...process.env,
                TEST_DATABASE_URL: testDbUrl,
                DATABASE_URL: testDbUrl
            }
        });

        // 5) Run tests with environment variables
        console.log('🧪  Running tests...');
        await execa('vitest', ['run'], {
            stdio: 'inherit',
            env: {
                ...process.env,
                TEST_DATABASE_URL: testDbUrl,
                DATABASE_URL: testDbUrl
            }
        });

        console.log('✅  Tests passed!');

        // Run cleanup after successful tests
        cleanupPromise = cleanup();
        await cleanupPromise;
    } catch (err) {
        console.error('❌  Error during test-ci:', err instanceof Error ? err.message : String(err));
        cleanupPromise = cleanup();
        await cleanupPromise;
        process.exit(1);
    }
}

main(); 
import { config } from 'dotenv';
import { execa } from 'execa';
import { createInterface } from 'readline';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Load environment variables from .env
config({ path: '.dev.vars' });

const { NEON_API_KEY, NEON_PROJECT_ID } = process.env;

if (!NEON_API_KEY || !NEON_PROJECT_ID) {
    console.error('❌  Must set NEON_API_KEY & NEON_PROJECT_ID in .env');
    process.exit(1);
}

async function askDeveloperNickname(): Promise<string> {
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question('Enter your developer nickname: ', (nickname) => {
            rl.close();
            resolve(nickname.trim());
        });
    });
}

function updateDevVars(dbUrl: string) {
    const devVarsPath = join(process.cwd(), '.dev.vars');
    let content: string;

    try {
        content = readFileSync(devVarsPath, 'utf-8');
    } catch (err) {
        // If file doesn't exist, create it
        content = '';
    }

    // Check if DATABASE_URL already exists in the file
    const dbUrlRegex = /^DATABASE_URL=.*$/m;
    if (dbUrlRegex.test(content)) {
        // Replace existing DATABASE_URL
        content = content.replace(dbUrlRegex, `DATABASE_URL=${dbUrl}`);
    } else {
        // Add new DATABASE_URL
        content += `\nDATABASE_URL=${dbUrl}\n`;
    }

    writeFileSync(devVarsPath, content);
    console.log('📝  Updated .dev.vars with new DATABASE_URL');
}

async function main() {
    try {
        // 1) Ask for developer nickname
        const nickname = await askDeveloperNickname();
        const branchName = `dev-${nickname}`;

        // 2) Create the Neon branch
        console.log(`✨  Creating Neon branch: ${branchName}`);
        const { stdout } = await execa('npx', [
            'neonctl', 'branches', 'create',
            '--project-id', NEON_PROJECT_ID!,
            '--name', branchName,
            '--api-key', NEON_API_KEY!,
            '--output', 'json',
        ]);

        const info = JSON.parse(stdout);

        // 3) Extract and log the connection URL
        const dbUrl =
            info.connectionString ||
            (Array.isArray(info.connection_uris) && info.connection_uris[0]?.connection_uri) ||
            info.connectionUri;

        if (!dbUrl) {
            throw new Error('No connection string found in neonctl output');
        }

        console.log('\n✅  Branch created successfully!');
        console.log('\n🔗  Your database connection string:');
        console.log(dbUrl);

        // 4) Update .dev.vars file
        updateDevVars(dbUrl);

    } catch (err) {
        console.error('❌  Error during developer onboarding:', err instanceof Error ? err.message : String(err));
        process.exit(1);
    }
}

main();

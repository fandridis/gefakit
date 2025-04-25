// src/db/seed-runner.ts
import { existsSync } from 'fs';
import { join } from 'path';

// Allowed environments
const allowedEnvs = ['dev', 'production-yes-i-am-sure'];

// Simple argument parsing for --env and --filepath
let env: string | undefined;
let fileName: string | undefined;

for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--env=')) {
    env = arg.split('=')[1];
  }
  if (arg.startsWith('--file=')) {
    fileName = arg.split('=')[1];
  }
}

// Validate env
if (!env) {
  console.error('Error: Missing required argument --env. Allowed values are: dev, production-yes-i-am-sure.');
  process.exit(1);
}

if (!allowedEnvs.includes(env)) {
  console.error(`Error: Invalid env value "${env}". Allowed values are: ${allowedEnvs.join(', ')}.`);
  process.exit(1);
}

// Validate fileName
if (!fileName) {
  console.error('Error: Missing required argument --file. Please provide a seed file name.');
  process.exit(1);
}

// Construct the full path to the seed file (assuming files are in src/db/seeds)
const seedFilePath = join(__dirname, fileName);
if (!existsSync(seedFilePath)) {
  console.error(`Error: Seed file "${seedFilePath}" does not exist.`);
  process.exit(1);
}

// Dynamically import and run the seed file
(async () => {
  try {
    await import(seedFilePath);
    console.log(`Successfully ran seed file: ${fileName} in ${env} environment`);
  } catch (error) {
    console.error(`Error running seed file "${fileName}":`, error);
    process.exit(1);
  }
})();

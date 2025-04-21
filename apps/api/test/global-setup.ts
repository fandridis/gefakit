import type { TestProject } from 'vitest/node'
// import { vi } from 'vitest';

export default function setup(project: TestProject) {
    console.log('=============== Global Setup ===============')
    // vi.stubEnv('DATABASE_URL_POOLED', 'postgresql://neondb_owner:npg_v9IioTkZd6RY@ep-withered-heart-a2fk19ng-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require');


    // console.log('process.env: ', process.env)
    
    // project.onTestsRerun(async () => {
    //     await restartDb()
    // })
}
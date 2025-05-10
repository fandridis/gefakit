import type { TestProject } from 'vitest/node'
//import { vi } from 'vitest';

export default function setup(project: TestProject) {
    console.log('=============== Global Setup ===============')
    console.log('project.name: ', project.name)

    // Ensure NODE_ENV is set to test
    // process.env.NODE_ENV = 'test'
    //vi.stubEnv('NODE_ENV', 'test')

    console.log('Using vars defined in .dev.vars')
}
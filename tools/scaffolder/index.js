#!/usr/bin/env node

import { program } from 'commander';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

// Get __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Reads the configuration from gefakit.json in the project root,
 * or returns default values.
 */
async function getConfig() {
    const configPath = path.join(process.cwd(), 'gefakit.json');
    const defaultConfig = {
        componentsPath: '/components/gefakit',
        globalCssPath: '/app/globals.css'
    };
    if (await fs.pathExists(configPath)) {
        try {
            const userConfig = await fs.readJson(configPath);
            return { ...defaultConfig, ...userConfig };
        } catch (error) {
            console.error(chalk.red('Error reading gefakit.json:'), error);
            return defaultConfig; // Return default config on error
        }
    }
    return defaultConfig;
}

/**
 * Returns the destination path for a given subfolder under "app".
 * If localization is enabled, it returns "app/[locale]/<folder>".
 * Otherwise, it returns "app/<folder>".
 */
function getAppSubPath(projectRoot, folder, wantLocalization) {
    return wantLocalization
        ? path.join(projectRoot, 'app', '[locale]', folder)
        : path.join(projectRoot, 'app', folder);
}

/**
 * Create a new project.
 * 1. Ask if localization is needed.
 * 2. Ask the user to choose a template (Website or SaaS Dashboard).
 * 3. If "Website" is chosen, ask additional questions for blog and contact form.
 * 4. Copy the base Next.js application first, then overlay modifications.
 */
async function createProject() {
    console.log(chalk.blue('Gefakit CLI - Project Creation\n'));

    // First prompt for localization support
    // const { wantLocalization } = await inquirer.prompt([
    //     {
    //         type: 'confirm',
    //         name: 'wantLocalization',
    //         message: 'Do you need localization support?',
    //         default: false
    //     }
    // ]);

    // Ask if this is a personal project or a team project
    const { isPersonalProject } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'isPersonalProject',
            message: 'Is this a personal project?',
            choices: [
                { name: 'Personal', value: 'personal' },
                { name: 'Team', value: 'team' }
            ]
        }
    ]);

    const isTeamProject = isPersonalProject === 'team';

    // If it's a personal project, set wantLocalization to false
    // const wantLocalization = !isPersonalProject;

    // Prompt for the type of project template
    const { templateType } = await inquirer.prompt([
        {
            type: 'list',
            name: 'templateType',
            message: 'Choose a starter template:',
            choices: [
                { name: 'Website', value: 'website' },
                { name: 'SaaS Dashboard', value: 'saas-dashboard' }
            ]
        }
    ]);

    // Prompt for project name and additional options if needed
    const projectPrompts = [
        {
            type: 'input',
            name: 'projectName',
            message: 'What is the name of your new application?',
            default: 'my-new-app'
        }
    ];

    if (templateType === 'website') {
        projectPrompts.push({
            type: 'confirm',
            name: 'includeBlog',
            message: 'Do you want to include a blog?',
            default: false
        });
        projectPrompts.push({
            type: 'confirm',
            name: 'includeContactForm',
            message: 'Do you want to include a contact form?',
            default: false
        });
    }

    const answers = await inquirer.prompt(projectPrompts);
    const { projectName, includeBlog, includeContactForm } = answers;
    const destPath = path.join(process.cwd(), projectName);

    console.log('answers: ', answers);

    console.log(chalk.cyan(`\nCreating new project at ${destPath}...`));

    try {
        // Step 1: Define the path for the monorepo base template
        const monorepoBasePath = path.join(__dirname, 'templates', 'monorepo-base');

        // Step 2: Copy the monorepo base template to the destination path
        await fs.copy(monorepoBasePath, destPath);
        console.log(chalk.green('Monorepo base template copied.'));

        /*
        // Step 1: Copy the base Next.js application
        const baseTemplatePath = path.join(
            __dirname,
            'templates',
            wantLocalization ? 'base-with-localization' : 'base-without-localization'
        );
        await fs.copy(baseTemplatePath, destPath);
        console.log(chalk.green('Base Next.js application copied.'));

        // Step 2: Apply template-specific modifications
        if (templateType === 'website') {
            // Copy website modifications over the base app
            const websiteTemplatePath = path.join(__dirname, 'templates', 'website', 'base');
            await fs.copy(websiteTemplatePath, destPath, { overwrite: true });
            console.log(chalk.green('Website modifications copied.'));

            // Conditionally add optional features based on user's choices
            if (includeBlog) {
                const blogTemplatePath = path.join(__dirname, 'templates', 'blog');
                const destBlogPath = getAppSubPath(destPath, 'blog', wantLocalization);
                await fs.copy(blogTemplatePath, destBlogPath);
                console.log(chalk.green(`Blog feature added to ${destBlogPath}.`));
            }
            if (includeContactForm) {
                const contactTemplatePath = path.join(__dirname, 'templates', 'contact-form');
                const destContactPath = getAppSubPath(destPath, 'contact', wantLocalization);
                await fs.copy(contactTemplatePath, destContactPath);
                console.log(chalk.green(`Contact form feature added to ${destContactPath}.`));
            }
        } else if (templateType === 'saas-dashboard') {
            const dashboardTemplatePath = path.join(__dirname, 'templates', 'saas-dashboard', 'base');
            await fs.copy(dashboardTemplatePath, destPath, { overwrite: true });
            console.log(chalk.green('SaaS Dashboard modifications copied.'));
        }
        */

        console.log(chalk.green('\nProject created successfully!'));
        console.log(chalk.yellow(`\nNext steps:\ncd ${projectName}\npnpm install\npnpm run dev`));
    } catch (error) {
        console.error(chalk.red('\nAn error occurred during project creation:'), error);
        process.exit(1);
    }
}

/**
 * Add a feature to an existing project.
 * For example: npx create-gefakit add button
 */
async function addFeature(feature) {
    console.log(chalk.blue(`Gefakit CLI - Adding Feature: ${feature}\n`));

    try {
        const config = await getConfig();
        const componentsPath = path.join(process.cwd(), config.componentsPath);
        const globalCssPath = path.join(process.cwd(), config.globalCssPath);

        if (feature === 'button') {
            const destButtonFile = path.join(componentsPath, 'button.tsx');
            const buttonTemplatePath = path.join(__dirname, 'templates', 'add', 'button.tsx');
            const buttonCssTemplatePath = path.join(__dirname, 'templates', 'add', 'button.css'); // Assuming a CSS file for the button

            console.log(chalk.cyan(`Adding button component to ${destButtonFile}...`));
            await fs.ensureDir(componentsPath);
            await fs.copy(buttonTemplatePath, destButtonFile);
            console.log(chalk.green('Button component added.'));

            // Add the button CSS file
            const destButtonCssFile = path.join(componentsPath, 'button.css');
            console.log(chalk.cyan(`Adding button CSS to ${destButtonCssFile}...`));
            await fs.copy(buttonCssTemplatePath, destButtonCssFile);
            console.log(chalk.green('Button CSS added.'));

            // Append a new line to global.css
            console.log(chalk.cyan(`Updating global CSS at ${globalCssPath}...`));
            const cssLine = '\n/* Button styles added by gefakit-cli */\n@import "./components/gefakit/button.css";\n';
            await fs.appendFile(globalCssPath, cssLine);
            console.log(chalk.green('Global CSS updated.'));

        } else {
            console.error(chalk.red(`Feature "${feature}" is not supported.`));
            process.exit(1);
        }
        console.log(chalk.green(`\nFeature "${feature}" added successfully!`));
    } catch (error) {
        console.error(chalk.red(`\nAn error occurred while adding feature "${feature}":`), error);
        process.exit(1);
    }
}

// Setup commander for subcommands like "add"
program
    .command('add <feature>')
    .description('Add an optional feature to your existing project')
    .action(async (feature) => {
        await addFeature(feature);
    });

// If no subcommand is provided, run project creation
if (process.argv.length <= 2) {
    createProject();
} else {
    program.parse(process.argv);
}
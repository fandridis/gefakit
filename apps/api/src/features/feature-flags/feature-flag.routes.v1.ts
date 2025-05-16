// feature-flag.routes.v1.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { getAuthOrThrow } from '../../utils/get-auth-or-throw';
import {
    FeatureFlagCreateDTO,
    FeatureFlagUpdateDTO,
    RuleConditionCreateDTO,
    RuleGroupCreateDTO,
    RuleCreateDTO,
    EvaluationContext,
    LogicalOperator,
    ComparisonOperator
} from '@gefakit/shared';

import { Bindings } from '../../types/hono';
import { AppVariables } from '../../create-app';
import { getFeatureFlagService } from '../../utils/get-service';
import { authMiddleware } from '../../middleware/auth';

const ADMIN_ROLES = new Set(['ADMIN', 'SUPPORT']);

// Zod schemas for validation
const ruleConditionCreateSchema = z.object({
    type: z.literal('condition'),
    field: z.string().min(1),
    operator: z.enum(['=', '!=', '>', '<', '>=', '<=']),
    value: z.any()
});

// Self-referencing schema for nested groups
const ruleGroupCreateSchema: z.ZodType<any> = z.lazy(() =>
    z.object({
        type: z.literal('group'),
        operator: z.enum(['AND', 'OR']),
        rules: z.array(z.union([ruleConditionCreateSchema, ruleGroupCreateSchema]))
    })
);

const ruleCreateSchema = z.union([
    ruleConditionCreateSchema,
    ruleGroupCreateSchema
]);

const environmentConfigSchema = z.object({
    environment: z.string().min(1),
    enabled: z.boolean().optional(),
    rule: ruleGroupCreateSchema.optional()
});

const featureFlagCreateSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional().default(''),
    defaultEnabled: z.boolean().optional().default(false),
    environments: z.array(environmentConfigSchema).optional()
});

const featureFlagUpdateSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    defaultEnabled: z.boolean().optional(),
    environments: z.array(environmentConfigSchema).optional()
});

const evaluationContextSchema = z.object({
    userId: z.number().optional(),
    organizationId: z.number().optional(),
    subscriptionType: z.string().optional(),
    environment: z.string().default('production')
});

const evaluateFlagsSchema = z.object({
    flagIds: z.array(z.string()).optional(),
    flagNames: z.array(z.string()).optional(),
    context: evaluationContextSchema
}).refine(data => {
    return (data.flagIds && data.flagIds.length > 0) || (data.flagNames && data.flagNames.length > 0);
}, {
    message: "At least one of flagIds or flagNames must be provided"
});

export function createFeatureFlagRoutesV1() {
    const app = new Hono<{ Bindings: Bindings, Variables: AppVariables }>();

    // Create a new feature flag
    app.post(
        '/',
        authMiddleware({ allowedRoles: ADMIN_ROLES }),
        zValidator('json', featureFlagCreateSchema),
        async (c) => {
            const data = c.req.valid('json') as FeatureFlagCreateDTO;
            const service = getFeatureFlagService(c);
            const flag = await service.createFlag(data);
            return c.json(flag);
        }
    );

    // Get all feature flags
    app.get('/', async (c) => {
        const service = getFeatureFlagService(c);
        const flags = await service.listFlags();
        return c.json(flags);
    });

    // Get a feature flag by ID
    app.get('/:id', async (c) => {
        const id = c.req.param('id');
        const service = getFeatureFlagService(c);
        const flag = await service.getFlag(id);
        return c.json(flag);
    });

    // Get a feature flag by name
    app.get('/name/:name', async (c) => {
        const name = c.req.param('name');
        const service = getFeatureFlagService(c);
        const flag = await service.getFlagByName(name);
        return c.json(flag);
    });

    // Update a feature flag
    app.put(
        '/:id',
        authMiddleware({ allowedRoles: ADMIN_ROLES }),
        zValidator('json', featureFlagUpdateSchema),
        async (c) => {
            const id = c.req.param('id');
            const data = c.req.valid('json') as FeatureFlagUpdateDTO;
            const service = getFeatureFlagService(c);
            const flag = await service.updateFlag(id, data);
            return c.json(flag);
        }
    );

    // Delete a feature flag
    app.delete('/:id', authMiddleware({ allowedRoles: ADMIN_ROLES }), async (c) => {
        const id = c.req.param('id');
        const service = getFeatureFlagService(c);
        await service.deleteFlag(id);
        return c.json({ success: true });
    });

    // Add a rule to a feature flag (default environment)
    app.post(
        '/:id/rules',
        authMiddleware({ allowedRoles: ADMIN_ROLES }),
        zValidator('json', ruleCreateSchema),
        async (c) => {
            const id = c.req.param('id');
            const data = c.req.valid('json') as RuleCreateDTO;
            const service = getFeatureFlagService(c);
            const rule = await service.addRule(id, data);
            return c.json(rule);
        }
    );

    // Add a rule to a specific environment
    app.post(
        '/:id/environments/:env/rules',
        authMiddleware({ allowedRoles: ADMIN_ROLES }),
        zValidator('json', ruleCreateSchema),
        async (c) => {
            const id = c.req.param('id');
            const env = c.req.param('env');
            const data = c.req.valid('json') as RuleCreateDTO;
            const service = getFeatureFlagService(c);
            const rule = await service.addRuleToEnvironment(id, env, data);
            return c.json(rule);
        }
    );

    // Update a rule
    app.put(
        '/:id/rules/:ruleId',
        authMiddleware({ allowedRoles: ADMIN_ROLES }),
        async (c) => {
            const id = c.req.param('id');
            const ruleId = c.req.param('ruleId');
            const data = await c.req.json();
            const service = getFeatureFlagService(c);
            const rule = await service.updateRule(id, ruleId, data);
            return c.json(rule);
        }
    );

    // Delete a rule
    app.delete('/:id/rules/:ruleId', authMiddleware({ allowedRoles: ADMIN_ROLES }), async (c) => {
        const id = c.req.param('id');
        const ruleId = c.req.param('ruleId');
        const service = getFeatureFlagService(c);
        await service.deleteRule(id, ruleId);
        return c.json({ success: true });
    });

    // Delete a rule from a specific environment
    app.delete('/:id/environments/:env/rules/:ruleId', authMiddleware({ allowedRoles: ADMIN_ROLES }), async (c) => {
        const id = c.req.param('id');
        const env = c.req.param('env');
        const ruleId = c.req.param('ruleId');
        const service = getFeatureFlagService(c);
        await service.deleteRuleFromEnvironment(id, env, ruleId);
        return c.json({ success: true });
    });

    // Evaluate a feature flag by ID
    app.get('/:id/evaluate', async (c) => {
        const id = c.req.param('id');
        const contextParams = c.req.query();

        const context: EvaluationContext = {
            userId: contextParams.userId ? parseInt(contextParams.userId) : undefined,
            organizationId: contextParams.organizationId ? parseInt(contextParams.organizationId) : undefined,
            subscriptionType: contextParams.subscriptionType,
            environment: contextParams.environment || 'production'
        };

        const service = getFeatureFlagService(c);
        const enabled = await service.evaluateFlagById(id, context);

        return c.json({ enabled });
    });

    // Evaluate a feature flag by name
    app.get('/name/:name/evaluate', async (c) => {
        const name = c.req.param('name');
        const contextParams = c.req.query();

        const context: EvaluationContext = {
            userId: contextParams.userId ? parseInt(contextParams.userId) : undefined,
            organizationId: contextParams.organizationId ? parseInt(contextParams.organizationId) : undefined,
            subscriptionType: contextParams.subscriptionType,
            environment: contextParams.environment || 'production'
        };

        const service = getFeatureFlagService(c);
        const enabled = await service.evaluateFlagByName(name, context);

        return c.json({ enabled });
    });

    // Evaluate multiple feature flags
    app.post(
        '/evaluate',
        zValidator('json', evaluateFlagsSchema),
        async (c) => {
            const { flagIds, flagNames, context } = c.req.valid('json') as {
                flagIds?: string[];
                flagNames?: string[];
                context: EvaluationContext;
            };

            const service = getFeatureFlagService(c);
            let results: Record<string, boolean> = {};

            if (flagIds && flagIds.length > 0) {
                results = {
                    ...results,
                    ...await service.evaluateFlags(flagIds, context)
                };
            }

            if (flagNames && flagNames.length > 0) {
                results = {
                    ...results,
                    ...await service.evaluateFlagsByName(flagNames, context)
                };
            }

            return c.json({ results });
        }
    );

    return app;
}
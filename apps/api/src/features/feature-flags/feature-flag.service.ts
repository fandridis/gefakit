// feature-flag.service.ts
import {
    FeatureFlagRepository,
    createFeatureFlagRepository
} from './feature-flag.repository';
import {
    FeatureFlag,
    FeatureFlagCreateDTO,
    FeatureFlagUpdateDTO,
    Rule,
    RuleCreateDTO,
    EvaluationContext,
    FeatureFlagEvaluationResult
} from '@gefakit/shared';
import { featureFlagErrors } from '@gefakit/shared';
import { evaluateFlag } from '@gefakit/feature-flag';

export function createFeatureFlagService({
    featureFlagRepository
}: {
    featureFlagRepository: FeatureFlagRepository
}) {
    async function createFlag(data: FeatureFlagCreateDTO): Promise<FeatureFlag> {
        // Check if flag with same name already exists
        const existingFlag = await featureFlagRepository.getFlagByName(data.name);
        if (existingFlag) {
            throw featureFlagErrors.nameExists(data.name);
        }

        return featureFlagRepository.createFlag(data);
    }

    async function getFlag(id: string): Promise<FeatureFlag> {
        const flag = await featureFlagRepository.getFlag(id);
        if (!flag) {
            throw featureFlagErrors.notFound(id);
        }

        return flag;
    }

    async function getFlagByName(name: string): Promise<FeatureFlag> {
        const flag = await featureFlagRepository.getFlagByName(name);
        if (!flag) {
            throw featureFlagErrors.notFound(`with name ${name}`);
        }

        return flag;
    }

    async function listFlags(): Promise<FeatureFlag[]> {
        return featureFlagRepository.listFlags();
    }

    async function updateFlag(id: string, updates: FeatureFlagUpdateDTO): Promise<FeatureFlag> {
        // Make sure flag exists
        await getFlag(id);

        // If name is being updated, ensure it doesn't conflict
        if (updates.name) {
            const existingFlag = await featureFlagRepository.getFlagByName(updates.name);
            if (existingFlag && existingFlag.id !== id) {
                throw featureFlagErrors.nameExists(updates.name);
            }
        }

        return featureFlagRepository.updateFlag(id, updates);
    }

    async function deleteFlag(id: string): Promise<void> {
        // Make sure flag exists
        await getFlag(id);

        return featureFlagRepository.deleteFlag(id);
    }

    async function addRule(flagId: string, ruleData: RuleCreateDTO): Promise<Rule> {
        // Make sure flag exists
        await getFlag(flagId);

        return featureFlagRepository.addRule(flagId, ruleData);
    }

    async function addRuleToEnvironment(
        flagId: string,
        environment: string,
        ruleData: RuleCreateDTO
    ): Promise<Rule> {
        // Make sure flag exists
        const flag = await getFlag(flagId);

        // Check if environment exists
        const envConfig = flag.environments.find(e => e.environment === environment);
        if (!envConfig) {
            throw featureFlagErrors.environmentNotFound(flagId, environment);
        }

        return featureFlagRepository.addRuleToEnvironment(flagId, environment, ruleData);
    }

    async function updateRule(
        flagId: string,
        ruleId: string,
        updates: Partial<Rule>
    ): Promise<Rule> {
        // Make sure flag exists
        const flag = await getFlag(flagId);

        // Simplified rule existence check (would be more robust with a tree traversal)
        let ruleExists = false;
        for (const env of flag.environments) {
            if (!env.rule) continue;

            if (env.rule.id === ruleId || JSON.stringify(env.rule).includes(`"id":"${ruleId}"`)) {
                ruleExists = true;
                break;
            }
        }

        if (!ruleExists) {
            throw featureFlagErrors.ruleNotFound(flagId, ruleId);
        }

        return featureFlagRepository.updateRule(flagId, ruleId, updates);
    }

    async function deleteRule(flagId: string, ruleId: string): Promise<void> {
        // Make sure flag exists
        const flag = await getFlag(flagId);

        // Simplified rule existence check
        let ruleExists = false;
        for (const env of flag.environments) {
            if (!env.rule) continue;

            if (env.rule.id === ruleId || JSON.stringify(env.rule).includes(`"id":"${ruleId}"`)) {
                ruleExists = true;
                break;
            }
        }

        if (!ruleExists) {
            throw featureFlagErrors.ruleNotFound(flagId, ruleId);
        }

        return featureFlagRepository.deleteRule(flagId, ruleId);
    }

    async function deleteRuleFromEnvironment(
        flagId: string,
        environment: string,
        ruleId: string
    ): Promise<void> {
        // Make sure flag exists
        const flag = await getFlag(flagId);

        // Check if environment exists
        const envConfig = flag.environments.find(e => e.environment === environment);
        if (!envConfig) {
            throw featureFlagErrors.environmentNotFound(flagId, environment);
        }

        // Check if rule exists in this environment
        if (!envConfig.rule) {
            throw featureFlagErrors.ruleNotFound(flagId, ruleId);
        }

        if (envConfig.rule.id !== ruleId && !JSON.stringify(envConfig.rule).includes(`"id":"${ruleId}"`)) {
            throw featureFlagErrors.ruleNotFound(flagId, ruleId);
        }

        return featureFlagRepository.deleteRuleFromEnvironment(flagId, environment, ruleId);
    }

    async function evaluateFlagById(
        flagId: string,
        context: EvaluationContext
    ): Promise<boolean> {
        const flag = await getFlag(flagId);
        return evaluateFlag(flag, context);
    }

    async function evaluateFlagByName(
        name: string,
        context: EvaluationContext
    ): Promise<boolean> {
        const flag = await getFlagByName(name);
        return evaluateFlag(flag, context);
    }

    async function evaluateFlags(
        flagIds: string[],
        context: EvaluationContext
    ): Promise<FeatureFlagEvaluationResult> {
        const result: FeatureFlagEvaluationResult = {};

        // Process all flags in parallel for efficiency
        const evaluations = await Promise.all(
            flagIds.map(async (id) => {
                try {
                    const flag = await featureFlagRepository.getFlag(id);
                    if (!flag) return { id, enabled: false };

                    const enabled = evaluateFlag(flag, context);
                    return { id, enabled };
                } catch (error) {
                    // If there's an error, consider the flag disabled
                    return { id, enabled: false };
                }
            })
        );

        // Convert to record
        evaluations.forEach(({ id, enabled }) => {
            result[id] = enabled;
        });

        return result;
    }

    async function evaluateFlagsByName(
        names: string[],
        context: EvaluationContext
    ): Promise<FeatureFlagEvaluationResult> {
        const result: FeatureFlagEvaluationResult = {};

        // Process all flags in parallel
        const evaluations = await Promise.all(
            names.map(async (name) => {
                try {
                    const flag = await featureFlagRepository.getFlagByName(name);
                    if (!flag) return { name, enabled: false };

                    const enabled = evaluateFlag(flag, context);
                    return { name, enabled };
                } catch (error) {
                    // If there's an error, consider the flag disabled
                    return { name, enabled: false };
                }
            })
        );

        // Convert to record
        evaluations.forEach(({ name, enabled }) => {
            result[name] = enabled;
        });

        return result;
    }

    return {
        createFlag,
        getFlag,
        getFlagByName,
        listFlags,
        updateFlag,
        deleteFlag,
        addRule,
        addRuleToEnvironment,
        updateRule,
        deleteRule,
        deleteRuleFromEnvironment,
        evaluateFlagById,
        evaluateFlagByName,
        evaluateFlags,
        evaluateFlagsByName
    };
}

export type FeatureFlagService = ReturnType<typeof createFeatureFlagService>;
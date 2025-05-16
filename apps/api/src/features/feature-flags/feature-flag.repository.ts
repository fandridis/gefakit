// feature-flag.repository.ts
import { nanoid } from 'nanoid';
import type { KVNamespace } from '@cloudflare/workers-types';
import {
    FeatureFlag,
    FeatureFlagCreateDTO,
    FeatureFlagUpdateDTO,
    EnvironmentConfig,
    RuleGroup,
    RuleCondition,
    RuleCreateDTO,
    RuleGroupCreateDTO,
    RuleConditionCreateDTO,
    Rule
} from '@gefakit/shared';

const FLAG_PREFIX = 'flag:';

// Helper function to convert DTOs to full Rule objects with IDs and timestamps
function processRuleCreateDTO(ruleData: RuleCreateDTO): Rule {
    const now = new Date().toISOString();
    const id = nanoid();

    if (ruleData.type === 'condition') {
        const conditionDto = ruleData as RuleConditionCreateDTO;
        return {
            id,
            type: 'condition',
            field: conditionDto.field,
            operator: conditionDto.operator,
            value: conditionDto.value,
            createdAt: now,
            updatedAt: now,
        } as RuleCondition;
    } else { // 'group'
        const groupDto = ruleData as RuleGroupCreateDTO;
        return {
            id,
            type: 'group',
            operator: groupDto.operator,
            rules: groupDto.rules.map(processRuleCreateDTO),
            createdAt: now,
            updatedAt: now,
        } as RuleGroup;
    }
}

// Helper to find and update a rule in a nested structure
function findAndUpdateRule(
    ruleGroup: RuleGroup,
    ruleId: string,
    updates: Partial<RuleCondition | RuleGroup>
): boolean {
    // Check direct children first
    for (let i = 0; i < ruleGroup.rules.length; i++) {
        const rule = ruleGroup.rules[i];

        // If this is the rule we're looking for
        if (rule.id === ruleId) {
            // Apply updates
            ruleGroup.rules[i] = {
                ...rule,
                ...updates,
                updatedAt: new Date().toISOString()
            } as any; // Using 'any' here to handle the union type
            return true;
        }

        // If it's a group, search recursively
        if (rule.type === 'group') {
            if (findAndUpdateRule(rule as RuleGroup, ruleId, updates)) {
                return true;
            }
        }
    }

    return false;
}

// Helper to find and delete a rule in a nested structure
function findAndDeleteRule(ruleGroup: RuleGroup, ruleId: string): boolean {
    // Check direct children first
    for (let i = 0; i < ruleGroup.rules.length; i++) {
        const rule = ruleGroup.rules[i];

        // If this is the rule we're looking for
        if (rule.id === ruleId) {
            // Remove it
            ruleGroup.rules.splice(i, 1);
            return true;
        }

        // If it's a group, search recursively
        if (rule.type === 'group') {
            if (findAndDeleteRule(rule as RuleGroup, ruleId)) {
                return true;
            }
        }
    }

    return false;
}

export function createFeatureFlagRepository({ kv }: { kv: KVNamespace }) {
    async function createFlag(data: FeatureFlagCreateDTO): Promise<FeatureFlag> {
        const id = nanoid();
        const now = new Date().toISOString();

        // Default environment configs
        const defaultEnvironmentConfigs: EnvironmentConfig[] = [
            { environment: 'development', enabled: true, rule: undefined },
            { environment: 'staging', enabled: false, rule: undefined },
            { environment: 'production', enabled: false, rule: undefined }
        ];

        const flag: FeatureFlag = {
            id,
            name: data.name,
            description: data.description || '',
            defaultEnabled: data.defaultEnabled !== undefined ? data.defaultEnabled : false,
            createdAt: now,
            updatedAt: now,
            environments: data.environments
                ? defaultEnvironmentConfigs.map(defEnv => {
                    const matchingEnv = data.environments?.find(
                        e => e.environment === defEnv.environment
                    );
                    if (matchingEnv) {
                        return {
                            environment: defEnv.environment,
                            enabled: matchingEnv.enabled !== undefined ? matchingEnv.enabled : defEnv.enabled,
                            rule: matchingEnv.rule
                                ? processRuleCreateDTO(matchingEnv.rule as RuleGroupCreateDTO) as RuleGroup
                                : undefined,
                        };
                    }
                    return defEnv;
                })
                : defaultEnvironmentConfigs
        };

        await kv.put(`${FLAG_PREFIX}${id}`, JSON.stringify(flag));
        return flag;
    }

    async function getFlag(id: string): Promise<FeatureFlag | null> {
        const flagJson = await kv.get(`${FLAG_PREFIX}${id}`);
        if (!flagJson) return null;
        return JSON.parse(flagJson) as FeatureFlag;
    }

    async function getFlagByName(name: string): Promise<FeatureFlag | null> {
        // List all keys with the flag prefix
        const { keys } = await kv.list({ prefix: FLAG_PREFIX });

        for (const key of keys) {
            const flagJson = await kv.get(key.name);
            if (!flagJson) continue;

            const flag = JSON.parse(flagJson) as FeatureFlag;
            if (flag.name === name) {
                return flag;
            }
        }

        return null;
    }

    async function listFlags(): Promise<FeatureFlag[]> {
        const { keys } = await kv.list({ prefix: FLAG_PREFIX });
        const flags: FeatureFlag[] = [];

        for (const key of keys) {
            const flagJson = await kv.get(key.name);
            if (flagJson) {
                flags.push(JSON.parse(flagJson) as FeatureFlag);
            }
        }

        return flags;
    }

    async function updateFlag(id: string, updates: FeatureFlagUpdateDTO): Promise<FeatureFlag> {
        const flag = await getFlag(id);
        if (!flag) {
            throw new Error(`Feature flag with ID ${id} not found`);
        }

        const updatedFlag: FeatureFlag = {
            ...flag,
            name: updates.name !== undefined ? updates.name : flag.name,
            description: updates.description !== undefined ? updates.description : flag.description,
            defaultEnabled: updates.defaultEnabled !== undefined ? updates.defaultEnabled : flag.defaultEnabled,
            updatedAt: new Date().toISOString(),
            environments: updates.environments
                ? flag.environments.map(existingEnv => {
                    const matchingEnvUpdate = updates.environments?.find(
                        e => e.environment === existingEnv.environment
                    );
                    if (matchingEnvUpdate) {
                        return {
                            ...existingEnv,
                            enabled: matchingEnvUpdate.enabled !== undefined
                                ? matchingEnvUpdate.enabled
                                : existingEnv.enabled,
                            rule: matchingEnvUpdate.rule !== undefined
                                ? (matchingEnvUpdate.rule
                                    ? processRuleCreateDTO(matchingEnvUpdate.rule as RuleGroupCreateDTO) as RuleGroup
                                    : undefined)
                                : existingEnv.rule,
                        };
                    }
                    return existingEnv;
                })
                : flag.environments
        };

        await kv.put(`${FLAG_PREFIX}${id}`, JSON.stringify(updatedFlag));
        return updatedFlag;
    }

    async function deleteFlag(id: string): Promise<void> {
        await kv.delete(`${FLAG_PREFIX}${id}`);
    }

    async function addRule(flagId: string, ruleData: RuleCreateDTO): Promise<Rule> {
        const flag = await getFlag(flagId);
        if (!flag) {
            throw new Error(`Feature flag with ID ${flagId} not found`);
        }

        // By default, add to development environment
        const envIndex = flag.environments.findIndex(e => e.environment === 'development');
        if (envIndex === -1) {
            throw new Error(`Development environment not found for flag ${flagId}`);
        }

        // Create a root rule group if none exists
        if (!flag.environments[envIndex].rule) {
            flag.environments[envIndex].rule = {
                id: nanoid(),
                type: 'group',
                operator: 'AND',
                rules: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
        }

        const processedRule = processRuleCreateDTO(ruleData);
        flag.environments[envIndex].rule!.rules.push(processedRule);

        flag.updatedAt = new Date().toISOString();
        await kv.put(`${FLAG_PREFIX}${flagId}`, JSON.stringify(flag));

        return processedRule;
    }

    async function addRuleToEnvironment(
        flagId: string,
        environment: string,
        ruleData: RuleCreateDTO
    ): Promise<Rule> {
        const flag = await getFlag(flagId);
        if (!flag) {
            throw new Error(`Feature flag with ID ${flagId} not found`);
        }

        const envIndex = flag.environments.findIndex(e => e.environment === environment);
        if (envIndex === -1) {
            throw new Error(`Environment ${environment} not found for flag ${flagId}`);
        }

        // Create a root rule group if none exists
        if (!flag.environments[envIndex].rule) {
            flag.environments[envIndex].rule = {
                id: nanoid(),
                type: 'group',
                operator: 'AND',
                rules: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
        }

        const processedRule = processRuleCreateDTO(ruleData);
        flag.environments[envIndex].rule!.rules.push(processedRule);

        flag.updatedAt = new Date().toISOString();
        await kv.put(`${FLAG_PREFIX}${flagId}`, JSON.stringify(flag));

        return processedRule;
    }

    async function updateRule(
        flagId: string,
        ruleId: string,
        updates: Partial<RuleCondition | RuleGroup>
    ): Promise<Rule> {
        const flag = await getFlag(flagId);
        if (!flag) {
            throw new Error(`Feature flag with ID ${flagId} not found`);
        }

        let ruleUpdated = false;

        // Try to update in each environment
        for (const env of flag.environments) {
            if (!env.rule) continue;

            // Check if this is the root rule
            if (env.rule.id === ruleId) {
                env.rule = {
                    ...env.rule,
                    ...updates,
                    updatedAt: new Date().toISOString()
                } as RuleGroup;
                ruleUpdated = true;
                break;
            }

            // Check nested rules
            if (findAndUpdateRule(env.rule, ruleId, updates)) {
                ruleUpdated = true;
                break;
            }
        }

        if (!ruleUpdated) {
            throw new Error(`Rule with ID ${ruleId} not found for flag ${flagId}`);
        }

        flag.updatedAt = new Date().toISOString();
        await kv.put(`${FLAG_PREFIX}${flagId}`, JSON.stringify(flag));

        // Find the updated rule to return it (simplified for now)
        for (const env of flag.environments) {
            if (!env.rule) continue;

            if (env.rule.id === ruleId) {
                return env.rule;
            }

            // Deep search would be needed for a complete implementation
            // For simplicity, we'll just return a partial rule object
            if (JSON.stringify(env.rule).includes(`"id":"${ruleId}"`)) {
                return { id: ruleId } as Rule;
            }
        }

        return { id: ruleId } as Rule;
    }

    async function deleteRule(flagId: string, ruleId: string): Promise<void> {
        const flag = await getFlag(flagId);
        if (!flag) {
            throw new Error(`Feature flag with ID ${flagId} not found`);
        }

        let ruleDeleted = false;

        // Try to delete from each environment
        for (const env of flag.environments) {
            if (!env.rule) continue;

            // Check if this is the root rule
            if (env.rule.id === ruleId) {
                env.rule = undefined;
                ruleDeleted = true;
                break;
            }

            // Check nested rules
            if (findAndDeleteRule(env.rule, ruleId)) {
                ruleDeleted = true;
                break;
            }
        }

        if (!ruleDeleted) {
            throw new Error(`Rule with ID ${ruleId} not found for flag ${flagId}`);
        }

        flag.updatedAt = new Date().toISOString();
        await kv.put(`${FLAG_PREFIX}${flagId}`, JSON.stringify(flag));
    }

    async function deleteRuleFromEnvironment(
        flagId: string,
        environment: string,
        ruleId: string
    ): Promise<void> {
        const flag = await getFlag(flagId);
        if (!flag) {
            throw new Error(`Feature flag with ID ${flagId} not found`);
        }

        const env = flag.environments.find(e => e.environment === environment);
        if (!env) {
            throw new Error(`Environment ${environment} not found for flag ${flagId}`);
        }

        if (!env.rule) {
            throw new Error(`No rules defined for environment ${environment}`);
        }

        // Check if this is the root rule
        if (env.rule.id === ruleId) {
            env.rule = undefined;
        } else if (!findAndDeleteRule(env.rule, ruleId)) {
            throw new Error(`Rule with ID ${ruleId} not found in environment ${environment}`);
        }

        flag.updatedAt = new Date().toISOString();
        await kv.put(`${FLAG_PREFIX}${flagId}`, JSON.stringify(flag));
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
        deleteRuleFromEnvironment
    };
}

export type FeatureFlagRepository = ReturnType<typeof createFeatureFlagRepository>;
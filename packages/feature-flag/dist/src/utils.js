// feature-flag.utils.ts
import { isRuleGroup, isRuleCondition } from '@gefakit/shared';
// MurmurHash implementation for deterministic percentage rollouts
function murmurhash3_32_gc(key, seed) {
    const remainder = key.length & 3;
    const bytes = key.length - remainder;
    let h1 = seed;
    const c1 = 0xcc9e2d51;
    const c2 = 0x1b873593;
    let i = 0;
    while (i < bytes) {
        let k1 = ((key.charCodeAt(i) & 0xff)) |
            ((key.charCodeAt(++i) & 0xff) << 8) |
            ((key.charCodeAt(++i) & 0xff) << 16) |
            ((key.charCodeAt(++i) & 0xff) << 24);
        ++i;
        k1 = ((((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16))) & 0xffffffff;
        k1 = (k1 << 15) | (k1 >>> 17);
        k1 = ((((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16))) & 0xffffffff;
        h1 ^= k1;
        h1 = (h1 << 13) | (h1 >>> 19);
        const h1b = ((((h1 & 0xffff) * 5) + ((((h1 >>> 16) * 5) & 0xffff) << 16))) & 0xffffffff;
        h1 = (((h1b & 0xffff) + 0x6b64) + ((((h1b >>> 16) + 0xe654) & 0xffff) << 16));
    }
    let k1 = 0;
    switch (remainder) {
        case 3: k1 ^= (key.charCodeAt(i + 2) & 0xff) << 16;
        case 2: k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
        case 1:
            k1 ^= (key.charCodeAt(i) & 0xff);
            k1 = (((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16)) & 0xffffffff;
            k1 = (k1 << 15) | (k1 >>> 17);
            k1 = (((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16)) & 0xffffffff;
            h1 ^= k1;
    }
    h1 ^= key.length;
    h1 ^= h1 >>> 16;
    h1 = (((h1 & 0xffff) * 0x85ebca6b) + ((((h1 >>> 16) * 0x85ebca6b) & 0xffff) << 16)) & 0xffffffff;
    h1 ^= h1 >>> 13;
    h1 = ((((h1 & 0xffff) * 0xc2b2ae35) + ((((h1 >>> 16) * 0xc2b2ae35) & 0xffff) << 16))) & 0xffffffff;
    h1 ^= h1 >>> 16;
    return h1 >>> 0;
}
export function evaluateCondition(condition, context) {
    const { field, operator, value } = condition;
    // Special handling for percentage rules
    if (operator === '=' &&
        typeof value === 'object' &&
        value !== null &&
        value.type === 'percentage') {
        if (!context.userId)
            return false;
        const seed = value.seed ? parseInt(value.seed, 10) : 0;
        const hash = murmurhash3_32_gc(context.userId.toString(), seed);
        const normalizedHash = (hash % 100) + 1;
        return normalizedHash <= value.percentage;
    }
    // Get the field value from context
    const getFieldValue = (obj, path) => {
        const keys = path.split('.');
        let result = obj;
        for (const key of keys) {
            if (result === undefined || result === null) {
                return undefined;
            }
            result = result[key];
        }
        return result;
    };
    const contextValue = getFieldValue(context, field);
    // Handle the case where field doesn't exist in context
    if (contextValue === undefined) {
        return false;
    }
    // Evaluate based on operator
    switch (operator) {
        case '=':
            // Handle scalar values only
            return contextValue === value;
        case 'IN':
            // Array inclusion check
            return Array.isArray(value) && value.includes(contextValue);
        case 'NOT IN':
            // Negative array inclusion check
            return Array.isArray(value) && !value.includes(contextValue);
        case '!=':
            if (Array.isArray(value)) {
                return !value.includes(contextValue);
            }
            return contextValue !== value;
        case '>':
            return contextValue > value;
        case '<':
            return contextValue < value;
        case '>=':
            return contextValue >= value;
        case '<=':
            return contextValue <= value;
        default:
            return false;
    }
}
export function evaluateRule(rule, context) {
    if (isRuleCondition(rule)) {
        return evaluateCondition(rule, context);
    }
    if (isRuleGroup(rule)) {
        if (rule.rules.length === 0) {
            return false;
        }
        // Evaluate each rule in the group
        const results = rule.rules.map(subRule => evaluateRule(subRule, context));
        // Apply the logical operator
        if (rule.operator === 'AND') {
            return results.every(result => result === true);
        }
        else { // OR
            return results.some(result => result === true);
        }
    }
    return false;
}
export function evaluateFlag(flag, context) {
    // Get environment config or use default
    const envConfig = flag.environments.find(e => e.environment === context.environment);
    // If no matching environment config, use default enabled value
    if (!envConfig) {
        return flag.defaultEnabled;
    }
    // If environment is disabled, flag is off
    if (!envConfig.enabled) {
        return false;
    }
    // If no rule, use environment enabled value
    if (!envConfig.rule) {
        return envConfig.enabled;
    }
    // Evaluate the rule (which is always a group)
    return evaluateRule(envConfig.rule, context);
}

// feature-flag.errors.ts
import { ApiError } from './api-error';

export const featureFlagErrors = {
    notFound: (id: string) => new ApiError(
        `Feature flag ${id} not found`,
        404,
        { code: 'FEATURE_FLAG_NOT_FOUND' }
    ),
    nameExists: (name: string) => new ApiError(
        `Feature flag with name "${name}" already exists`,
        409,
        { code: 'FEATURE_FLAG_NAME_EXISTS' }
    ),
    invalidRuleType: (type: string) => new ApiError(
        `Invalid rule type: ${type}`,
        400,
        { code: 'FEATURE_FLAG_INVALID_RULE_TYPE' }
    ),
    invalidRule: (message: string) => new ApiError(
        `Invalid rule: ${message}`,
        400,
        { code: 'FEATURE_FLAG_INVALID_RULE' }
    ),
    ruleNotFound: (flagId: string, ruleId: string) => new ApiError(
        `Rule ${ruleId} not found for flag ${flagId}`,
        404,
        { code: 'FEATURE_FLAG_RULE_NOT_FOUND' }
    ),
    environmentNotFound: (flagId: string, environment: string) => new ApiError(
        `Environment ${environment} not found for flag ${flagId}`,
        404,
        { code: 'FEATURE_FLAG_ENVIRONMENT_NOT_FOUND' }
    )
};
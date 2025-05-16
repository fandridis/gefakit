// feature-flag.types.ts
export type Environment = 'development' | 'staging' | 'production' | string;
export type LogicalOperator = 'AND' | 'OR';
export type ComparisonOperator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'IN' | 'NOT IN';

// Rule conditions and groups
export interface RuleCondition {
    id: string;
    type: 'condition';
    field: string;
    operator: ComparisonOperator;
    value: any;
    createdAt: string;
    updatedAt: string;
}

export interface RuleGroup {
    id: string;
    type: 'group';
    operator: LogicalOperator;
    rules: (RuleCondition | RuleGroup)[];
    createdAt: string;
    updatedAt: string;
}

export type Rule = RuleCondition | RuleGroup;

// Type guards
export function isRuleGroup(rule: Rule): rule is RuleGroup {
    return rule.type === 'group';
}

export function isRuleCondition(rule: Rule): rule is RuleCondition {
    return rule.type === 'condition';
}

// Environment configuration
export interface EnvironmentConfig {
    environment: Environment;
    enabled: boolean;
    rule?: RuleGroup;  // Optional rule for this environment
}

// Feature flag model
export interface FeatureFlag {
    id: string;
    name: string;
    description: string;
    defaultEnabled: boolean;
    environments: EnvironmentConfig[];
    createdAt: string;
    updatedAt: string;
}

// DTOs for creating/updating rules
export interface RuleConditionCreateDTO {
    type: 'condition';
    field: string;
    operator: ComparisonOperator;
    value: any;
}

export interface RuleGroupCreateDTO {
    type: 'group';
    operator: LogicalOperator;
    rules: (RuleConditionCreateDTO | RuleGroupCreateDTO)[];
}

export type RuleCreateDTO = RuleConditionCreateDTO | RuleGroupCreateDTO;

// DTOs for creating/updating feature flags
export interface FeatureFlagCreateDTO {
    name: string;
    description?: string;
    defaultEnabled?: boolean;
    environments?: Partial<EnvironmentConfig>[];
}

export interface FeatureFlagUpdateDTO {
    name?: string;
    description?: string;
    defaultEnabled?: boolean;
    environments?: Partial<EnvironmentConfig>[];
}

// Context for evaluation
export interface EvaluationContext {
    userId?: number;
    organizationId?: number;
    subscriptionType?: string;
    environment: Environment;
    [key: string]: any;  // Allow additional properties
}

export type FeatureFlagEvaluationResult = Record<string, boolean>;
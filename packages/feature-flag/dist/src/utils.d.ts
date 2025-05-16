import { RuleCondition, Rule, EvaluationContext, FeatureFlag } from '@gefakit/shared';
export declare function evaluateCondition(condition: RuleCondition, context: EvaluationContext): boolean;
export declare function evaluateRule(rule: Rule, context: EvaluationContext): boolean;
export declare function evaluateFlag(flag: FeatureFlag, context: EvaluationContext): boolean;

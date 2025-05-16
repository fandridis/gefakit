import { RuleGroupCreateDTO, ComparisonOperator } from '@gefakit/shared';
export declare class RuleBuilder {
    private currentGroup;
    private groupStack;
    constructor();
    where(field: string, operator: ComparisonOperator, value: any): RuleBuilder;
    whereEquals(field: string, value: any): RuleBuilder;
    whereNotEquals(field: string, value: any): RuleBuilder;
    whereGreaterThan(field: string, value: number): RuleBuilder;
    whereLessThan(field: string, value: number): RuleBuilder;
    whereGreaterThanOrEqual(field: string, value: number): RuleBuilder;
    whereLessThanOrEqual(field: string, value: number): RuleBuilder;
    whereIn(field: string, values: any[]): RuleBuilder;
    whereNotIn(field: string, values: any[]): RuleBuilder;
    whereUser(userIds: number | number[]): RuleBuilder;
    whereOrganization(orgIds: number | number[]): RuleBuilder;
    whereSubscription(types: string | string[]): RuleBuilder;
    wherePercentage(percentage: number, seed?: string): RuleBuilder;
    and(): RuleBuilder;
    or(): RuleBuilder;
    endGroup(): RuleBuilder;
    build(): RuleGroupCreateDTO;
    private startGroup;
}

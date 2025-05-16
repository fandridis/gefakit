// rule-builder.ts
import {
    RuleConditionCreateDTO,
    RuleGroupCreateDTO,
    LogicalOperator,
    ComparisonOperator
} from '@gefakit/shared';

export class RuleBuilder {
    private currentGroup: RuleGroupCreateDTO;
    private groupStack: RuleGroupCreateDTO[] = [];

    constructor() {
        // Start with a root AND group
        this.currentGroup = {
            type: 'group',
            operator: 'AND',
            rules: []
        };
    }

    // Create a condition
    where(field: string, operator: ComparisonOperator, value: any): RuleBuilder {
        const condition: RuleConditionCreateDTO = {
            type: 'condition',
            field,
            operator,
            value
        };

        this.currentGroup.rules.push(condition);
        return this;
    }

    // Shorthand methods
    whereEquals(field: string, value: any): RuleBuilder {
        return this.where(field, '=', value);
    }

    whereNotEquals(field: string, value: any): RuleBuilder {
        return this.where(field, '!=', value);
    }

    whereGreaterThan(field: string, value: number): RuleBuilder {
        return this.where(field, '>', value);
    }

    whereLessThan(field: string, value: number): RuleBuilder {
        return this.where(field, '<', value);
    }

    whereGreaterThanOrEqual(field: string, value: number): RuleBuilder {
        return this.where(field, '>=', value);
    }

    whereLessThanOrEqual(field: string, value: number): RuleBuilder {
        return this.where(field, '<=', value);
    }

    whereIn(field: string, values: any[]): RuleBuilder {
        return this.where(field, '=', values);
    }

    whereNotIn(field: string, values: any[]): RuleBuilder {
        return this.where(field, '!=', values);
    }

    // Targeting shortcuts
    whereUser(userIds: number | number[]): RuleBuilder {
        const ids = Array.isArray(userIds) ? userIds : [userIds];
        return this.whereIn('userId', ids);
    }

    whereOrganization(orgIds: number | number[]): RuleBuilder {
        const ids = Array.isArray(orgIds) ? orgIds : [orgIds];
        return this.whereIn('organizationId', ids);
    }

    whereSubscription(types: string | string[]): RuleBuilder {
        const typeArray = Array.isArray(types) ? types : [types];
        return this.whereIn('subscriptionType', typeArray);
    }

    // Percentage rollout
    wherePercentage(percentage: number, seed?: string): RuleBuilder {
        return this.where('userId', '=', {
            type: 'percentage',
            percentage,
            seed
        });
    }

    // Start a new AND group
    and(): RuleBuilder {
        this.startGroup('AND');
        return this;
    }

    // Start a new OR group
    or(): RuleBuilder {
        this.startGroup('OR');
        return this;
    }

    // End the current group
    endGroup(): RuleBuilder {
        if (this.groupStack.length === 0) {
            throw new Error('No group to end');
        }

        this.currentGroup = this.groupStack.pop()!;
        return this;
    }

    // Build the final rule
    build(): RuleGroupCreateDTO {
        if (this.groupStack.length > 0) {
            throw new Error('Unclosed groups');
        }

        return { ...this.currentGroup };
    }

    private startGroup(operator: LogicalOperator): void {
        const newGroup: RuleGroupCreateDTO = {
            type: 'group',
            operator,
            rules: []
        };

        this.groupStack.push(this.currentGroup);
        this.currentGroup.rules.push(newGroup);
        this.currentGroup = newGroup;
    }
}
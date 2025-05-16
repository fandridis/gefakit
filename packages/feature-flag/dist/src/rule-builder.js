export class RuleBuilder {
    constructor() {
        this.groupStack = [];
        // Start with a root AND group
        this.currentGroup = {
            type: 'group',
            operator: 'AND',
            rules: []
        };
    }
    // Create a condition
    where(field, operator, value) {
        const condition = {
            type: 'condition',
            field,
            operator,
            value
        };
        this.currentGroup.rules.push(condition);
        return this;
    }
    // Shorthand methods
    whereEquals(field, value) {
        return this.where(field, '=', value);
    }
    whereNotEquals(field, value) {
        return this.where(field, '!=', value);
    }
    whereGreaterThan(field, value) {
        return this.where(field, '>', value);
    }
    whereLessThan(field, value) {
        return this.where(field, '<', value);
    }
    whereGreaterThanOrEqual(field, value) {
        return this.where(field, '>=', value);
    }
    whereLessThanOrEqual(field, value) {
        return this.where(field, '<=', value);
    }
    whereIn(field, values) {
        return this.where(field, '=', values);
    }
    whereNotIn(field, values) {
        return this.where(field, '!=', values);
    }
    // Targeting shortcuts
    whereUser(userIds) {
        const ids = Array.isArray(userIds) ? userIds : [userIds];
        return this.whereIn('userId', ids);
    }
    whereOrganization(orgIds) {
        const ids = Array.isArray(orgIds) ? orgIds : [orgIds];
        return this.whereIn('organizationId', ids);
    }
    whereSubscription(types) {
        const typeArray = Array.isArray(types) ? types : [types];
        return this.whereIn('subscriptionType', typeArray);
    }
    // Percentage rollout
    wherePercentage(percentage, seed) {
        return this.where('userId', '=', {
            type: 'percentage',
            percentage,
            seed
        });
    }
    // Start a new AND group
    and() {
        this.startGroup('AND');
        return this;
    }
    // Start a new OR group
    or() {
        this.startGroup('OR');
        return this;
    }
    // End the current group
    endGroup() {
        if (this.groupStack.length === 0) {
            throw new Error('No group to end');
        }
        this.currentGroup = this.groupStack.pop();
        return this;
    }
    // Build the final rule
    build() {
        if (this.groupStack.length > 0) {
            throw new Error('Unclosed groups');
        }
        return { ...this.currentGroup };
    }
    startGroup(operator) {
        const newGroup = {
            type: 'group',
            operator,
            rules: []
        };
        this.groupStack.push(this.currentGroup);
        this.currentGroup.rules.push(newGroup);
        this.currentGroup = newGroup;
    }
}

// feature-flag-client.ts
import { FeatureFlagEvaluationResult, EvaluationContext } from '@gefakit/shared';

/**
 * Feature flag client for TypeScript applications
 */
export class FeatureFlagClient {
    private baseUrl: string;
    private flagCache: Map<string, boolean> = new Map();
    private context: EvaluationContext;
    private pollingInterval: number | null = null;
    private pollingIntervalMs: number = 60000; // 1 minute default

    constructor({
        baseUrl = '/api/v1/feature-flags',
        context,
        pollingIntervalMs
    }: {
        baseUrl?: string;
        context: EvaluationContext;
        pollingIntervalMs?: number;
    }) {
        this.baseUrl = baseUrl;
        this.context = context;

        if (pollingIntervalMs !== undefined) {
            this.pollingIntervalMs = pollingIntervalMs;
        }
    }

    /**
     * Start polling for flag updates
     */
    startPolling(flagNames: string[]): () => void {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }

        // Initial fetch
        this.fetchFlags(flagNames);

        // Set up polling
        this.pollingInterval = window.setInterval(() => {
            this.fetchFlags(flagNames);
        }, this.pollingIntervalMs);

        // Return cleanup function
        return () => {
            if (this.pollingInterval) {
                clearInterval(this.pollingInterval);
                this.pollingInterval = null;
            }
        };
    }

    /**
     * Stop polling for flag updates
     */
    stopPolling(): void {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    /**
     * Set the context for flag evaluation
     */
    setContext(context: Partial<EvaluationContext>): void {
        this.context = {
            ...this.context,
            ...context
        };

        // Clear cache when context changes
        this.flagCache.clear();
    }

    /**
     * Check if a feature flag is enabled
     */
    async isEnabled(flagName: string): Promise<boolean> {
        // Check cache first
        if (this.flagCache.has(flagName)) {
            return this.flagCache.get(flagName) as boolean;
        }

        try {
            const response = await fetch(
                `${this.baseUrl}/name/${encodeURIComponent(flagName)}/evaluate?` +
                new URLSearchParams({
                    ...(this.context.userId && { userId: this.context.userId.toString() }),
                    ...(this.context.organizationId && { organizationId: this.context.organizationId.toString() }),
                    ...(this.context.subscriptionType && { subscriptionType: this.context.subscriptionType }),
                    environment: this.context.environment
                })
            );

            if (!response.ok) {
                console.error(`Error fetching feature flag ${flagName}:`, response.statusText);
                return false;
            }

            const { enabled } = await response.json();
            this.flagCache.set(flagName, enabled);

            return enabled;
        } catch (error) {
            console.error(`Error evaluating feature flag ${flagName}:`, error);
            return false;
        }
    }

    /**
     * Evaluate multiple flags at once
     */
    async evaluateFlags(flagNames: string[]): Promise<FeatureFlagEvaluationResult> {
        try {
            const response = await fetch(`${this.baseUrl}/evaluate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    flagNames,
                    context: this.context
                })
            });

            if (!response.ok) {
                console.error('Error evaluating feature flags:', response.statusText);
                return flagNames.reduce((acc, name) => ({ ...acc, [name]: false }), {});
            }

            const { results } = await response.json();

            // Update cache
            Object.entries(results).forEach(([name, enabled]) => {
                this.flagCache.set(name, enabled as boolean);
            });

            return results;
        } catch (error) {
            console.error('Error evaluating feature flags:', error);
            return flagNames.reduce((acc, name) => ({ ...acc, [name]: false }), {});
        }
    }

    /**
     * Fetch flags and update cache
     */
    private async fetchFlags(flagNames: string[]): Promise<void> {
        try {
            const results = await this.evaluateFlags(flagNames);

            // Update cache
            Object.entries(results).forEach(([name, enabled]) => {
                this.flagCache.set(name, enabled);
            });
        } catch (error) {
            console.error('Error fetching feature flags:', error);
        }
    }
}
import { FeatureFlagEvaluationResult, EvaluationContext } from '@gefakit/shared';
/**
 * Feature flag client for TypeScript applications
 */
export declare class FeatureFlagClient {
    private baseUrl;
    private flagCache;
    private context;
    private pollingInterval;
    private pollingIntervalMs;
    constructor({ baseUrl, context, pollingIntervalMs }: {
        baseUrl?: string;
        context: EvaluationContext;
        pollingIntervalMs?: number;
    });
    /**
     * Start polling for flag updates
     */
    startPolling(flagNames: string[]): () => void;
    /**
     * Stop polling for flag updates
     */
    stopPolling(): void;
    /**
     * Set the context for flag evaluation
     */
    setContext(context: Partial<EvaluationContext>): void;
    /**
     * Check if a feature flag is enabled
     */
    isEnabled(flagName: string): Promise<boolean>;
    /**
     * Evaluate multiple flags at once
     */
    evaluateFlags(flagNames: string[]): Promise<FeatureFlagEvaluationResult>;
    /**
     * Fetch flags and update cache
     */
    private fetchFlags;
}

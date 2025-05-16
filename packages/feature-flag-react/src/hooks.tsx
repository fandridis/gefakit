// feature-flag-hooks.tsx
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { FeatureFlagClient } from '@gefakit/feature-flag';
import { EvaluationContext } from '@gefakit/shared';

// Context Type
interface FeatureFlagContextType {
    client: FeatureFlagClient | null;
    isLoading: boolean;
    flags: Record<string, boolean>;
    refreshFlags: (flagNames?: string[]) => Promise<void>;
}

// Create Context
const FeatureFlagContext = createContext<FeatureFlagContextType>({
    client: null,
    isLoading: false,
    flags: {},
    refreshFlags: async () => { }
});

// Provider Props
export interface FeatureFlagProviderProps {
    baseUrl?: string;
    initialContext: EvaluationContext;
    pollingIntervalMs?: number;
    initialFlags?: string[];
    children: React.ReactNode;
}

// Provider Component
export function FeatureFlagProvider({
    baseUrl,
    initialContext,
    pollingIntervalMs,
    initialFlags = [],
    children
}: FeatureFlagProviderProps) {
    const [client] = useState(() => new FeatureFlagClient({
        baseUrl,
        context: initialContext,
        pollingIntervalMs
    }));

    const [flags, setFlags] = useState<Record<string, boolean>>({});
    const [isLoading, setIsLoading] = useState<boolean>(initialFlags.length > 0);
    const [trackedFlags, setTrackedFlags] = useState<Set<string>>(new Set(initialFlags));

    const refreshFlags = useCallback(async (flagNames?: string[]) => {
        const flagsToRefresh = flagNames || Array.from(trackedFlags);
        if (flagsToRefresh.length === 0) return;

        setIsLoading(true);
        try {
            const results = await client.evaluateFlags(flagsToRefresh);
            setFlags(current => ({ ...current, ...results }));
        } catch (error) {
            console.error('Error refreshing flags:', error);
        } finally {
            setIsLoading(false);
        }
    }, [client, trackedFlags]);

    // Update tracked flags and refresh when initialFlags change
    useEffect(() => {
        const newTrackedFlags = new Set([...trackedFlags, ...initialFlags]);

        if (initialFlags.length > 0 && newTrackedFlags.size !== trackedFlags.size) {
            setTrackedFlags(newTrackedFlags);
            refreshFlags(initialFlags);
        }
    }, [initialFlags, refreshFlags, trackedFlags]);

    // Start polling for tracked flags
    useEffect(() => {
        const flagsArray = Array.from(trackedFlags);
        if (flagsArray.length === 0) return;

        const stopPolling = client.startPolling(flagsArray);

        return () => {
            stopPolling();
        };
    }, [client, trackedFlags]);

    const contextValue = useMemo(() => ({
        client,
        isLoading,
        flags,
        refreshFlags
    }), [client, isLoading, flags, refreshFlags]);

    return (
        <FeatureFlagContext.Provider value={contextValue} >
            {children}
        </FeatureFlagContext.Provider>
    );
}

// Hook for single flag
export function useFeatureFlag(flagName: string): {
    enabled: boolean;
    isLoading: boolean;
    refresh: () => Promise<void>;
} {
    const { client, flags, isLoading, refreshFlags } = useContext(FeatureFlagContext);
    const [enabled, setEnabled] = useState<boolean>(!!flags[flagName]);
    const [localLoading, setLocalLoading] = useState<boolean>(!flags.hasOwnProperty(flagName));

    // Fetch flag if not in context
    useEffect(() => {
        // If flag is already in the context, use that value
        if (flags.hasOwnProperty(flagName)) {
            setEnabled(flags[flagName]);
            setLocalLoading(false);
            return;
        }

        // Otherwise, fetch it
        let isMounted = true;
        setLocalLoading(true);

        const fetchFlag = async () => {
            if (!client) return;

            try {
                const isEnabled = await client.isEnabled(flagName);
                if (isMounted) {
                    setEnabled(isEnabled);
                    setLocalLoading(false);
                }
            } catch (error) {
                console.error(`Error fetching feature flag ${flagName}:`, error);
                if (isMounted) {
                    setEnabled(false);
                    setLocalLoading(false);
                }
            }
        };

        fetchFlag();

        return () => {
            isMounted = false;
        };
    }, [client, flagName, flags]);

    // Update local state when context flags change
    useEffect(() => {
        if (flags.hasOwnProperty(flagName)) {
            setEnabled(flags[flagName]);
            setLocalLoading(false);
        }
    }, [flags, flagName]);

    const refresh = useCallback(async () => {
        await refreshFlags([flagName]);
    }, [flagName, refreshFlags]);

    return {
        enabled,
        isLoading: isLoading || localLoading,
        refresh
    };
}

// Hook for multiple flags
export function useFeatureFlags(flagNames: string[]): {
    flags: Record<string, boolean>;
    isLoading: boolean;
    refresh: () => Promise<void>;
} {
    const { flags: contextFlags, isLoading: contextLoading, refreshFlags } = useContext(FeatureFlagContext);
    const [localFlags, setLocalFlags] = useState<Record<string, boolean>>({});
    const [allFlags, setAllFlags] = useState<Record<string, boolean>>({});

    // Get flags from context or trigger fetch
    useEffect(() => {
        // Get flags from context that are in our list
        const flagsFromContext: Record<string, boolean> = {};
        let needsLocalFetch = false;

        flagNames.forEach(name => {
            if (contextFlags.hasOwnProperty(name)) {
                flagsFromContext[name] = contextFlags[name];
            } else {
                needsLocalFetch = true;
            }
        });

        // If we have all flags from context, no need to fetch locally
        if (!needsLocalFetch) {
            setAllFlags(flagsFromContext);
            return;
        }

        // Trigger a refresh for missing flags
        refreshFlags(flagNames.filter(name => !contextFlags.hasOwnProperty(name)));
    }, [contextFlags, flagNames, refreshFlags]);

    // Combine local and context flags
    useEffect(() => {
        const combinedFlags: Record<string, boolean> = {
            ...localFlags,
            ...contextFlags
        };

        const relevantFlags: Record<string, boolean> = {};
        flagNames.forEach(name => {
            if (combinedFlags.hasOwnProperty(name)) {
                relevantFlags[name] = combinedFlags[name];
            }
        });

        setAllFlags(relevantFlags);
    }, [contextFlags, localFlags, flagNames]);

    const refresh = useCallback(async () => {
        await refreshFlags(flagNames);
    }, [flagNames, refreshFlags]);

    return {
        flags: allFlags,
        isLoading: contextLoading && Object.keys(allFlags).length < flagNames.length,
        refresh
    };
}

// Component for conditional rendering
export function FeatureFlag({
    name,
    fallback = null,
    children
}: {
    name: string;
    fallback?: React.ReactNode;
    children: React.ReactNode;
}) {
    const { enabled, isLoading } = useFeatureFlag(name);

    if (isLoading) {
        return null;
    }

    return enabled ? <>{children}</> : <>{fallback}</>;
}
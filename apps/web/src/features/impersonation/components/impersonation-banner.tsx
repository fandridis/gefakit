import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { sessionQueryKey, useAuth } from '@/features/auth/hooks/use-auth'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiStopImpersonation } from '@/features/impersonation/api'
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { LoadingOverlay } from '@/components/loading-overlay'


export function ImpersonationBanner() {
    const { session } = useAuth();
    const queryClient = useQueryClient();
    const [isCollapsed, setIsCollapsed] = useState(false);

    const stopImpersonationMutation = useMutation({
        mutationFn: apiStopImpersonation,
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: sessionQueryKey });
            window.location.reload();
        },
    });

    if (!session?.session?.impersonator_user_id) {
        return null
    }

    const handleStopImpersonation = () => {
        stopImpersonationMutation.mutate();
    }

    const toggleCollapse = () => {
        setIsCollapsed(!isCollapsed);
    }

    const user = session?.user;

    if (isCollapsed) {
        return (
            <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 w-full max-w-[180px] bg-pink-700 text-white py-2 px-2 flex items-center justify-center gap-1 shadow-md rounded">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">Impersonating</span>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleCollapse}
                    className="h-6 w-6 text-white hover:text-pink-950"
                >
                    <ChevronDown />
                </Button>
            </div>
        )
    }

    return (
        <div className="fixed top-0 left-0 right-0 z-50 bg-pink-700 py-2 px-4 flex flex-wrap items-center justify-between gap-2 shadow-md">
            <div className="flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-white" />
                <span className="font-medium text-white">
                    <span className="hidden sm:inline">You are currently </span>
                    impersonating {user?.username} ({user?.email})
                </span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
                <LoadingOverlay loading={stopImpersonationMutation.isPending}>
                    <Button
                        variant='secondary'
                        size="sm"
                        onClick={handleStopImpersonation}
                        disabled={stopImpersonationMutation.isPending}
                    >
                        Stop Impersonation
                    </Button>
                </LoadingOverlay>
                <Button
                    variant='ghost'
                    size="icon"
                    onClick={toggleCollapse}
                    className="h-8 w-8 text-white hover:text-pink-950"
                >
                    <ChevronUp />
                </Button>
            </div>
        </div>
    )
}


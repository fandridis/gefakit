import { useQueryClient, useQuery } from '@tanstack/react-query';
import { OrganizationMembershipDTO } from '@gefakit/shared/src/types/organization';
import { apiGetOrganizationMemberships } from '../api';

// Define a query key for organization memberships
export const organizationMembershipsQueryKey = ['myOrganizationMemberships'] as const;

export function useOrganizations() {
    const queryClient = useQueryClient();

    const { 
        data: membershipsData, 
        isLoading: isLoadingMemberships, 
        error: membershipsError,
        isSuccess: isMembershipsSuccess,
        refetch: refetchMemberships
    } = useQuery<
        { memberships: OrganizationMembershipDTO[] },
        Error
    >({
        queryKey: organizationMembershipsQueryKey,
        queryFn: apiGetOrganizationMemberships,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    // Function to invalidate the memberships query cache
    const invalidateMemberships = () => {
        queryClient.invalidateQueries({ queryKey: organizationMembershipsQueryKey });
    };

    return {
        // Memberships state
        memberships: membershipsData?.memberships ?? [],
        isLoadingMemberships,
        membershipsError,
        isMembershipsSuccess,
        refetchMemberships,
        
        // Helper method
        invalidateMemberships
    };
} 
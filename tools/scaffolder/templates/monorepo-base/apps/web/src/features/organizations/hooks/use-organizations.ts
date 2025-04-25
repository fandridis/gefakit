import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import {
    OrganizationMembershipDTO, 
    CreateOrganizationRequestBodyDTO,
    CreateOrganizationResponseDTO, 
    OrganizationDTO
} from '@gefakit/shared/src/types/organization'; 
import { apiGetOrganizationMemberships, apiCreateOrganization, apiLeaveOrganization, apiDeleteOrganization } from '../api'; 

export function useOrganizations() {
    const queryClient = useQueryClient();

    const { data: membershipsData, isLoading: isLoadingMemberships, error: membershipsError } = useQuery<
        { memberships: OrganizationMembershipDTO[] }, 
        Error
    >({
        queryKey: ['myOrganizationMemberships'],
        queryFn: apiGetOrganizationMemberships, 
        // staleTime: 5 * 60 * 1000,
    });

    const { mutate: createOrganization, isPending: isCreatingOrganization, error: createError } = useMutation<
        CreateOrganizationResponseDTO,
        Error,
        CreateOrganizationRequestBodyDTO
    >({
        mutationFn: apiCreateOrganization,
        onSuccess: (data) => {
            console.log('Organization creation response:', data);
            queryClient.invalidateQueries({ queryKey: ['myOrganizationMemberships'] });
        },
        onError: (err) => {
            console.error("Error creating organization:", err);
        },
    });

    const { mutate: deleteOrganizationMembership, isPending: isDeletingMembership, error: deleteMembershipError } = useMutation<
        void,
        Error,
        { organizationId: number }
    >({
        mutationFn: apiLeaveOrganization,
        onSuccess: () => {
            // Invalidate memberships query to refresh the list
            queryClient.invalidateQueries({ queryKey: ['myOrganizationMemberships'] });
        },
        onError: (err) => {
            console.error("Error deleting organization membership:", err);
        },
    });

    const { mutate: deleteOrganization, isPending: isDeletingOrganization, error: deleteOrganizationError } = useMutation<
        void,
        Error,
        { organizationId: number }
    >({
        mutationFn: apiDeleteOrganization,
        onSuccess: () => {
            console.log('Organization deleted successfully.');
            // Invalidate memberships query as the user might no longer be part of the deleted org
            queryClient.invalidateQueries({ queryKey: ['myOrganizationMemberships'] });
        },
        onError: (err) => {
            console.error("Error deleting organization:", err);
        },
    });

    return {
        memberships: membershipsData?.memberships ?? [],
        isLoadingMemberships,
        membershipsError,
        createOrganization,
        isCreatingOrganization,
        createOrganizationError: createError as Error | null,
        deleteOrganizationMembership, 
        isDeletingMembership,
        deleteMembershipError: deleteMembershipError as Error | null,
        deleteOrganization,
        isDeletingOrganization,
        deleteOrganizationError: deleteOrganizationError as Error | null,
    };
} 
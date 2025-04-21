import { CreateOrganizationRequestBodyDTO, GetOrganizationMembershipsResponseDTO, CreateOrganizationResponseDTO } from "@gefakit/shared/src/types/organization";

const API_ORG_BASE_URL = 'http://localhost:8787/api/v1/organizations';
const API_ORG_MEMBERSHIP_BASE_URL = 'http://localhost:8787/api/v1/organization-memberships';

export const apiGetOrganizationMemberships = async (): Promise<GetOrganizationMembershipsResponseDTO> => {
  try {
    const response = await fetch(`${API_ORG_MEMBERSHIP_BASE_URL}`, { // Use new endpoint
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch organization memberships: Server responded with ${response.status}`);
    }

    const data = await response.json();
    // Ensure the return type matches the promise
    return data as GetOrganizationMembershipsResponseDTO; 
  } catch (error) {
    console.error("Error during apiGetOrganizationMemberships fetch:", error);
    throw error;
  }
};

export const apiCreateOrganization = async (orgData: CreateOrganizationRequestBodyDTO): Promise<CreateOrganizationResponseDTO> => {
  try {
    const response = await fetch(`${API_ORG_BASE_URL}`, { // Use original base for creation
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orgData),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to create organization' }));
      throw new Error(errorData.message || 'Organization creation failed');
    }
    const data = await response.json();
    return data as CreateOrganizationResponseDTO;
  } catch (error) {
    console.error("Error during apiCreateOrganization fetch:", error);
    throw error;
  }
};

// New function to delete an organization membership
export const apiDeleteOrganization = async ({ organizationId }: { organizationId: number }): Promise<void> => {
  try {
    // Assuming the endpoint is DELETE /api/v1/my/organization-memberships/:orgId
    const response = await fetch(`${API_ORG_BASE_URL}/${organizationId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to delete membership: Server responded with ${response.status}`);
    }
    
    // No content expected on successful delete
  } catch (error) {
    console.error("Error during apiDeleteOrganization fetch:", error);
    throw error; // Re-throw the error to be caught by react-query mutation
  }
};

// Updated to use organizationId based on the new route
export const apiLeaveOrganization = async ({ organizationId }: { organizationId: number }): Promise<void> => {
  try {
    // Use the new endpoint structure requiring organizationId
    const response = await fetch(`${API_ORG_BASE_URL}/${organizationId}/memberships/me`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json', // Good practice to include Accept header
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // Update error message to reflect the change
      throw new Error(errorData.message || `Failed to leave organization: Server responded with ${response.status}`);
    }

    // No content expected on successful delete, backend sends { success: true } which we don't need here.
  } catch (error) {
    console.error("Error during apiLeaveOrganization fetch:", error);
    throw error;
  }
};

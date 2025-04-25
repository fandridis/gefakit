import { useState } from 'react';
import { useOrganizations } from '../hooks/use-organizations';

export function OrganizationView() {
    const [orgName, setOrgName] = useState('');
    const {
        createOrganization,
        isCreatingOrganization,
        createOrganizationError,
        memberships,
        isLoadingMemberships,
        membershipsError,
        deleteOrganizationMembership,
        isDeletingMembership,
        deleteMembershipError,
        deleteOrganization,
        isDeletingOrganization,
        deleteOrganizationError,
    } = useOrganizations();

    const handleCreate = () => {
        if (orgName.trim()) {
            createOrganization({ name: orgName.trim() });
            setOrgName('');
        } else {
            alert('Please enter an organization name.');
        }
    };

    const handleLeaveOrganization = (organizationId: number) => {
        if (window.confirm(`Are you sure you want to leave the organization? This cannot be undone.`)) {
            deleteOrganizationMembership({ organizationId });
        }
    };

    const handleDeleteOrganization = (organizationId: number, organizationName: string) => {
        if (window.confirm(`Are you sure you want to DELETE the organization "${organizationName}"? This will remove all members and cannot be undone.`)) {
            deleteOrganization({ organizationId });
        }
    };

    return (
        <div>
            <h3>Organizations</h3>

            <div style={{ marginBottom: '20px' }}>
                <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="New Organization Name"
                    disabled={isCreatingOrganization}
                    style={{ marginRight: '8px' }}
                />
                <button onClick={handleCreate} disabled={isCreatingOrganization || !orgName.trim()}>
                    {isCreatingOrganization ? 'Creating...' : 'Create Organization'}
                </button>
                {createOrganizationError && (
                    <p style={{ color: 'red', marginTop: '5px' }}>
                        Error creating organization: {createOrganizationError.message}
                    </p>
                )}
            </div>

            <h4>Your Organizations</h4>
            {isLoadingMemberships && <p>Loading organizations...</p>}
            {membershipsError && (
                <p style={{ color: 'red' }}>
                    Error loading organizations: {membershipsError.message}
                </p>
            )}
            {deleteMembershipError && (
                <p style={{ color: 'red', marginTop: '5px' }}>
                    Error leaving organization: {deleteMembershipError.message}
                </p>
            )}
            {deleteOrganizationError && (
                <p style={{ color: 'red', marginTop: '5px' }}>
                    Error deleting organization: {deleteOrganizationError.message}
                </p>
            )}

            {!isLoadingMemberships && !membershipsError && (
                <ul style={{ listStyle: 'none', padding: 0 }}>
                    {memberships.length === 0 && <p>You are not a member of any organizations yet.</p>}
                    {memberships.map((membership) => (
                        <li key={membership.organization.id} style={{ border: '1px solid #ccc', padding: '10px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <strong>{membership.organization.name}</strong>
                                <span style={{ marginLeft: '10px', fontStyle: 'italic' }}>({membership.role})</span>
                            </div>
                            <button
                                onClick={() => handleLeaveOrganization(membership.organization.id)}
                                disabled={isDeletingMembership}
                                style={{ marginLeft: '10px', backgroundColor: '#ff9800', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
                            >
                                {isDeletingMembership ? 'Leaving...' : 'Leave Organization'}
                            </button>
                            {membership.role === 'owner' && (
                                <button
                                    onClick={() => handleDeleteOrganization(membership.organization.id, membership.organization.name)}
                                    disabled={isDeletingOrganization}
                                    style={{ marginLeft: '10px', backgroundColor: '#f44336', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                    {isDeletingOrganization ? 'Deleting...' : 'Delete Organization'}
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
} 
// Remove potentially incorrect schema re-exports
// export * from "./schemas/user.schema";
// export * from "./schemas/representative.schema";
// export * from "./schemas/vehicle.schema";
// export * from "./schemas/subscription.schema";

export * from "./types/user";
export * from "./types/auth";

// Remove duplicated UserDTO interface definition
// export interface UserDTO {
//     id: number;
//     email: string;
//     username: string | null;
//     email_verified: boolean;
//     created_at: Date;
// }
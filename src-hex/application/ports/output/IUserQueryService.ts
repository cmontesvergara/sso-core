/**
 * IUserQueryService
 *
 * Encapsulates complex user queries and mutations for admin operations.
 * This is a pragmatic service — it lives at the application boundary
 * and is implemented with Prisma in infrastructure.
 */

export interface ListUsersQuery {
    page?: string | number;
    limit?: string | number;
    search?: string;
    userStatus?: string;
    status?: string;
}

export interface PaginatedUsersResult {
    users: any[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export interface UpdateProfileData {
    firstName?: string;
    secondName?: string;
    lastName?: string;
    secondLastName?: string;
    phone?: string;
    birthDate?: Date;
    gender?: string;
    nationality?: string;
    birthPlace?: string;
    placeOfResidence?: string;
    occupation?: string;
    maritalStatus?: string;
}

export interface AddressInput {
    country: string;
    province: string;
    city: string;
    detail: string;
    postalCode?: string;
}

export interface IUserQueryService {
    listUsers(query: ListUsersQuery): Promise<PaginatedUsersResult>;
    getUserById(userId: string): Promise<any | null>;
    getUserTenantsWithApps(userId: string): Promise<any[]>;
    updateProfile(userId: string, data: UpdateProfileData, addresses?: AddressInput[]): Promise<any>;
    updateUserStatus(userId: string, status: string): Promise<any>;
    resolveUserId(userId?: string, email?: string): Promise<string | null>;
}

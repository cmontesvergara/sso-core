import { IUserService } from '../core/interfaces/service.interface';
import { mapUserToResponse } from '../core/mappers/user.mapper';
import { UserResponseDTO } from '../core/dtos/user.dto';
import {
    listUsers,
    countUsers,
    findUserById,
    findUserByEmail,
    updateUser,
    deleteUser,
} from '../repositories/userRepo.prisma';

export class UserService implements IUserService {
    async getUserById(id: string): Promise<UserResponseDTO | null> {
        const user = await findUserById(id);
        return user ? mapUserToResponse(user as any) : null;
    }

    async getUserByEmail(email: string): Promise<UserResponseDTO | null> {
        const user = await findUserByEmail(email);
        return user ? mapUserToResponse(user as any) : null;
    }

    async updateUser(id: string, data: any): Promise<UserResponseDTO> {
        const user = await updateUser(id, data);
        return mapUserToResponse(user as any);
    }

    async deleteUser(id: string): Promise<void> {
        await deleteUser(id);
    }

    async listUsers(params: {
        skip?: number;
        take?: number;
        status?: string;
        search?: string;
    }): Promise<{ users: UserResponseDTO[]; total: number; skip: number; take: number }> {
        const { skip = 0, take = 10, status, search } = params;

        const where: any = {};
        if (status) {
            where.userStatus = status;
        }
        if (search) {
            where.OR = [
                { email: { contains: search, mode: 'insensitive' } },
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [usersRaw, total] = await Promise.all([
            listUsers({ skip, take, where }),
            countUsers(where),
        ]);

        const users = usersRaw.map((user) => mapUserToResponse(user as any));

        return {
            users,
            total,
            skip,
            take,
        };
    }
}

export const userService = new UserService();

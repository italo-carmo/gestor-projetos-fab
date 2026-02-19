import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
export declare class UsersController {
    private readonly users;
    constructor(users: UsersService);
    list(): Promise<{
        items: {
            id: string;
            specialtyId: string | null;
            eloRoleId: string | null;
            eloRole: {
                id: string;
                name: string;
                code: string;
            } | null;
            name: string;
            roles: {
                role: {
                    id: string;
                    name: string;
                };
            }[];
            email: string;
            ldapUid: string | null;
            localityId: string | null;
        }[];
    }>;
    update(id: string, dto: UpdateUserDto): Promise<{
        id: string;
        specialtyId: string | null;
        eloRoleId: string | null;
        eloRole: {
            id: string;
            name: string;
            code: string;
        } | null;
        name: string;
        roles: {
            role: {
                id: string;
                name: string;
            };
        }[];
        email: string;
        ldapUid: string | null;
        localityId: string | null;
    }>;
}

import { SmifComplaintStatus } from '@prisma/client';
export declare class ListSmifComplaintDto {
    q?: string;
    status?: SmifComplaintStatus;
    localityId?: string;
}

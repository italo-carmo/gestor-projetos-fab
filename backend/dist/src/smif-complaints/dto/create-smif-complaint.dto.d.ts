import { SmifComplaintStatus } from '@prisma/client';
export declare class CreateSmifComplaintDto {
    localityId: string;
    reportedAt: string;
    description: string;
    status?: SmifComplaintStatus;
    conclusion?: string;
}

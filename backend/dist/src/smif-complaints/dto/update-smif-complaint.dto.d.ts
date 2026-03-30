import { SmifComplaintStatus } from '@prisma/client';
export declare class UpdateSmifComplaintDto {
    localityId?: string;
    reportedAt?: string;
    description?: string;
    status?: SmifComplaintStatus;
    conclusion?: string;
}

import { IsOptional, IsString } from 'class-validator';

export class TaskMeetingDto {
  @IsOptional()
  @IsString()
  meetingId?: string | null;
}

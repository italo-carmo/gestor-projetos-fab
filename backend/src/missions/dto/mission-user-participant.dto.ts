import { IsString } from 'class-validator';

export class MissionUserParticipantDto {
  @IsString()
  userId: string;
}


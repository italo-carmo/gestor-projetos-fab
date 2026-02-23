import { IsString, MinLength } from 'class-validator';

export class MissionLdapParticipantDto {
  @IsString()
  @MinLength(3)
  identifier: string;
}

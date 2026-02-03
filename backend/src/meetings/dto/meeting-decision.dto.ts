import { IsString } from 'class-validator';

export class MeetingDecisionDto {
  @IsString()
  text: string;
}


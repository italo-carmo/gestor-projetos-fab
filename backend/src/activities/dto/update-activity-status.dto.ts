import { IsIn, IsString } from 'class-validator';

export class UpdateActivityStatusDto {
  @IsString()
  @IsIn(['NOT_STARTED', 'IN_PROGRESS', 'DONE', 'CANCELLED'])
  status: string;
}

import { IsOptional, IsString } from 'class-validator';

export class TaskEloRoleDto {
  @IsOptional()
  @IsString()
  eloRoleId?: string | null;
}

import { IsArray, IsString } from 'class-validator';

export class RolePermissionsDto {
  @IsArray()
  permissions: { resource: string; action: string; scope: string }[];
}

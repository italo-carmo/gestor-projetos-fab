import { IsArray, IsEnum, IsString } from 'class-validator';

export class UpdateChecklistStatusDto {
  @IsArray()
  updates: { checklistItemId: string; localityId: string; status: string }[];
}

import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateOnlineDocumentPresenceDto {
  @IsString()
  @MaxLength(120)
  sessionId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  color?: string | null;
}

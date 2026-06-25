import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCpcaEmailTemplateDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsString()
  @MaxLength(220)
  subject!: string;

  @IsString()
  @MaxLength(1_000_000)
  bodyHtml!: string;
}

export class UpdateCpcaEmailTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1_000_000)
  bodyHtml?: string;
}

export class SendCpcaEmailDto {
  @IsString()
  templateId!: string;

  @IsOptional()
  @IsBoolean()
  all?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipientOmIds?: string[];
}

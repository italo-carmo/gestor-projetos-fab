import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

export class CertificateQuestionDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  label: string;

  @IsIn(['TEXT', 'MULTIPLE_CHOICE', 'CHECKBOXES'])
  type: 'TEXT' | 'MULTIPLE_CHOICE' | 'CHECKBOXES';

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];
}

export class CreateCertificateTemplateDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsObject()
  layoutJson!: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCertificateTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsObject()
  layoutJson?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateCertificateEventDto {
  @IsString()
  name!: string;

  @IsString()
  location!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  eventDate!: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  eventTime!: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  certificateTemplateId?: string | null;
}

export class UpdateCertificateEventDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  eventDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  eventTime?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  certificateTemplateId?: string | null;
}

export class UpdateCertificateFormDto {
  @IsOptional()
  @IsString()
  formTitle?: string | null;

  @IsOptional()
  @IsString()
  formDescription?: string | null;

  @IsOptional()
  @IsBoolean()
  formIsPublished?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CertificateQuestionDto)
  questions?: CertificateQuestionDto[];
}

export class SubmitCertificateFormDto {
  @IsString()
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsObject()
  answers?: Record<string, unknown>;
}

export class SendCertificateEmailsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  responseIds?: string[];
}

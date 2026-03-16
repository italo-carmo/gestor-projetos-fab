import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum SocialCommunicationHighlightImpactDto {
  MULTIPLICADOR = 'MULTIPLICADOR',
  SIMBOLICO = 'SIMBOLICO',
}

export class CreateSocialCommunicationHighlightDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  ldapUid?: string;

  @IsEmail()
  @MaxLength(160)
  militaryEmail!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(180)
  militaryName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  fabom?: string;

  @IsEnum(SocialCommunicationHighlightImpactDto)
  impact!: SocialCommunicationHighlightImpactDto;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  localityId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text!: string;
}

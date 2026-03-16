import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SocialCommunicationHighlightImpactDto } from './create-social-communication-highlight.dto';

export class UpdateSocialCommunicationHighlightDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  ldapUid?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  militaryEmail?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  militaryName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  highlightRole?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  fabom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  photoMimeType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4_000_000)
  photoBase64?: string;

  @IsOptional()
  @IsEnum(SocialCommunicationHighlightImpactDto)
  impact?: SocialCommunicationHighlightImpactDto;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  localityId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text?: string;
}

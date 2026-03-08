import { IsArray, IsDateString, IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';
import { SocialCommunicationAudience } from './create-social-communication-article.dto';

export class UpdateSocialCommunicationArticleDto {
  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'url must be a valid URL' })
  url?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string | null;

  @IsOptional()
  @IsString()
  summary?: string | null;

  @IsOptional()
  @IsDateString()
  publishedAt?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(SocialCommunicationAudience)
  audience?: SocialCommunicationAudience;
}

import { IsDateString, IsOptional, IsString, IsUrl } from 'class-validator';

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
}

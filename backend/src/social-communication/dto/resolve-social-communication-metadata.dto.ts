import { IsUrl } from 'class-validator';

export class ResolveSocialCommunicationMetadataDto {
  @IsUrl({ require_protocol: true }, { message: 'url must be a valid URL' })
  url: string;
}

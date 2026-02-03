import { IsBoolean } from 'class-validator';

export class PinNoticeDto {
  @IsBoolean()
  pinned: boolean;
}


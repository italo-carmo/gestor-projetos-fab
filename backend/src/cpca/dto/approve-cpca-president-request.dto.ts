import { IsBoolean, IsOptional } from 'class-validator';

export class ApproveCpcaPresidentRequestDto {
  @IsOptional()
  @IsBoolean()
  proceedWithExistingPresident?: boolean;
}

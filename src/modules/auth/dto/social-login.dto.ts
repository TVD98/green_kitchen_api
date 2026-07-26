import { Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';
import { DeviceInfoDto } from './device-info.dto';

export class SocialLoginDto {
  @IsString()
  @IsIn(['google', 'facebook'])
  provider!: 'google' | 'facebook';

  @IsString()
  id_token!: string;

  @ValidateNested()
  @Type(() => DeviceInfoDto)
  device_info!: DeviceInfoDto;
}

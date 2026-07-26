import { IsNotEmpty, IsString } from 'class-validator';

export class DeviceInfoDto {
  @IsString()
  @IsNotEmpty()
  device_id!: string;

  @IsString()
  @IsNotEmpty()
  platform!: string;

  @IsString()
  @IsNotEmpty()
  os_version!: string;

  @IsString()
  @IsNotEmpty()
  app_version!: string;
}

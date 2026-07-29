import { Module } from '@nestjs/common';
import { UsersAllergiesService } from './users-allergies.service';
import { UsersController } from './users.controller';
import { UsersPreferencesService } from './users-preferences.service';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    UsersPreferencesService,
    UsersAllergiesService,
  ],
  exports: [
    UsersService,
    UsersPreferencesService,
    UsersAllergiesService,
  ],
})
export class UsersModule {}

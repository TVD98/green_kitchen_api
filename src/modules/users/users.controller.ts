import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUserContext } from '../auth/strategies/jwt.strategy';
import {
  UpdateUserAllergiesDto,
  UpdateUserPreferencesDto,
} from './dto/user-profile.dto';
import { UsersAllergiesService } from './users-allergies.service';
import { UsersPreferencesService } from './users-preferences.service';

@Controller('users/me')
export class UsersController {
  constructor(
    private readonly preferencesService: UsersPreferencesService,
    private readonly allergiesService: UsersAllergiesService,
  ) {}

  @Get('preferences')
  getPreferences(@CurrentUser() user: AuthUserContext) {
    return this.preferencesService.getPreferences(user.userId);
  }

  @Put('preferences')
  updatePreferences(
    @CurrentUser() user: AuthUserContext,
    @Body() dto: UpdateUserPreferencesDto,
  ) {
    return this.preferencesService.updatePreferences(user.userId, dto);
  }

  @Get('allergies')
  async getAllergies(
    @CurrentUser() user: AuthUserContext,
    @Query('lang') lang?: string,
  ) {
    const allergies = await this.allergiesService.getAllergies(
      user.userId,
      lang,
    );
    return { allergies };
  }

  @Put('allergies')
  async replaceAllergies(
    @CurrentUser() user: AuthUserContext,
    @Body() dto: UpdateUserAllergiesDto,
    @Query('lang') lang?: string,
  ) {
    const allergies = await this.allergiesService.replaceAllergies(
      user.userId,
      dto.ingredient_ids,
      lang,
    );
    return { allergies };
  }
}

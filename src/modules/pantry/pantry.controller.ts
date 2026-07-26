import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUserContext } from '../auth/strategies/jwt.strategy';
import { PantrySearchDto } from './dto/pantry-search.dto';
import { PantryService } from './pantry.service';

@Controller('pantry')
export class PantryController {
  constructor(private readonly pantryService: PantryService) {}

  @Post('search')
  @HttpCode(201)
  search(
    @Body() dto: PantrySearchDto,
    @CurrentUser() user: AuthUserContext,
  ) {
    return this.pantryService.search(dto, user.userId);
  }
}

import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUserContext } from '../auth/strategies/jwt.strategy';
import { DiscoveryService } from './discovery.service';
import { DiscoverySearchDto } from './dto/discovery-search.dto';

@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Post('search')
  @HttpCode(201)
  search(
    @Body() dto: DiscoverySearchDto,
    @CurrentUser() user: AuthUserContext,
  ) {
    return this.discoveryService.search(dto, user.userId);
  }
}

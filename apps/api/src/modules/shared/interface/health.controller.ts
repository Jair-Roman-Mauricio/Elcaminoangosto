import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Public } from '../decorators/roles.decorator'

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @Public()
  @ApiOperation({ summary: 'Health check (RNF-5)' })
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() }
  }
}

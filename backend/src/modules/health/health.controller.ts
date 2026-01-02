import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'scram-api',
    };
  }

  @Get('liveness')
  @ApiOperation({ summary: 'Liveness probe for Kubernetes/Docker' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  liveness() {
    return { status: 'alive' };
  }

  @Get('readiness')
  @ApiOperation({ summary: 'Readiness probe for Kubernetes/Docker' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  readiness() {
    return { status: 'ready' };
  }
}

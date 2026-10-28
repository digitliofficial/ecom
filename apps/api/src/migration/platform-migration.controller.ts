import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MigrationService } from './migration.service';
import { PlatformApiKeyGuard } from './platform-api-key.guard';
import type { CreateMigrationJobInput } from './types';

@Controller('platform/migration')
@UseGuards(PlatformApiKeyGuard)
export class PlatformMigrationController {
  constructor(private readonly migration: MigrationService) {}

  @Get('jobs')
  listJobs(@Query('tenantId') tenantId?: string) {
    return this.migration.listJobs(tenantId);
  }

  @Post('jobs')
  createJob(@Body() body: CreateMigrationJobInput) {
    return this.migration.createJob(body);
  }

  @Get('jobs/:id')
  getJob(@Param('id') id: string) {
    return this.migration.getJob(id);
  }

  @Post('jobs/:id/run')
  runJob(@Param('id') id: string) {
    return this.migration.runJob(id);
  }
}

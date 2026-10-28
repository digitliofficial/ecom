import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { StaffAuthGuard } from '../auth/staff-auth.guard';
import { TenantGuard, type TenantRequest } from '../tenancy/tenant.guard';
import { ReviewsService, type ReviewStatus } from './reviews.service';

@Controller('admin/reviews')
@UseGuards(TenantGuard, StaffAuthGuard)
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  list(
    @Req() req: TenantRequest,
    @Query('status') status?: ReviewStatus,
  ) {
    return this.reviews.listAdmin(req.tenantId!, status);
  }

  @Patch(':id')
  moderate(
    @Req() req: TenantRequest,
    @Param('id') id: string,
    @Body() body: { status?: ReviewStatus },
  ) {
    return this.reviews.moderate(req.tenantId!, id, body.status ?? 'pending');
  }
}

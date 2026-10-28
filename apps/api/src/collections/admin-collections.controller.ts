import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { StaffAuthGuard } from '../auth/staff-auth.guard';
import { TenantGuard, type TenantRequest } from '../tenancy/tenant.guard';
import {
  CollectionsService,
  type CollectionCreateInput,
  type CollectionUpdateInput,
} from './collections.service';

@Controller('admin/collections')
@UseGuards(TenantGuard, StaffAuthGuard)
export class AdminCollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Get()
  list(@Req() req: TenantRequest) {
    return this.collections.listAdmin(req.tenantId!);
  }

  @Get(':id')
  get(@Req() req: TenantRequest, @Param('id') id: string) {
    return this.collections.getAdmin(req.tenantId!, id);
  }

  @Post()
  create(@Req() req: TenantRequest, @Body() body: CollectionCreateInput) {
    return this.collections.create(req.tenantId!, body);
  }

  @Patch(':id')
  update(
    @Req() req: TenantRequest,
    @Param('id') id: string,
    @Body() body: CollectionUpdateInput,
  ) {
    return this.collections.update(req.tenantId!, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Req() req: TenantRequest, @Param('id') id: string) {
    await this.collections.remove(req.tenantId!, id);
  }
}

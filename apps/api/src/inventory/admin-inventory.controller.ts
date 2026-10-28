import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { StaffAuthGuard } from '../auth/staff-auth.guard';
import { TenantGuard, type TenantRequest } from '../tenancy/tenant.guard';
import {
  InventoryService,
  type LocationCreateInput,
  type LocationUpdateInput,
  type SetStockInput,
} from './inventory.service';

@Controller('admin/inventory')
@UseGuards(TenantGuard, StaffAuthGuard)
export class AdminInventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('locations')
  listLocations(@Req() req: TenantRequest) {
    return this.inventory.listLocations(req.tenantId!);
  }

  @Get('locations/:id')
  getLocation(@Req() req: TenantRequest, @Param('id') id: string) {
    return this.inventory.getLocation(req.tenantId!, id);
  }

  @Post('locations')
  createLocation(
    @Req() req: TenantRequest,
    @Body() body: LocationCreateInput,
  ) {
    return this.inventory.createLocation(req.tenantId!, body);
  }

  @Patch('locations/:id')
  updateLocation(
    @Req() req: TenantRequest,
    @Param('id') id: string,
    @Body() body: LocationUpdateInput,
  ) {
    return this.inventory.updateLocation(req.tenantId!, id, body);
  }

  @Get('levels')
  listLevels(@Req() req: TenantRequest) {
    return this.inventory.listLevels(req.tenantId!);
  }

  @Put('levels')
  setStock(@Req() req: TenantRequest, @Body() body: SetStockInput) {
    return this.inventory.setStock(req.tenantId!, body);
  }
}

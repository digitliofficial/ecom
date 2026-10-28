import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { StaffAuthGuard } from '../auth/staff-auth.guard';
import { TenantGuard, type TenantRequest } from '../tenancy/tenant.guard';
import { DomainsService } from './domains.service';

@Controller('admin/domains')
@UseGuards(TenantGuard, StaffAuthGuard)
export class AdminDomainsController {
  constructor(private readonly domains: DomainsService) {}

  @Get()
  getConfig(@Req() req: TenantRequest) {
    return this.domains.getConfig(req.tenantId!);
  }

  @Get('cname-instructions')
  cnameInstructions() {
    return this.domains.instructionsFor();
  }

  @Post()
  addDomain(
    @Req() req: TenantRequest,
    @Body() body: { host?: string; isPrimary?: boolean },
  ) {
    return this.domains.addDomain(req.tenantId!, body?.host ?? '', {
      isPrimary: body?.isPrimary,
    });
  }

  @Post(':id/verify')
  verify(@Req() req: TenantRequest, @Param('id') id: string) {
    return this.domains.verifyDomain(req.tenantId!, id);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Req() req: TenantRequest, @Param('id') id: string) {
    await this.domains.removeDomain(req.tenantId!, id);
  }
}

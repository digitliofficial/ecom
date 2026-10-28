import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { StaffAuthGuard } from '../auth/staff-auth.guard';
import { TenantGuard, type TenantRequest } from '../tenancy/tenant.guard';
import { MeteringService } from './metering.service';

@Controller('admin/billing')
@UseGuards(TenantGuard, StaffAuthGuard)
export class BillingController {
  constructor(private readonly metering: MeteringService) {}

  @Get('usage')
  usage(@Req() req: TenantRequest) {
    return this.metering.getSnapshot(req.tenantId!);
  }

  @Get('plans')
  plans() {
    return this.metering.listPlans();
  }

  @Post('change-plan')
  changePlan(
    @Req() req: TenantRequest,
    @Body() body: { planCode?: string },
  ) {
    return this.metering.changePlan(req.tenantId!, body.planCode ?? '');
  }

  @Post('stripe/checkout')
  stripeCheckout(
    @Req() req: TenantRequest,
    @Body()
    body: { planCode?: string; successUrl?: string; cancelUrl?: string },
  ) {
    return this.metering.createBillingCheckout(req.tenantId!, {
      planCode: body.planCode ?? '',
      successUrl: body.successUrl ?? '',
      cancelUrl: body.cancelUrl ?? '',
    });
  }

  @Post('stripe/portal')
  stripePortal(
    @Req() req: TenantRequest,
    @Body() body: { returnUrl?: string },
  ) {
    return this.metering.createBillingPortal(
      req.tenantId!,
      body.returnUrl ?? '',
    );
  }

  @Get('staff')
  listStaff(@Req() req: TenantRequest) {
    return this.metering.listStaff(req.tenantId!);
  }

  @Post('staff')
  inviteStaff(
    @Req() req: TenantRequest,
    @Body()
    body: {
      email?: string;
      password?: string;
      displayName?: string;
      role?: string;
    },
  ) {
    return this.metering.inviteStaff(req.tenantId!, {
      email: body.email ?? '',
      password: body.password ?? '',
      displayName: body.displayName,
      role: body.role,
    });
  }

  @Get('locales')
  listLocales(@Req() req: TenantRequest) {
    return this.metering.listLocales(req.tenantId!);
  }

  @Post('locales')
  enableLocale(
    @Req() req: TenantRequest,
    @Body() body: { locale?: string },
  ) {
    return this.metering.enableLocale(req.tenantId!, body.locale ?? '');
  }

  @Delete('locales/:locale')
  disableLocale(@Req() req: TenantRequest, @Param('locale') locale: string) {
    return this.metering.disableLocale(req.tenantId!, locale).then(() => ({
      ok: true,
    }));
  }
}

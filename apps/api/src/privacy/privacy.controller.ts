import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  CustomerAuthGuard,
  type CustomerRequest,
} from '../auth/customer-auth.guard';
import { AuthService } from '../auth/auth.service';
import { TenantGuard, type TenantRequest } from '../tenancy/tenant.guard';
import {
  PrivacyService,
  type DsarRequestType,
} from './privacy.service';

@Controller('privacy')
@UseGuards(TenantGuard)
export class PrivacyController {
  constructor(
    private readonly privacy: PrivacyService,
    private readonly auth: AuthService,
  ) {}

  /** Public storefront banner / policy config. */
  @Get('config')
  getConfig(@Req() req: TenantRequest) {
    return this.privacy.getStorefrontConfig(req.tenantId!);
  }

  /** Record a consent choice (guest or signed-in). */
  @Post('consent')
  recordConsent(
    @Req() req: TenantRequest,
    @Body()
    body: {
      subjectKey?: string;
      analytics?: boolean;
      marketing?: boolean;
      source?: string;
    },
  ) {
    const customer = this.auth.optionalCustomerClaims(req);
    return this.privacy.recordConsent(req.tenantId!, {
      subjectKey: body?.subjectKey ?? '',
      analytics: body?.analytics,
      marketing: body?.marketing,
      source: body?.source,
      customerId: customer?.sub ?? null,
    });
  }

  /** Guest DSAR: prove ownership with order access token from checkout. */
  @Post('dsar/guest')
  guestDsar(
    @Req() req: TenantRequest,
    @Body()
    body: {
      requestType?: DsarRequestType;
      email?: string;
      orderAccessToken?: string;
    },
  ) {
    return this.privacy.createGuestDsar(req.tenantId!, {
      requestType: body?.requestType as DsarRequestType,
      email: body?.email ?? '',
      orderAccessToken: body?.orderAccessToken ?? '',
    });
  }
}

@Controller('privacy/account/dsar')
@UseGuards(TenantGuard, CustomerAuthGuard)
export class CustomerDsarController {
  constructor(private readonly privacy: PrivacyService) {}

  @Get()
  list(@Req() req: CustomerRequest & TenantRequest) {
    return this.privacy.listCustomerDsar(req.tenantId!, req.customer!.sub);
  }

  @Get(':id')
  getOne(
    @Req() req: CustomerRequest & TenantRequest,
    @Param('id') id: string,
  ) {
    return this.privacy.getCustomerDsar(
      req.tenantId!,
      req.customer!.sub,
      id,
    );
  }

  @Post('export')
  export(@Req() req: CustomerRequest & TenantRequest) {
    return this.privacy.createCustomerExport(
      req.tenantId!,
      req.customer!.sub,
      req.customer!.email,
    );
  }

  @Post('delete')
  delete(
    @Req() req: CustomerRequest & TenantRequest,
    @Body() body: { password?: string },
  ) {
    return this.privacy.createCustomerDelete(
      req.tenantId!,
      req.customer!.sub,
      req.customer!.email,
      body?.password ?? '',
    );
  }
}

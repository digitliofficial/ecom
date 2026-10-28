import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { TenantGuard, type TenantRequest } from '../tenancy/tenant.guard';
import { LocalizationService } from '../localization/localization.service';
import { CartService } from './cart.service';
import {
  guestCartCookie,
  readGuestToken,
} from '../common/guest-token';

@Controller('carts')
@UseGuards(TenantGuard)
export class CartController {
  constructor(
    private readonly carts: CartService,
    private readonly localization: LocalizationService,
  ) {}

  @Post()
  async create(
    @Req() req: TenantRequest,
    @Res({ passthrough: true }) res: Response,
    @Body() body?: { locale?: string; currency?: string },
  ) {
    const prefs = await this.localization.resolveCartPrefs(req.tenantId!, {
      locale: body?.locale,
      currency: body?.currency,
    });
    const cart = await this.carts.createGuestCart(req.tenantId!, prefs);
    res.setHeader('Set-Cookie', guestCartCookie(cart.guestToken));
    return cart;
  }

  @Get('current')
  async current(@Req() req: TenantRequest) {
    const token = readGuestToken(req);
    if (!token) throw new NotFoundException('No guest cart token');
    const cart = await this.carts.getByGuestToken(req.tenantId!, token);
    if (!cart) throw new NotFoundException('Cart not found');
    return cart;
  }

  @Get(':id')
  async get(@Req() req: TenantRequest, @Param('id') id: string) {
    const cart = await this.carts.getById(req.tenantId!, id);
    if (!cart) throw new NotFoundException('Cart not found');
    this.assertTokenOwnsCart(req, cart.guestToken);
    return cart;
  }

  @Post('current/lines')
  async addLineCurrent(
    @Req() req: TenantRequest,
    @Body() body: { variantId?: string; quantity?: number },
  ) {
    const cart = await this.requireCurrentCart(req);
    return this.carts.addOrUpdateLine(req.tenantId!, cart.id, {
      variantId: this.requireVariantId(body),
      quantity: body.quantity ?? 1,
    });
  }

  @Post(':id/lines')
  async addLine(
    @Req() req: TenantRequest,
    @Param('id') id: string,
    @Body() body: { variantId?: string; quantity?: number },
  ) {
    const cart = await this.carts.getById(req.tenantId!, id);
    if (!cart) throw new NotFoundException('Cart not found');
    this.assertTokenOwnsCart(req, cart.guestToken);
    return this.carts.addOrUpdateLine(req.tenantId!, id, {
      variantId: this.requireVariantId(body),
      quantity: body.quantity ?? 1,
    });
  }

  @Patch('current/lines/:lineId')
  async updateLineCurrent(
    @Req() req: TenantRequest,
    @Param('lineId') lineId: string,
    @Body() body: { quantity?: number },
  ) {
    const cart = await this.requireCurrentCart(req);
    if (body.quantity == null) {
      throw new BadRequestException('quantity is required');
    }
    return this.carts.updateLine(req.tenantId!, cart.id, lineId, body.quantity);
  }

  @Patch(':id/lines/:lineId')
  async updateLine(
    @Req() req: TenantRequest,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() body: { quantity?: number },
  ) {
    const cart = await this.carts.getById(req.tenantId!, id);
    if (!cart) throw new NotFoundException('Cart not found');
    this.assertTokenOwnsCart(req, cart.guestToken);
    if (body.quantity == null) {
      throw new BadRequestException('quantity is required');
    }
    return this.carts.updateLine(req.tenantId!, id, lineId, body.quantity);
  }

  @Delete('current/lines/:lineId')
  async removeLineCurrent(
    @Req() req: TenantRequest,
    @Param('lineId') lineId: string,
  ) {
    const cart = await this.requireCurrentCart(req);
    return this.carts.removeLine(req.tenantId!, cart.id, lineId);
  }

  @Delete(':id/lines/:lineId')
  async removeLine(
    @Req() req: TenantRequest,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
  ) {
    const cart = await this.carts.getById(req.tenantId!, id);
    if (!cart) throw new NotFoundException('Cart not found');
    this.assertTokenOwnsCart(req, cart.guestToken);
    return this.carts.removeLine(req.tenantId!, id, lineId);
  }

  private async requireCurrentCart(req: TenantRequest) {
    const token = readGuestToken(req);
    if (!token) throw new NotFoundException('No guest cart token');
    const cart = await this.carts.getByGuestToken(req.tenantId!, token);
    if (!cart) throw new NotFoundException('Cart not found');
    return cart;
  }

  private assertTokenOwnsCart(req: TenantRequest, guestToken: string) {
    const token = readGuestToken(req);
    if (!token || token !== guestToken) {
      throw new NotFoundException('Cart not found');
    }
  }

  private requireVariantId(body: { variantId?: string }): string {
    if (!body.variantId) {
      throw new BadRequestException('variantId is required');
    }
    return body.variantId;
  }
}

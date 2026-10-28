import { Injectable } from '@nestjs/common';
import {
  createComputeClient,
  type AddressValidateRequest,
  type AddressValidateResponse,
  type CreateShipmentRequest,
  type LabelResult,
  type ShippingRatesRequest,
  type ShippingRate,
} from '@ecom/sdk-compute';

@Injectable()
export class ComputeClientService {
  private readonly client = createComputeClient({
    baseUrl: process.env.COMPUTE_URL ?? 'http://localhost:8000',
  });

  async validateAddress(
    body: AddressValidateRequest,
  ): Promise<AddressValidateResponse> {
    try {
      return await this.client.validateAddress(body);
    } catch {
      // Soft-warn fail-open on provider/outage
      return {
        valid: true,
        warnings: ['address_provider_unavailable'],
        normalized: body,
      };
    }
  }

  async shippingRates(
    body: ShippingRatesRequest,
  ): Promise<{ rates: ShippingRate[] }> {
    return this.client.shippingRates(body);
  }

  async createShipment(body: CreateShipmentRequest): Promise<LabelResult> {
    return this.client.createShipment(body);
  }
}

import { Injectable } from '@nestjs/common';
import {
  createComputeClient,
  type AddressValidateRequest,
  type AddressValidateResponse,
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
}

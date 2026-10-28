import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../db/database.service';

export type BankDetails = {
  accountName: string;
  accountNumber: string;
  bankName: string;
};

export type TenantPaymentSettings = {
  codEnabled: boolean;
  bankTransferEnabled: boolean;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
  stripeEnabled: boolean;
  updatedAt: string;
};

export type PaymentSettingsUpdate = {
  codEnabled?: boolean;
  bankTransferEnabled?: boolean;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  bankName?: string | null;
  stripeEnabled?: boolean;
};

export type StorefrontPaymentMethod =
  | { id: 'cod'; label: string }
  | {
      id: 'bank_transfer';
      label: string;
      bankDetails: BankDetails;
    };

type SettingsRow = {
  tenant_id: string;
  cod_enabled: boolean;
  bank_transfer_enabled: boolean;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_name: string | null;
  stripe_enabled: boolean;
  updated_at: Date | string;
};

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function trimOrNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const t = value.trim();
  return t.length ? t : null;
}

@Injectable()
export class PaymentsService {
  constructor(private readonly db: DatabaseService) {}

  async getSettings(tenantId: string): Promise<TenantPaymentSettings> {
    return this.db.withTenant(tenantId, async (client) => {
      const row = await this.loadOrCreate(client, tenantId);
      return this.toDto(row);
    });
  }

  async updateSettings(
    tenantId: string,
    input: PaymentSettingsUpdate,
  ): Promise<TenantPaymentSettings> {
    return this.db.withTenant(tenantId, async (client) => {
      const current = await this.loadOrCreate(client, tenantId);

      const next = {
        codEnabled:
          input.codEnabled !== undefined
            ? Boolean(input.codEnabled)
            : current.cod_enabled,
        bankTransferEnabled:
          input.bankTransferEnabled !== undefined
            ? Boolean(input.bankTransferEnabled)
            : current.bank_transfer_enabled,
        bankAccountName:
          input.bankAccountName !== undefined
            ? trimOrNull(input.bankAccountName)
            : current.bank_account_name,
        bankAccountNumber:
          input.bankAccountNumber !== undefined
            ? trimOrNull(input.bankAccountNumber)
            : current.bank_account_number,
        bankName:
          input.bankName !== undefined
            ? trimOrNull(input.bankName)
            : current.bank_name,
        stripeEnabled:
          input.stripeEnabled !== undefined
            ? Boolean(input.stripeEnabled)
            : current.stripe_enabled,
      };

      if (next.bankTransferEnabled) {
        if (
          !next.bankAccountName ||
          !next.bankAccountNumber ||
          !next.bankName
        ) {
          throw new BadRequestException(
            'bank transfer requires bankAccountName, bankAccountNumber (IBAN/account #), and bankName',
          );
        }
      }

      const res = await client.query<SettingsRow>(
        `UPDATE tenant_payment_settings
         SET cod_enabled = $2,
             bank_transfer_enabled = $3,
             bank_account_name = $4,
             bank_account_number = $5,
             bank_name = $6,
             stripe_enabled = $7,
             updated_at = now()
         WHERE tenant_id = $1
         RETURNING *`,
        [
          tenantId,
          next.codEnabled,
          next.bankTransferEnabled,
          next.bankAccountName,
          next.bankAccountNumber,
          next.bankName,
          next.stripeEnabled,
        ],
      );

      const row = res.rows[0];
      if (!row) throw new NotFoundException('Payment settings not found');
      return this.toDto(row);
    });
  }

  async listStorefrontMethods(
    tenantId: string,
  ): Promise<StorefrontPaymentMethod[]> {
    const settings = await this.getSettings(tenantId);
    const methods: StorefrontPaymentMethod[] = [];

    if (settings.codEnabled) {
      methods.push({ id: 'cod', label: 'Cash on delivery' });
    }

    if (settings.bankTransferEnabled) {
      const details = this.bankDetailsFromSettings(settings);
      if (details) {
        methods.push({
          id: 'bank_transfer',
          label: 'Bank transfer',
          bankDetails: details,
        });
      }
    }

    return methods;
  }

  async assertMethodEnabled(
    tenantId: string,
    method: 'cod' | 'bank_transfer',
  ): Promise<{ settings: TenantPaymentSettings; bankDetails: BankDetails | null }> {
    const settings = await this.getSettings(tenantId);

    if (method === 'cod') {
      if (!settings.codEnabled) {
        throw new BadRequestException('Cash on delivery is not enabled');
      }
      return { settings, bankDetails: null };
    }

    if (!settings.bankTransferEnabled) {
      throw new BadRequestException('Bank transfer is not enabled');
    }
    const bankDetails = this.bankDetailsFromSettings(settings);
    if (!bankDetails) {
      throw new BadRequestException(
        'Bank transfer is enabled but bank details are incomplete',
      );
    }
    return { settings, bankDetails };
  }

  bankDetailsFromSettings(
    settings: TenantPaymentSettings,
  ): BankDetails | null {
    if (
      !settings.bankAccountName ||
      !settings.bankAccountNumber ||
      !settings.bankName
    ) {
      return null;
    }
    return {
      accountName: settings.bankAccountName,
      accountNumber: settings.bankAccountNumber,
      bankName: settings.bankName,
    };
  }

  private async loadOrCreate(
    client: { query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }> },
    tenantId: string,
  ): Promise<SettingsRow> {
    const existing = await client.query<SettingsRow>(
      `SELECT * FROM tenant_payment_settings WHERE tenant_id = $1`,
      [tenantId],
    );
    if (existing.rows[0]) return existing.rows[0];

    const inserted = await client.query<SettingsRow>(
      `INSERT INTO tenant_payment_settings (tenant_id)
       VALUES ($1)
       ON CONFLICT (tenant_id) DO UPDATE SET updated_at = tenant_payment_settings.updated_at
       RETURNING *`,
      [tenantId],
    );
    const row = inserted.rows[0];
    if (!row) throw new NotFoundException('Could not create payment settings');
    return row;
  }

  private toDto(row: SettingsRow): TenantPaymentSettings {
    return {
      codEnabled: row.cod_enabled,
      bankTransferEnabled: row.bank_transfer_enabled,
      bankAccountName: row.bank_account_name,
      bankAccountNumber: row.bank_account_number,
      bankName: row.bank_name,
      stripeEnabled: row.stripe_enabled,
      updatedAt: asIso(row.updated_at),
    };
  }
}

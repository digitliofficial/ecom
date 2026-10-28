/** EmailProvider port — console MVP; optional Resend via env */

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
  tags?: Record<string, string>;
};

export type SendEmailResult = {
  id: string;
  provider: string;
  status: 'sent' | 'failed';
  error?: string;
};

export interface EmailProvider {
  readonly name: string;
  send(input: SendEmailInput): Promise<SendEmailResult>;
}

function messageId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Local MVP — prints a clear block to stdout (Nest / worker logs) */
export class ConsoleEmailAdapter implements EmailProvider {
  readonly name = 'console';

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const id = messageId('console');
    const from = input.from ?? process.env.EMAIL_FROM ?? 'noreply@localhost';
    const lines = [
      '',
      '========== EMAIL (console provider) ==========',
      `id:      ${id}`,
      `from:    ${from}`,
      `to:      ${input.to}`,
      `subject: ${input.subject}`,
      '-------- body --------',
      input.text,
      '=============================================',
      '',
    ];
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    return { id, provider: this.name, status: 'sent' };
  }
}

/** Optional Resend adapter — used when RESEND_API_KEY is set */
export class ResendEmailAdapter implements EmailProvider {
  readonly name = 'resend';

  constructor(
    private readonly apiKey: string,
    private readonly defaultFrom: string,
  ) {}

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const from = input.from ?? this.defaultFrom;
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [input.to],
          subject: input.subject,
          text: input.text,
          ...(input.html ? { html: input.html } : {}),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        id?: string;
        message?: string;
        name?: string;
      };
      if (!res.ok) {
        return {
          id: messageId('resend_err'),
          provider: this.name,
          status: 'failed',
          error: body.message ?? body.name ?? `HTTP ${res.status}`,
        };
      }
      return {
        id: body.id ?? messageId('resend'),
        provider: this.name,
        status: 'sent',
      };
    } catch (err) {
      return {
        id: messageId('resend_err'),
        provider: this.name,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

export type EmailProviderMode = 'console' | 'resend';

type EnvMap = Record<string, string | undefined>;

/** Resolve EmailProvider: console by default; Resend when RESEND_API_KEY is set (or EMAIL_PROVIDER=resend). */
export function createEmailProvider(env: EnvMap = process.env): EmailProvider {
  const mode = (env.EMAIL_PROVIDER ?? '').trim().toLowerCase() as EmailProviderMode | '';
  const key = (env.RESEND_API_KEY ?? '').trim();
  const from =
    (env.EMAIL_FROM ?? '').trim() || 'Ecom <onboarding@resend.dev>';

  if (mode === 'console') {
    return new ConsoleEmailAdapter();
  }
  if (mode === 'resend' || key) {
    if (!key) {
      // eslint-disable-next-line no-console
      console.warn(
        '[email] EMAIL_PROVIDER=resend but RESEND_API_KEY is empty; falling back to console',
      );
      return new ConsoleEmailAdapter();
    }
    return new ResendEmailAdapter(key, from);
  }
  return new ConsoleEmailAdapter();
}

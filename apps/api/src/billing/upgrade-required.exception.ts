import { HttpException, HttpStatus } from '@nestjs/common';

export type UpgradeRequiredBody = {
  statusCode: number;
  code: 'upgrade_required';
  message: string;
  metric: string;
  limit: number;
  usage: number;
  planCode: string;
  suggestedPlanCode: string | null;
};

/** Hard plan cap — HTTP 402 with upgrade_required payload for admin CTAs. */
export class UpgradeRequiredException extends HttpException {
  constructor(input: {
    metric: string;
    limit: number;
    usage: number;
    planCode: string;
    suggestedPlanCode?: string | null;
    message?: string;
  }) {
    const body: UpgradeRequiredBody = {
      statusCode: HttpStatus.PAYMENT_REQUIRED,
      code: 'upgrade_required',
      message:
        input.message ??
        `Plan limit reached for ${input.metric} (${input.usage}/${input.limit}). Upgrade to continue.`,
      metric: input.metric,
      limit: input.limit,
      usage: input.usage,
      planCode: input.planCode,
      suggestedPlanCode: input.suggestedPlanCode ?? null,
    };
    super(body, HttpStatus.PAYMENT_REQUIRED);
  }
}

/** Locale-aware transactional/marketing template stubs */

export type EmailTemplateId =
  | 'order_placed'
  | 'fulfillment_shipped'
  | 'abandoned_cart_step'
  | 'dsar_confirmation';

export type EmailTemplate = {
  id: EmailTemplateId;
  locale: string;
  subject: string;
  bodyText: string;
};

export const sampleTemplates: EmailTemplate[] = [
  {
    id: 'order_placed',
    locale: 'en',
    subject: 'Your order is confirmed',
    bodyText: 'Thanks for your order. We will email when it ships.',
  },
];

export function getTemplate(
  id: EmailTemplateId,
  locale: string,
): EmailTemplate | undefined {
  return sampleTemplates.find((t) => t.id === id && t.locale === locale);
}

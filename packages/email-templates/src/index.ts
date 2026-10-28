/** Locale-aware transactional/marketing template stubs */

export type EmailTemplateId =
  | 'order_placed'
  | 'order_placed_merchant'
  | 'order_shipped'
  | 'order_cancelled'
  | 'fulfillment_shipped'
  | 'abandoned_cart_step'
  | 'dsar_confirmation';

export type EmailTemplateVars = Record<string, string | number | undefined | null>;

export type RenderedEmail = {
  id: EmailTemplateId;
  locale: string;
  subject: string;
  bodyText: string;
};

type TemplateDef = {
  id: EmailTemplateId;
  locale: string;
  subject: string;
  bodyText: string;
};

const templates: TemplateDef[] = [
  {
    id: 'order_placed',
    locale: 'en',
    subject: 'Order {{orderId}} confirmed',
    bodyText:
      'Thanks for your order {{orderId}}.\nTotal: {{total}} {{currency}}.\nWe will email when it ships.\n',
  },
  {
    id: 'order_placed_merchant',
    locale: 'en',
    subject: 'New order {{orderId}}',
    bodyText:
      'New order {{orderId}} from {{customerEmail}}.\nTotal: {{total}} {{currency}}.\nPayment: {{paymentMethod}} ({{paymentStatus}}).\n',
  },
  {
    id: 'order_shipped',
    locale: 'en',
    subject: 'Order {{orderId}} is on the way',
    bodyText:
      'Good news — order {{orderId}} has been {{statusLabel}}.\nTotal: {{total}} {{currency}}.\n',
  },
  {
    id: 'order_cancelled',
    locale: 'en',
    subject: 'Order {{orderId}} cancelled',
    bodyText:
      'Order {{orderId}} was cancelled.\nIf you did not request this, contact the store.\n',
  },
  {
    id: 'fulfillment_shipped',
    locale: 'en',
    subject: 'A shipment from your order is on the way',
    bodyText:
      'Part of your order {{orderId}} has shipped. Tracking: {{trackingNumber}}.\n',
  },
  {
    id: 'abandoned_cart_step',
    locale: 'en',
    subject: 'You left something in your cart',
    bodyText:
      'Hi — you still have items waiting in your cart.\nResume checkout: {{resumeUrl}}\nUnsubscribe: {{unsubscribeUrl}}\n',
  },
  {
    id: 'dsar_confirmation',
    locale: 'en',
    subject: 'Privacy request received',
    bodyText: 'We received your privacy request and will follow up shortly.\n',
  },
];

/** @deprecated use renderTemplate — kept for existing imports */
export type EmailTemplate = {
  id: EmailTemplateId;
  locale: string;
  subject: string;
  bodyText: string;
};

export const sampleTemplates: EmailTemplate[] = templates;

function applyVars(text: string, vars: EmailTemplateVars): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = vars[key];
    if (value === undefined || value === null) return '';
    return String(value);
  });
}

export function getTemplate(
  id: EmailTemplateId,
  locale: string,
): EmailTemplate | undefined {
  return (
    templates.find((t) => t.id === id && t.locale === locale) ??
    templates.find((t) => t.id === id && t.locale === 'en')
  );
}

export function renderTemplate(
  id: EmailTemplateId,
  locale: string,
  vars: EmailTemplateVars = {},
): RenderedEmail {
  const tpl = getTemplate(id, locale);
  if (!tpl) {
    return {
      id,
      locale,
      subject: id,
      bodyText: JSON.stringify(vars, null, 2),
    };
  }
  return {
    id,
    locale: tpl.locale,
    subject: applyVars(tpl.subject, vars),
    bodyText: applyVars(tpl.bodyText, vars),
  };
}

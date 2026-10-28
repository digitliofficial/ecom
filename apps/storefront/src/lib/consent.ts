'use client';

import type { ConsentCategories } from '@ecom/sdk-api';

const CONSENT_KEY = 'ecom_consent';
const SUBJECT_KEY = 'ecom_consent_subject';

export type StoredConsent = {
  categories: ConsentCategories;
  decidedAt: string;
  eventId?: string;
};

export function readConsentSubjectKey(): string {
  if (typeof window === 'undefined') return '';
  let key = localStorage.getItem(SUBJECT_KEY);
  if (!key) {
    key =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID().replace(/-/g, '')
        : `subj${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(SUBJECT_KEY, key);
  }
  return key;
}

export function readStoredConsent(): StoredConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredConsent;
  } catch {
    return null;
  }
}

export function writeStoredConsent(value: StoredConsent) {
  localStorage.setItem(CONSENT_KEY, JSON.stringify(value));
}

export function clearStoredConsent() {
  localStorage.removeItem(CONSENT_KEY);
}

/** Gate analytics/marketing scripts — necessary always allowed. */
export function hasConsent(category: 'analytics' | 'marketing'): boolean {
  const stored = readStoredConsent();
  if (!stored) return false;
  return Boolean(stored.categories[category]);
}

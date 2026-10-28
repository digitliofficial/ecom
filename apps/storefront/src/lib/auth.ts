'use client';

import type { AuthUser } from '@ecom/sdk-api';
import { createApiClient } from '@ecom/sdk-api';
import { getApiBaseUrl, getTenantHost, readCartToken } from './api';
import {
  clearCustomerBearer,
  readCustomerBearer,
  setCustomerBearer,
} from './customer-session';

function authClient() {
  return createApiClient({
    baseUrl: getApiBaseUrl(),
    getHost: getTenantHost,
    getCartToken: readCartToken,
    getToken: () => readCustomerBearer(),
    credentials: 'include',
  });
}

export async function customerRegister(input: {
  email: string;
  password: string;
  displayName?: string;
}): Promise<AuthUser> {
  const result = await authClient().customerRegister(input);
  setCustomerBearer(result.token);
  return result.user;
}

export async function customerLogin(input: {
  email: string;
  password: string;
}): Promise<AuthUser> {
  const result = await authClient().customerLogin(input);
  setCustomerBearer(result.token);
  return result.user;
}

export async function customerLogout(): Promise<void> {
  try {
    await authClient().customerLogout();
  } finally {
    clearCustomerBearer();
  }
}

export async function fetchCustomerMe(): Promise<AuthUser | null> {
  try {
    return await authClient().me();
  } catch {
    clearCustomerBearer();
    return null;
  }
}

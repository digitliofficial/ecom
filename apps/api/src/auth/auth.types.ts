export type StaffRole = 'owner' | 'staff';

export type AuthKind = 'staff' | 'customer';

export type JwtClaims = {
  sub: string;
  email: string;
  tenantId: string;
  kind: AuthKind;
  role: StaffRole | 'customer';
};

export type AuthUserView = {
  id: string;
  email: string;
  displayName: string | null;
  tenantId: string;
  kind: AuthKind;
  role: StaffRole | 'customer';
};

export const STAFF_SESSION_COOKIE = 'ecom_staff_session';
export const CUSTOMER_SESSION_COOKIE = 'ecom_customer_session';

export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

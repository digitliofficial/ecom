import Link from 'next/link';
import { t } from '@ecom/i18n-messages';

export default function AdminHome() {
  return (
    <div style={{ padding: '2rem', maxWidth: 800 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 style={{ fontWeight: 600, letterSpacing: '-0.02em' }}>ecom admin</h1>
        <nav style={{ display: 'flex', gap: '1rem', fontSize: '0.95rem' }}>
          <Link href="/login">{t('en', 'admin.login')}</Link>
          <Link href="/localization">Localization</Link>
        </nav>
      </header>
      <p style={{ marginTop: '1.5rem', maxWidth: 480 }}>
        Merchant admin shell — login stub, tenant switcher stub, Localization settings shell.
      </p>
      <div style={{ marginTop: '2rem', padding: '1rem 0', borderTop: '1px solid #cfc8bc' }}>
        <label style={{ display: 'grid', gap: '0.4rem', maxWidth: 280 }}>
          <span style={{ fontSize: '0.85rem', opacity: 0.75 }}>Tenant switcher (stub)</span>
          <select defaultValue="demo" style={{ padding: '0.5rem' }}>
            <option value="demo">demo</option>
          </select>
        </label>
      </div>
    </div>
  );
}

import { t } from '@ecom/i18n-messages';

export default function LoginPage() {
  return (
    <div style={{ padding: '3rem 2rem', maxWidth: 400 }}>
      <h1>{t('en', 'admin.login')}</h1>
      <form style={{ display: 'grid', gap: '0.75rem', marginTop: '1.5rem' }}>
        <input type="email" placeholder="staff@merchant.com" style={{ padding: '0.6rem' }} />
        <input type="password" placeholder="Password" style={{ padding: '0.6rem' }} />
        <button type="button" style={{ padding: '0.65rem', cursor: 'pointer' }}>
          Continue (stub)
        </button>
      </form>
    </div>
  );
}

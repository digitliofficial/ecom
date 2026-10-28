import { t } from '@ecom/i18n-messages';
import { LoginForm } from '../../components/LoginForm';

export default function LoginPage() {
  return (
    <div style={{ padding: '3rem 2rem', maxWidth: 400 }}>
      <h1>{t('en', 'admin.login')}</h1>
      <p style={{ marginTop: '0.5rem', opacity: 0.75, fontSize: '0.95rem' }}>
        Merchant admin — email/password session (httpOnly JWT cookie).
      </p>
      <LoginForm />
    </div>
  );
}

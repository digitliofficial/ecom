export default function LocalizationPage() {
  return (
    <div style={{ padding: '2rem', maxWidth: 640 }}>
      <h1>Localization</h1>
      <p>Settings shell — default locale/currency, multi-lang / multi-currency toggles (Phase 1).</p>
      <ul>
        <li>Default locale: en</li>
        <li>Default currency: USD (charge)</li>
        <li>Multi-language: off</li>
        <li>Multi-currency (display): off</li>
      </ul>
    </div>
  );
}

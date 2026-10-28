'use client';

import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import type {
  Menu,
  MenuHandle,
  Policy,
  PolicyKind,
  SeoSettings,
  ThemeSettings,
  ThemeTokens,
} from '@ecom/sdk-api';
import {
  getAdminMenu,
  getAdminSeo,
  getAdminTheme,
  listAdminPolicies,
  listThemePacks,
  replaceAdminMenu,
  updateAdminPolicy,
  updateAdminSeo,
  updateAdminTheme,
} from '../lib/api';

const field: CSSProperties = {
  padding: '0.55rem 0.65rem',
  borderRadius: 4,
  border: '1px solid #a8a29e',
  background: '#fff',
  color: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
};

const section: CSSProperties = {
  margin: 0,
  padding: '0.85rem 1rem',
  border: '1px solid #cfc8bc',
  borderRadius: 4,
  display: 'grid',
  gap: '0.65rem',
};

type DraftItem = { label: string; href: string };

function menuToDraft(menu: Menu): { title: string; items: DraftItem[] } {
  return {
    title: menu.title,
    items: menu.items.map((i) => ({ label: i.label, href: i.href })),
  };
}

export function CmsSettingsForm() {
  const [packs, setPacks] = useState<ThemeTokens[]>([]);
  const [theme, setTheme] = useState<ThemeSettings | null>(null);
  const [seo, setSeo] = useState<SeoSettings | null>(null);
  const [header, setHeader] = useState<{ title: string; items: DraftItem[] } | null>(
    null,
  );
  const [footer, setFooter] = useState<{ title: string; items: DraftItem[] } | null>(
    null,
  );
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [activePolicy, setActivePolicy] = useState<PolicyKind>('privacy');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listThemePacks(),
      getAdminTheme(),
      getAdminSeo('en'),
      getAdminMenu('header'),
      getAdminMenu('footer'),
      listAdminPolicies('en'),
    ])
      .then(([packList, themeData, seoData, headerMenu, footerMenu, policyList]) => {
        if (cancelled) return;
        setPacks(packList);
        setTheme(themeData);
        setSeo(seoData);
        setHeader(menuToDraft(headerMenu));
        setFooter(menuToDraft(footerMenu));
        setPolicies(policyList);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveTheme(e: FormEvent) {
    e.preventDefault();
    if (!theme) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const updated = await updateAdminTheme({
        themePackId: theme.themePackId,
        tokenOverrides: theme.tokenOverrides,
      });
      setTheme(updated);
      setSaved('Theme saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Theme save failed');
    } finally {
      setBusy(false);
    }
  }

  async function saveSeo(e: FormEvent) {
    e.preventDefault();
    if (!seo) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const updated = await updateAdminSeo({
        locale: seo.locale,
        siteTitle: seo.siteTitle,
        metaDescription: seo.metaDescription,
        ogImageUrl: seo.ogImageUrl,
      });
      setSeo(updated);
      setSaved('SEO settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SEO save failed');
    } finally {
      setBusy(false);
    }
  }

  async function saveMenu(handle: MenuHandle, draft: { title: string; items: DraftItem[] }) {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const updated = await replaceAdminMenu(handle, {
        title: draft.title,
        items: draft.items.map((item, index) => ({
          label: item.label,
          href: item.href,
          position: index,
        })),
      });
      const next = menuToDraft(updated);
      if (handle === 'header') setHeader(next);
      else setFooter(next);
      setSaved(`${handle} menu saved.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Menu save failed');
    } finally {
      setBusy(false);
    }
  }

  async function savePolicy(e: FormEvent) {
    e.preventDefault();
    const current = policies.find((p) => p.kind === activePolicy);
    if (!current) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const updated = await updateAdminPolicy(current.kind, {
        locale: current.locale,
        title: current.title,
        body: current.body,
      });
      setPolicies((prev) =>
        prev.map((p) => (p.kind === updated.kind ? updated : p)),
      );
      setSaved(`${updated.kind} policy saved.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Policy save failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p style={{ marginTop: '1.5rem', opacity: 0.75 }}>Loading CMS…</p>;
  }

  if (!theme || !seo || !header || !footer) {
    return (
      <p style={{ marginTop: '1.5rem', color: '#9a3412' }} role="alert">
        Could not load CMS settings ({error ?? 'unknown'}). Is the API on :3001
        with schema applied (`pnpm db:apply`)?
      </p>
    );
  }

  const active = policies.find((p) => p.kind === activePolicy);

  return (
    <div style={{ display: 'grid', gap: '1.75rem', marginTop: '1.25rem' }}>
      {error && (
        <p style={{ color: '#9a3412', margin: 0 }} role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p style={{ color: '#166534', margin: 0 }}>{saved}</p>
      )}

      <form onSubmit={saveTheme} style={{ display: 'grid', gap: '0.85rem', maxWidth: 520 }}>
        <h3 style={{ margin: 0 }}>Theme pack</h3>
        <fieldset style={section}>
          <legend>Select pack</legend>
          <label style={{ display: 'grid', gap: '0.3rem' }}>
            <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>Theme pack</span>
            <select
              value={theme.themePackId}
              onChange={(e) =>
                setTheme({ ...theme, themePackId: e.target.value })
              }
              style={field}
            >
              {packs.map((pack) => (
                <option key={pack.id} value={pack.id}>
                  {pack.name} — {pack.description}
                </option>
              ))}
            </select>
          </label>
          <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.75 }}>
            Preview accent:{' '}
            <span style={{ color: theme.resolved.colors.accent }}>
              {theme.resolved.colors.accent}
            </span>
          </p>
        </fieldset>
        <button type="submit" disabled={busy} style={buttonStyle(busy)}>
          {busy ? 'Saving…' : 'Save theme'}
        </button>
      </form>

      <form onSubmit={saveSeo} style={{ display: 'grid', gap: '0.85rem', maxWidth: 520 }}>
        <h3 style={{ margin: 0 }}>SEO defaults</h3>
        <fieldset style={section}>
          <legend>Locale: {seo.locale}</legend>
          <label style={{ display: 'grid', gap: '0.3rem' }}>
            <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>Site title</span>
            <input
              value={seo.siteTitle}
              onChange={(e) => setSeo({ ...seo, siteTitle: e.target.value })}
              style={field}
              required
            />
          </label>
          <label style={{ display: 'grid', gap: '0.3rem' }}>
            <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>
              Meta description
            </span>
            <textarea
              value={seo.metaDescription}
              onChange={(e) =>
                setSeo({ ...seo, metaDescription: e.target.value })
              }
              rows={3}
              style={{ ...field, resize: 'vertical' }}
            />
          </label>
          <label style={{ display: 'grid', gap: '0.3rem' }}>
            <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>
              OG image URL (optional)
            </span>
            <input
              value={seo.ogImageUrl ?? ''}
              onChange={(e) =>
                setSeo({ ...seo, ogImageUrl: e.target.value || null })
              }
              placeholder="https://…"
              style={field}
            />
          </label>
        </fieldset>
        <button type="submit" disabled={busy} style={buttonStyle(busy)}>
          {busy ? 'Saving…' : 'Save SEO'}
        </button>
      </form>

      <MenuEditor
        title="Header menu"
        draft={header}
        onChange={setHeader}
        busy={busy}
        onSave={() => void saveMenu('header', header)}
      />
      <MenuEditor
        title="Footer menu"
        draft={footer}
        onChange={setFooter}
        busy={busy}
        onSave={() => void saveMenu('footer', footer)}
      />

      <form onSubmit={savePolicy} style={{ display: 'grid', gap: '0.85rem', maxWidth: 640 }}>
        <h3 style={{ margin: 0 }}>Policy pages</h3>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {policies.map((p) => (
            <button
              key={p.kind}
              type="button"
              onClick={() => setActivePolicy(p.kind)}
              style={{
                padding: '0.35rem 0.65rem',
                borderRadius: 4,
                border: '1px solid #a8a29e',
                background: p.kind === activePolicy ? '#1c1917' : 'transparent',
                color: p.kind === activePolicy ? '#fafaf9' : 'inherit',
                cursor: 'pointer',
              }}
            >
              {p.kind}
            </button>
          ))}
        </div>
        {active && (
          <fieldset style={section}>
            <legend>{active.kind}</legend>
            <label style={{ display: 'grid', gap: '0.3rem' }}>
              <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>Title</span>
              <input
                value={active.title}
                onChange={(e) =>
                  setPolicies((prev) =>
                    prev.map((p) =>
                      p.kind === active.kind
                        ? { ...p, title: e.target.value }
                        : p,
                    ),
                  )
                }
                style={field}
                required
              />
            </label>
            <label style={{ display: 'grid', gap: '0.3rem' }}>
              <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>Body</span>
              <textarea
                value={active.body}
                onChange={(e) =>
                  setPolicies((prev) =>
                    prev.map((p) =>
                      p.kind === active.kind
                        ? { ...p, body: e.target.value }
                        : p,
                    ),
                  )
                }
                rows={8}
                style={{ ...field, resize: 'vertical', fontFamily: 'inherit' }}
              />
            </label>
          </fieldset>
        )}
        <button type="submit" disabled={busy || !active} style={buttonStyle(busy)}>
          {busy ? 'Saving…' : `Save ${activePolicy} policy`}
        </button>
      </form>
    </div>
  );
}

function MenuEditor({
  title,
  draft,
  onChange,
  busy,
  onSave,
}: {
  title: string;
  draft: { title: string; items: DraftItem[] };
  onChange: (next: { title: string; items: DraftItem[] }) => void;
  busy: boolean;
  onSave: () => void;
}) {
  return (
    <div style={{ display: 'grid', gap: '0.85rem', maxWidth: 640 }}>
      <h3 style={{ margin: 0 }}>{title}</h3>
      <fieldset style={section}>
        <legend>Items</legend>
        <label style={{ display: 'grid', gap: '0.3rem' }}>
          <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>Menu title</span>
          <input
            value={draft.title}
            onChange={(e) => onChange({ ...draft, title: e.target.value })}
            style={field}
          />
        </label>
        {draft.items.map((item, index) => (
          <div
            key={index}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr auto',
              gap: '0.5rem',
              alignItems: 'end',
            }}
          >
            <label style={{ display: 'grid', gap: '0.3rem' }}>
              <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>Label</span>
              <input
                value={item.label}
                onChange={(e) => {
                  const items = draft.items.slice();
                  items[index] = { ...item, label: e.target.value };
                  onChange({ ...draft, items });
                }}
                style={field}
              />
            </label>
            <label style={{ display: 'grid', gap: '0.3rem' }}>
              <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>Href</span>
              <input
                value={item.href}
                onChange={(e) => {
                  const items = draft.items.slice();
                  items[index] = { ...item, href: e.target.value };
                  onChange({ ...draft, items });
                }}
                style={field}
              />
            </label>
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...draft,
                  items: draft.items.filter((_, i) => i !== index),
                })
              }
              style={{
                padding: '0.55rem 0.65rem',
                border: '1px solid #a8a29e',
                background: 'transparent',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            onChange({
              ...draft,
              items: [...draft.items, { label: '', href: '/' }],
            })
          }
          style={{
            justifySelf: 'start',
            padding: '0.45rem 0.75rem',
            border: '1px dashed #a8a29e',
            background: 'transparent',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Add item
        </button>
      </fieldset>
      <button
        type="button"
        disabled={busy}
        onClick={onSave}
        style={buttonStyle(busy)}
      >
        {busy ? 'Saving…' : `Save ${title.toLowerCase()}`}
      </button>
    </div>
  );
}

function buttonStyle(busy: boolean): CSSProperties {
  return {
    justifySelf: 'start',
    padding: '0.65rem 1.1rem',
    cursor: busy ? 'wait' : 'pointer',
    border: '1px solid #57534e',
    background: '#1c1917',
    color: '#fafaf9',
    borderRadius: 4,
  };
}

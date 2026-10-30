"use client";

import { useState } from "react";
import type { SiteConfig } from "@/lib/content";
import { DEFAULT_FAVICON, DEFAULT_LOGO, COLOR_GROUPS, COLOR_KEYS, COLORS, DEFAULT_COLORS, colorVars, normalizeHex, resolveColors, type ColorKey } from "@/lib/theme";
import { withBase } from "@/lib/basePath";
import { uploadFile } from "./api";
import { Field, SaveBar, ScreenHead, Section, useSiteDraft } from "./useSiteDraft";

function ImagePicker({ id, label, hint, value, fallback, onChange, onError }: { id: string; label: string; hint: string; value: string; fallback: string; onChange: (v: string) => void; onError: (m: string) => void }) {
  return (
    <div className="a-image-pick">
      <span className="a-image-thumb">
        <img src={withBase(value || fallback)} alt="" />
      </span>
      <Field id={id} label={label} hint={hint}>
        <div className="a-input-row">
          <input id={id} className="a-input" aria-describedby={`${id}-hint`} value={value} onChange={(e) => onChange(e.target.value.trim())} />
          <label className="a-btn a-btn-small">
            Upload
            <input
              type="file"
              accept="image/png,image/svg+xml,image/webp,image/jpeg,image/gif,image/avif"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  onChange((await uploadFile(f)).url);
                } catch (err) {
                  onError((err as Error).message);
                }
              }}
            />
          </label>
          <button className="a-btn a-btn-small" type="button" disabled={value === fallback} onClick={() => onChange(fallback)}>
            Use default
          </button>
        </div>
      </Field>
    </div>
  );
}

function ColorRow({ k, value, onChange }: { k: ColorKey; value: string; onChange: (v: string) => void }) {
  const def = COLORS[k];
  const [text, setText] = useState(value);
  const changed = value !== def.value;
  // Keep the hex box in step when the colour changes elsewhere (picker or reset).
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setText(value);
  }
  return (
    <div className={`a-color${changed ? " is-changed" : ""}`}>
      <input type="color" className="a-swatch" aria-label={`${def.label} colour`} value={value} onChange={(e) => onChange(e.target.value)} />
      <div className="a-color-text">
        <label htmlFor={`col-${k}`}>{def.label}</label>
        <span className="a-hint">{def.hint}</span>
      </div>
      <input
        id={`col-${k}`}
        className="a-input a-hex"
        value={text}
        spellCheck={false}
        aria-invalid={!normalizeHex(text)}
        onChange={(e) => {
          setText(e.target.value);
          const hex = normalizeHex(e.target.value);
          if (hex) onChange(hex);
        }}
      />
      <button className="a-btn a-btn-small" type="button" disabled={!changed} onClick={() => onChange(def.value)} title={`Default: ${def.value}`}>
        Reset
      </button>
    </div>
  );
}

/** A small mock of a docs page in the chosen colours. */
function Preview({ colors, name, logo }: { colors: Record<ColorKey, string>; name: string; logo: string }) {
  const style = Object.fromEntries(COLOR_KEYS.flatMap((k) => colorVars(k, colors[k]))) as React.CSSProperties;
  return (
    <div className="a-theme-preview" style={style} aria-label="Preview of the colours" role="img">
      <div className="tp-bar">
        <img src={withBase(logo)} alt="" width="18" height="18" />
        <strong>{name}</strong>
        <span className="tp-link is-on">Documentation</span>
        <span className="tp-link">API reference</span>
        <span className="tp-search">Search...</span>
      </div>
      <div className="tp-body">
        <div className="tp-side">
          <span className="tp-group">Get started</span>
          <span className="tp-item is-on">Introduction</span>
          <span className="tp-item">Quickstart</span>
          <span className="tp-item">Deploy</span>
        </div>
        <div className="tp-main">
          <span className="tp-h">Introduction</span>
          <span className="tp-p">
            Readers see your docs in these colours, with <span className="tp-a">links</span> in the accent and keys like <kbd>Ctrl</kbd>.
          </span>
          <span className="tp-callout tp-note">
            <b>Note</b> Something useful to know.
          </span>
          <span className="tp-callout tp-warn">
            <b>Warning</b> What could go wrong.
          </span>
          <span className="tp-callout tp-danger">
            <b>Important</b> What readers must not miss.
          </span>
          <span className="tp-btn">Primary button</span>
        </div>
      </div>
    </div>
  );
}

export default function AppearanceForm({ initial }: { initial: SiteConfig }) {
  const { site, set, dirty, saving, status, error, setError, save } = useSiteDraft(initial, ["logo", "favicon", "theme"]);
  const colors = resolveColors(site.theme);
  const changedCount = COLOR_KEYS.filter((k) => colors[k] !== DEFAULT_COLORS[k]).length;
  const setColor = (k: ColorKey, v: string) => set((s) => ({ ...s, theme: { colors: { ...resolveColors(s.theme), [k]: v } } }));

  return (
    <>
      <ScreenHead title="Appearance" sub="The logo, browser tab icon and colours of the whole site, including the admin portal." />
      {error ? (
        <p className="a-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="a-settings">
        <Section title="Logo" description="Shown beside the name in the top bar, here in the admin portal and on the sign-in screen. A square SVG or PNG works best.">
          <ImagePicker id="ap-logo" label="Logo address" hint="Upload a file, or use the address of one under Files." value={site.logo} fallback={DEFAULT_LOGO} onChange={(logo) => set((s) => ({ ...s, logo }))} onError={setError} />
          <ImagePicker id="ap-favicon" label="Browser tab icon" hint="A square image, at least 32 pixels." value={site.favicon} fallback={DEFAULT_FAVICON} onChange={(favicon) => set((s) => ({ ...s, favicon }))} onError={setError} />
        </Section>

        <Section
          title="Colours"
          description={
            <>
              Quill’s colours are the defaults. Change any of them; tints for highlights and borders follow automatically. {changedCount ? `${changedCount} changed.` : "Nothing changed yet."}
            </>
          }
        >
          <div className="a-theme">
            <div className="a-theme-colors">
              {COLOR_GROUPS.map((g) => (
                <fieldset className="a-color-group" key={g}>
                  <legend>{g}</legend>
                  {COLOR_KEYS.filter((k) => COLORS[k].group === g).map((k) => (
                    <ColorRow key={k} k={k} value={colors[k]} onChange={(v) => setColor(k, v)} />
                  ))}
                </fieldset>
              ))}
              <button className="a-btn a-btn-small a-add" type="button" disabled={!changedCount} onClick={() => set((s) => ({ ...s, theme: { colors: {} } }))}>
                Reset all colours to defaults
              </button>
            </div>
            <div className="a-theme-side">
              <Preview colors={colors} name={site.name} logo={site.logo} />
              <p className="a-hint">The site uses a dark theme. Keep text light on dark surfaces so it stays readable.</p>
            </div>
          </div>
        </Section>
      </div>
      <SaveBar dirty={dirty} saving={saving} status={status} onSave={save} label="Save appearance" />
    </>
  );
}

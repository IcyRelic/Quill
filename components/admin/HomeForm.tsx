"use client";

import { useRef, useState } from "react";
import type { HomeCard, SiteConfig } from "@/lib/content";
import { ART_NAMES, CardArt } from "@/components/Art";
import { withBase } from "@/lib/basePath";
import { uploadFile } from "./api";
import { Field, SaveBar, ScreenHead, Section, useSiteDraft } from "./useSiteDraft";

const blankCard: HomeCard = { title: "New card", description: "", href: "/", icon: "quill" };
/** The home page's width for each number of cards per row (as in globals.css), so the board is to scale. */
const BOARD_WIDTH: Record<number, number> = { 1: 880, 2: 880, 3: 1120, 4: 1280 };

let nextKey = 0;
const newKey = () => `card-${++nextKey}`;

export default function HomeForm({ initial, pages }: { initial: SiteConfig; pages: { slug: string; title: string }[] }) {
  const { site, set, dirty, saving, status, error, setError, save } = useSiteDraft(initial, ["home"]);
  const cards = site.home.cards;
  const cols = site.home.columns;
  // Cards have no ids of their own; these keep selection and React's rows steady while cards move.
  const keys = useRef<string[]>(initial.home.cards.map(newKey));
  const [selected, setSelected] = useState<string | null>(keys.current[0] ?? null);
  const [dragging, setDragging] = useState<string | null>(null);
  // Drag events can arrive faster than React re-renders, so the drag works from refs, not state.
  const dragRef = useRef<string | null>(null);
  const cardsRef = useRef(cards);
  cardsRef.current = cards;

  const setHome = <K extends keyof SiteConfig["home"]>(k: K, v: SiteConfig["home"][K]) => set((s) => ({ ...s, home: { ...s.home, [k]: v } }));
  const setCard = (i: number, patch: Partial<HomeCard>) => setHome("cards", cards.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const moveCard = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || to >= cardsRef.current.length) return;
    const next = [...cardsRef.current];
    next.splice(to, 0, next.splice(from, 1)[0]);
    const k = [...keys.current];
    k.splice(to, 0, k.splice(from, 1)[0]);
    keys.current = k;
    cardsRef.current = next;
    setHome("cards", next);
  };

  /** The dragged card takes the slot under the pointer, so the grid always shows where it will land. */
  const dragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const slots = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("[data-slot]"));
    const to = slots.findIndex((el) => {
      const r = el.getBoundingClientRect();
      return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    });
    if (to >= 0) moveCard(keys.current.indexOf(dragRef.current), to);
  };
  const endDrag = () => {
    dragRef.current = null;
    setDragging(null);
  };
  const addCard = () => {
    keys.current = [...keys.current, newKey()];
    setHome("cards", [...cards, blankCard]);
    setSelected(keys.current[keys.current.length - 1]);
  };
  const removeCard = (i: number) => {
    keys.current = keys.current.filter((_, j) => j !== i);
    setHome("cards", cards.filter((_, j) => j !== i));
    setSelected(keys.current[Math.min(i, keys.current.length - 1)] ?? null);
  };

  const si = selected ? keys.current.indexOf(selected) : -1;
  const card = si >= 0 ? cards[si] : null;

  return (
    <>
      <ScreenHead title="Home page" sub="The first screen readers see: a heading, a sentence and cards that lead into the docs.">
        <a className="a-btn" href={withBase("/")} target="_blank" rel="noreferrer">
          View home page
        </a>
      </ScreenHead>
      {error ? (
        <p className="a-error" role="alert">
          {error}
        </p>
      ) : null}
      <datalist id="page-addresses">
        {pages.map((p) => (
          <option key={p.slug} value={`/${p.slug}`}>
            {p.title}
          </option>
        ))}
      </datalist>

      <div className="a-settings">
        <Section title="Heading" description="The large heading and the sentence under it.">
          <Field id="h-title" label="Heading" hint={`${site.home.title.length} characters. Keep it under about 32 so it fits on two lines on a phone.`}>
            <input id="h-title" className="a-input" aria-describedby="h-title-hint" value={site.home.title} onChange={(e) => setHome("title", e.target.value)} />
          </Field>
          <Field id="h-lead" label="Sentence under the heading">
            <textarea id="h-lead" className="a-textarea a-textarea-short" value={site.home.lead} onChange={(e) => setHome("lead", e.target.value)} />
          </Field>
          <label className="a-check a-field">
            <input type="checkbox" checked={site.home.showArt} onChange={(e) => setHome("showArt", e.target.checked)} />
            Show the faint drawing behind the heading
          </label>
        </Section>

        <section className="a-setting a-setting-wide">
          <div className="a-board-head">
            <div>
              <h2>Cards</h2>
              <p>Laid out as on the home page. Drag a card to move it; click one to edit it. On tablets the grid drops to two cards per row, and on phones to one.</p>
            </div>
            <div className="a-field a-cols">
              <span className="a-label" id="cols-label">
                Cards per row
              </span>
              <div className="a-seg" role="group" aria-labelledby="cols-label">
                {[1, 2, 3, 4].map((n) => (
                  <button key={n} type="button" aria-pressed={cols === n} onClick={() => setHome("columns", n)}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div
            className="a-board"
            data-cols={cols}
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, maxWidth: BOARD_WIDTH[cols] }}
            onDragEnter={dragOver}
            onDragOver={dragOver}
            onDrop={(e) => {
              dragOver(e);
              endDrag();
            }}
          >
            {cards.map((c, i) => {
              const key = keys.current[i];
              return (
                <div
                  key={key}
                  className={`a-tile${key === selected ? " is-selected" : ""}${key === dragging ? " is-dragging" : ""}`}
                  data-slot=""
                  draggable
                  role="button"
                  tabIndex={0}
                  aria-pressed={key === selected}
                  aria-label={`Card ${i + 1}: ${c.title}. Drag to move, or press Enter to edit.`}
                  onClick={() => setSelected(key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(key);
                    }
                  }}
                  onDragStart={(e) => {
                    dragRef.current = key;
                    setDragging(key);
                    setSelected(key);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", c.title);
                  }}
                  onDragEnd={endDrag}
                >
                  <span className="a-tile-num">{i + 1}</span>
                  <span className="home-card-art">{c.image ? <img src={withBase(c.image)} alt="" draggable={false} /> : <CardArt name={c.icon} id={`admin-${key}`} />}</span>
                  <strong>{c.title || "Untitled card"}</strong>
                  <span className="a-tile-desc">{c.description || "No description"}</span>
                </div>
              );
            })}
            <button type="button" className="a-tile a-tile-add" onClick={addCard}>
              <span>+ Add card</span>
            </button>
          </div>

          {card ? (
            <div className="a-panel a-card-edit" style={{ maxWidth: BOARD_WIDTH[cols] }}>
              <div className="a-card-top">
                <strong>
                  Card {si + 1}: {card.title || "Untitled card"}
                </strong>
                <div className="a-card-actions">
                  <button className="a-btn a-btn-small" type="button" disabled={si === 0} onClick={() => moveCard(si, si - 1)}>
                    Move earlier
                  </button>
                  <button className="a-btn a-btn-small" type="button" disabled={si === cards.length - 1} onClick={() => moveCard(si, si + 1)}>
                    Move later
                  </button>
                  <button className="a-btn a-btn-small a-btn-danger" type="button" onClick={() => removeCard(si)}>
                    Remove
                  </button>
                </div>
              </div>
              <div className="a-two">
                <Field id="c-title" label="Title">
                  <input id="c-title" className="a-input" value={card.title} onChange={(e) => setCard(si, { title: e.target.value })} />
                </Field>
                <Field id="c-href" label="Link">
                  <input id="c-href" className="a-input" list="page-addresses" value={card.href} onChange={(e) => setCard(si, { href: e.target.value })} />
                </Field>
              </div>
              <Field id="c-desc" label="Description">
                <input id="c-desc" className="a-input" value={card.description} onChange={(e) => setCard(si, { description: e.target.value })} />
              </Field>
              <div className="a-two">
                <Field id="c-icon" label="Drawing">
                  <select id="c-icon" className="a-select" value={card.icon} onChange={(e) => setCard(si, { icon: e.target.value })}>
                    {ART_NAMES.map((n) => (
                      <option key={n} value={n}>
                        {n[0].toUpperCase() + n.slice(1)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field id="c-image" label="Picture instead" hint="Optional. Replaces the drawing.">
                  <div className="a-input-row">
                    <input id="c-image" className="a-input" aria-describedby="c-image-hint" value={card.image ?? ""} placeholder="/uploads/…" onChange={(e) => setCard(si, { image: e.target.value || undefined })} />
                    <label className="a-btn a-btn-small">
                      Upload
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          try {
                            setCard(si, { image: (await uploadFile(f)).url });
                          } catch (err) {
                            setError((err as Error).message);
                          }
                        }}
                      />
                    </label>
                  </div>
                </Field>
              </div>
            </div>
          ) : (
            <p className="a-hint">{cards.length ? "Click a card to edit it." : "No cards yet. Add one to lead readers into the docs."}</p>
          )}
        </section>
      </div>
      <SaveBar dirty={dirty} saving={saving} status={status} onSave={save} label="Save home page" />
    </>
  );
}

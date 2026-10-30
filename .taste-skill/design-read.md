# Design read: Quill docs

## 1. Brief and project
- Kind: two pieces of work. The public docs site is a page (read and scrolled). The admin portal is an
  app screen (worked in) and follows references/app-screens.md.
- Subject: Quill, an app, documented for consumers (not developers).
- Primary action: find and read the right guide (getting started, how-to, answers).
- Stack: Next.js 16 (App Router), file-based content, no existing brand.
- Imagery that truly exists: no product screenshots, no image tool. The interface is drawn in HTML
  (data-ui fragments). Real pictures of the subject's world come from open collections: engravings and
  paintings of people cutting and writing with quill pens (public domain / CC0).
- Reading of the vague part: Quill's real feature set is unknown, so Quill is shown as a writing app
  (the name suggests it) with plainly sample content. Every page is editable.

Inventory (things only Quill has):
1. The name: a quill, a feather cut into a pen.
2. The nib: the angled cut made with a penknife. Its one shape is a straight diagonal cut on a corner.
3. The penknife ritual: a quill is re-cut before writing, a small preparation step before work.
4. Ink: iron-gall ink, blue-black drying to brown; bottle-green writing inks.
5. Paper: a plain sheet, ruled margins, the page you write on.
6. The writing desk: inkwell, sand, a stack of books, a lit window.
7. The 18th-century engravings of scribes sharpening quills (real, public domain).
8. Handwriting lessons: learning to write step by step (Anker, 1865).
9. A product that is used daily by non-technical people: help must read like a manual, not a dev doc.

## 2. The argument (home page)
1. This is where you learn Quill, step by step.         -> h1, search that answers as you type
2. You can be writing in a few minutes.                  -> "Start here": the four first guides, in order
3. Every common job has its own guide.                   -> "Guides by task", grouped by what you want to do
4. Most questions have a short answer.                   -> "Common questions", answered in place
5. If something is broken, there is a fix or a person.   -> "Still stuck?": troubleshooting + support email
6. Close                                                  -> footer, the name at full width, credits
Docs pages: one claim each (the page title), proof = the steps themselves.

## 3. Direction
draw.mjs could not run (skill scripts are missing from disk), so the three candidates were chosen by
hand from library/directions.json for sector consumer-app, tone quiet/technical:
- quiet-instrument: understatement, single column. Risk: reads thin for a consumer help centre.
- borrowed-category: dress it as another category. Wrong vibe for "clean and organized".
- one-motif: one shape from the subject runs the whole system.  <- CHOSEN
Why: the quill nib gives a shape only Quill owns, and a single repeated shape is exactly what keeps a
dense docs site organised without ornaments.

## 4. The idea
On this page, **the angled cut of a quill's nib** becomes **the one motif**: every button, image
mask, callout, code block, list marker and active link has one corner cut at the nib's angle, and the
hero is that cut at enormous scale holding the engraving of a scribe cutting his pen.
Competitor test: put Mintlify or GitBook in the sentence. They have no nib; it fails. Pass.

Live thing: search that answers as you type, from the hero and from Ctrl+K on every page. Uses the
real page content, works with a thumb, falls back to a server-rendered /search page without script.

## 5. Tokens
- Ground #FFFFFF, surface #F1F3F2 (tone step), ink #121518, soft ink #4B5259,
  accent bottle-green ink #0B6B50 (on the primary action and the motif field only), accent-ink #FFFFFF,
  band #121518 for the footer.
- Type: Schibsted Grotesk (one family, self-hosted), weights 400/500/700. Code: system monospace,
  only inside pre/code.
- Sizes: display clamp(44px, 6.4vw, 96px); heading 32-40px; body 17px (docs 16.5-17px); small 14px.
- Buttons: square, with the nib cut. No radius anywhere else.

## 6. Copy deck (home)
- H1: "Quill, explained step by step" (30 chars)
- Lead: "Guides, answers and fixes for Quill on Mac, Windows, iPhone and Android. Search for what you
  want to do, or start at the beginning."
- Primary action: "Start the first guide". Secondary: search field.
- Sections: Start here / Guides by task / Common questions / Still stuck?
- Sample content to replace before launch: every page body, feature names, prices on the plans page,
  the support address, platform list.

## Admin (app screen)
- One question per screen: Pages = "what's published and what needs work?"; Editor = "what will the
  reader see?" (live preview beside the source); Navigation = "in what order do readers meet pages?";
  Settings; API access.
- Face from the brief: the same bottle-green on the one primary action and on "Published" status, the
  nib-cut product mark at the top of the sidebar.
- Quiet chrome: 232px sidebar, grey active pill, tables of rules and alignment, labels above fields.

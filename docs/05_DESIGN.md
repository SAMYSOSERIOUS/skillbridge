# SkillBridge — Design Brief (the contract for the frontend)

This document is the single source of truth for how the app looks and feels. The frontend is hand-built HTML/CSS/JS (`web/`), no framework, no build step. If the built UI deviates from this brief for a good reason, update this doc in the same commit.

**The one-line direction:** a calm, dark, confident instrument — the data glows, everything else stays quiet. It should read as a product, never as a dashboard template or a notebook.

---

## 1. Design principles

1. **One accent.** The Pareto frontier's green is the only saturated color on screen. If something else is competing for attention, it's wrong.
2. **The number is the hero.** "+$21,400/yr" is the emotional payoff — it gets the largest type on the results screen.
3. **Dark canvas, not black.** Deep desaturated green-gray, so the accent green feels native, not neon-on-void.
4. **Quiet chrome.** Hairline borders, generous spacing, no cards-in-cards, no shadows, no gradients on surfaces.
5. **Honesty is visible.** The three AI-exposure source bars and the agreement flag are part of the design, always shown together, never replaced by a single score.
6. **Motion means something.** Exactly two signature animations (below). Everything else is instant or a 150ms ease.

## 2. Color tokens (CSS custom properties in `styles.css`)

```css
:root {
  /* Canvas & surfaces */
  --bg:            #101312;  /* page background */
  --surface:       #141917;  /* panels, chart card */
  --surface-2:     #181d1b;  /* inputs, chips */
  --border:        #232826;  /* hairlines */
  --border-strong: #2b332f;  /* input borders, hover */

  /* Text */
  --text:          #e8ece9;  /* headings, primary */
  --text-2:        #8a948e;  /* secondary */
  --text-3:        #6f7a74;  /* muted, axis labels */

  /* The accent (Pareto green) — the ONLY saturated color */
  --accent:        #2ee08a;
  --accent-ink:    #0b241a;  /* text on accent fills */
  --accent-dim:    rgba(46, 224, 138, 0.25);  /* glows, frontier halo */

  /* Data-only colors (charts, never chrome) */
  --dot-dominated: #3b453f;  /* non-frontier scatter points */
  --bar-exposure:  #4a5a52;  /* the three AI-exposure bars */
  --warn:          #e0b34a;  /* "upgrade needed" BOM tier */
  --danger:        #e05a4a;  /* "must acquire" BOM tier */
}
```

Rules: `--warn` and `--danger` appear only inside the BOM checklist and never elsewhere. No other hex values in the codebase.

## 3. Typography

- **One family:** Inter (self-hosted woff2 in `web/fonts/` — no external font CDN, keeps the app fully offline-capable for `make demo`).
- Weights: 400 (body) and 500 (headings, numbers). Nothing heavier.
- Scale: hero headline 28–32px · the wage-gain number 24–28px · section labels 13px · body 14px · axis/meta 12px. Line-height 1.5 for text, 1.2 for headlines.
- Sentence case everywhere. No all-caps except the tiny "SKILLBRIDGE" wordmark (letter-spacing 0.04em).
- Tabular numerals (`font-variant-numeric: tabular-nums`) on all figures so numbers don't jiggle when they update.

## 4. Layout

- Max content width **1080px**, centered; 24px page gutters.
- **Hero (first paint):** wordmark top-left · headline "Where should your career go next?" · one-line subtitle · search input with the accent "Find my moves" button · "Try: Bank Teller" chip. Nothing else. This is the 0–3s of the demo.
- **Results:** two-column grid — frontier chart left (~60%), right rail with the "Best move" panel (accent-bordered, the big number) and the AI-exposure three-bar panel. Escape-route stepper full-width below. BOM opens as a right-side drawer (420px) over a dimmed backdrop.
- Metro map and Methodology/Transparency are secondary views reached from the top nav (Methodology · Data · About).
- Radii: 10px inputs/buttons, 12px panels, 16px page container. Borders 1px `--border` (0.5px on high-DPI via media query).
- Responsive: below 760px the grid stacks to one column; the drawer becomes full-width; the chart keeps min-height 320px. The demo GIF is recorded at desktop width.

## 5. The two signature animations

1. **Frontier reveal** (the GIF moment): dominated dots fade in over ~400ms with slight stagger → frontier points pop in with a soft `--accent-dim` halo → the dashed frontier polyline draws left-to-right over ~600ms. Total under 1.2s. Pure CSS/Plotly transition — no animation library.
2. **BOM drawer slide-in:** 220ms ease-out from the right; the "+$X/yr" number counts up over ~500ms (tabular numerals prevent jitter).

Everything else: 150ms ease on hover/focus only. Respect `prefers-reduced-motion: reduce` — both signature animations collapse to simple fades.

## 6. Components

- **Search input:** `--surface-2` fill, `--border-strong` border, search icon left; focus = 1px `--accent` border + subtle `--accent-dim` ring. Autocomplete list below, keyboard-navigable (↑↓ + Enter), max 8 results.
- **Primary button:** solid `--accent` fill, `--accent-ink` text, weight 500. There is exactly one on screen at a time.
- **Chips/steppers:** `--surface-2` pill, 12–13px text; the current escape-route hop gets a `--accent` 1px border.
- **BOM tiers:** ✅ transferable (plain), 🟡 upgrade (`--warn` label + gap bar), 🔴 acquire (`--danger` label + gap bar). Gap bars are 4px tall, rounded, on `--border` track.
- **Exposure panel:** three equal-width bars (`--bar-exposure`), source names beneath (AIOE · OpenAI · Microsoft), agreement badge ("3 sources agree" in `--text-2`, or "sources disagree" in `--warn`). The composite never appears without the bars.
- **States (every view designs all three):**
  - Loading: skeleton blocks in `--surface-2`, no spinners.
  - Empty: friendly one-liner + the "Try: Bank Teller" chip.
  - Error: plain-language copy ("We couldn't match that job title — try a broader one."), never raw JSON or stack traces.
- **Footer:** the full attribution block from `04_DATASETS.md`, `--text-3`, always present.

## 7. Charts (Plotly.js)

- Transparent chart background; grid lines `--border`; axis labels 12px `--text-3`; no chart titles (the surrounding HTML labels the chart).
- Frontier scatter: dominated dots `--dot-dominated` r≈4; frontier dots `--accent` r≈6 with `--accent-dim` halo; hover card styled to match panels (dark, hairline border).
- Choropleth: a single-hue green ramp derived from the accent (light→`--accent`); diverging only if negative wage deltas are shown, with the negative side in neutral grays — never red/green together.
- Disable the Plotly mode bar. Every displayed number is formatted from API values (`$21.4k`, `+$21,400/yr`) — no unformatted floats, no fake precision.

## 8. Share card (1200×630 PNG, rendered server-side)

Same tokens as the app: `--bg` canvas, wordmark top-left, "Bank Teller → Loan Officer" as the headline, the wage number large in `--accent`, three "skills to learn" lines, AI-risk change, small attribution line at the bottom. It must look like a cropped screenshot of the product — that's what makes it shareable.

## 9. Accessibility & quality bar

- Contrast: all text ≥ 4.5:1 against its surface (the tokens above pass; check any new pairing).
- Full keyboard path for the 15-second demo: tab to search → type → Enter → arrow through frontier list fallback → Enter opens BOM. Visible focus rings (accent).
- The frontier also exists as a ranked list ("Top moves") for screen readers and as the fallback view — it's the same data, sorted.
- `alt`/`aria-label` on the chart region summarizing the top 3 moves in words.
- Lighthouse (desktop): ≥90 accessibility, ≥90 performance. The page ships < 1MB excluding Plotly.js.

## 10. Motion & identity upgrade (v1.1 of this brief)

- **Logo:** an inline SVG mark — the rising frontier polyline with an endpoint
  dot, in `--accent`, 26px in the top bar. On load the line draws itself
  (~900ms) and the dot pops in; matches the favicon.
- **Hero constellation:** a canvas layer behind the hero content: ~70 drifting
  dots (18% accent-green — the frontier motif), faint lines between near
  neighbors, soft repulsion within ~120px of the cursor. Subtle by contract:
  line alpha <= 0.1, dot alpha <= 0.55, no interference with text. Disabled
  entirely under `prefers-reduced-motion` and when the tab is hidden.
- **Scroll reveals:** methodology/data/about sections fade-and-rise once
  (IntersectionObserver), 600ms ease.
- **Data motion:** exposure bars grow to their percentile height (700ms);
  BOM gap bars fill to width (600ms); both are one-shot, meaning-carrying
  animations in the §5 spirit.
- **Chart legend:** a plain-language legend strip above the frontier chart
  (green = can't-be-beaten deal, gray = beaten, click a dot for skills).
  No jargon in the chart chrome; "Pareto" stays in Methodology.
- **Best-moves panel:** two picks, both clickable: "🚀 Biggest win" (highest
  balanced score) and "🎯 Closest win" (least retraining) — the moonshot and
  the next step, so one extreme number can never mislead. Below it, the
  licensing honesty note (pilots/controllers/healthcare).


## 11. v3 — the adopted product design (supersedes §2–§7 for web/)

The stakeholder prototype (SkillBridge_App.html) is now the canonical UI,
implemented 1:1 on real data (docs/07_UI_GAP_ANALYSIS.md is the contract for
what each element shows). What changes and what holds:

- **Accent becomes clay-orange `#ff7a59`** (was Pareto green). Still exactly
  one saturated accent; the dark green-gray canvas tokens remain.
- **Typeface becomes Geist**, self-hosted inside the single-file bundle
  (no font CDN at runtime).
- **The frontend is one self-contained file** (`web/index.html`): React
  runtime, fonts, layout and logic embedded. Editable sources live in
  `web/src/` (layout.html + component.js); `python tools/rebundle.py`
  rebuilds the file. No npm, no build toolchain.
- **Three views of the same data**: 3-D pillar map (auto-orbit, drag, hover
  pause, 3-step guided tour, top-10 labeled), flat chart (all moves), ranked
  list. Last view remembered locally.
- **Priority sliders** (pay / speed / AI safety) re-rank the recommendation;
  the frontier itself never changes, and "Why this move?" prints the
  reasoning including the user's weights.
- **Skill-plan drawer**: floating 3-layer skill stack, must-learn/upgrade/have
  tiers with real O*NET levels, copy-skills-for-resume, date-planned
  milestones (suggested from Job-Zone bands, user-editable), save / email /
  compare. License line reads "Not tracked in v1" until a real source exists.
- **Empty state ("no better move")** is a first-class scene (summit), with
  real alternatives listed when the data has them.
- Honesty rules carried over: three exposure sources always shown (now as a
  range bar + per-source rows + spread note), field-size tags from real
  employment, real build date, reduced-motion supported throughout.

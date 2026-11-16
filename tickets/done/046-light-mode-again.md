# 046 · Turn off dark mode: Dynasty Ticker is light mode again

Done: 2026-11-16, [#390](https://github.com/nikoskiouris/Dynasty-Ticker/pull/390)

**Status:** Done · **Priority:** P1 · **Size:** S · **Owner:** Cursor

## Context / owner decision

Niko, Nov 16, 2026: *"Turn off dark mode and make Dynasty-Ticker light mode again. Change NOTHING else."* The desk has been dark-only ("Night desk") since the product-page rebuild (#119). There is no theme toggle; this switches the one theme to light.

## Scope

Theme and color-scheme only:

- `docs/styles.css` and `docs/tokens.css`: `color-scheme: light` and light values for the color variables (paper field, ink type); the few hard-coded dark colors (body, ticker, menu drawer, tool-picker cards, active ranks row, Get-side chip price, shadows) get light equivalents.
- `<html data-theme>` and `<meta name="theme-color">` in `docs/index.html`, `docs/404.html`, `docs/privacy.html`, `docs/terms.html`; the legal and 404 pages use `brand/wordmark.svg` (dark ink) instead of `wordmark-on-dark.svg`.
- `docs/site.webmanifest` `theme_color` / `background_color`, and `DEFAULT_THEME` / `THEME_COLOR` in `docs/modules/state.js`.

Out of scope: copy, layout, features, dependencies, and the server-rendered share card image (`netlify/lib/trade-card.js`), which is an image, not the site theme.

## Acceptance (observable)

- Home, Trade Calc (with a trade entered), and My Team on a public Sleeper league render on a light background with dark text at 1280 and 390 wide.
- The browser reports `color-scheme: light` and the theme color is light.
- Verdicts, values, and layout are unchanged.

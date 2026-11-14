# Tiles Calculator – website

Static landing page for the Tiles Calculator Android app, ready for GitHub Pages.
No build step, no frameworks: plain HTML, CSS and JavaScript.

## What's inside

| File | Purpose |
|------|---------|
| `index.html`, `pl/` `de/` `es/` `fr/` `it/` `pt/` `tr/` `hi/` | Generated pages, one per language (do not edit by hand) |
| `i18n/template.html` | **Edit this**: the English page that all languages are built from |
| `i18n/<lang>.json` | Translations, keyed by the English text |
| `build_i18n.py` | Builds all language pages, hreflang links, sitemap and robots.txt |
| `404.html` | "Page not found" page, served automatically by GitHub Pages |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are |
| `assets/css/style.css` | All styles, responsive down to phone width, respects reduced motion |
| `assets/js/tiles-engine.js` | JavaScript port of the app's tile layout engine (same counts as the app) |
| `assets/js/main.js` | Animations, menu, live demo and pattern gallery |
| `assets/img/logo.svg` | App icon, also used as favicon |
| `assets/img/icon-*.png`, `og-image.png` | PNG icons and the 1200x630 social preview image |
| `robots.txt`, `sitemap.xml`, `site.webmanifest` | Search engine and install files |
| `set-site-url.sh` | Changes the site address everywhere in one go |

## Languages

The site is in the same 9 languages as the app. English is at the root, the others at `/pl/`, `/de/`,
`/es/`, `/fr/`, `/it/`, `/pt/`, `/tr/` and `/hi/`, each with its own title, description and FAQ for
Google, linked together with `hreflang`. Visitors are sent to their browser language on their first
visit; the language menu choice is remembered.

To change text:
1. Edit `i18n/template.html` (English).
2. Run `python3 build_i18n.py`. It lists any text that has no translation yet.
3. Add the missing translations to `i18n/<lang>.json` (key = English text) and build again.

## Choose the address

The site is set up for **https://bianielbianiel.github.io/tiles-calculator/**.
To use a different address, run one command (it updates canonical links, sitemap, robots.txt,
social cards and the 404 page):

```bash
./set-site-url.sh https://tiles-calculator.github.io/          # GitHub account/organisation "tiles-calculator"
./set-site-url.sh https://www.tilescalculator.app/              # your own domain
```

| Address | How |
|---------|-----|
| `bianielbianiel.github.io/tiles-calculator/` | Repository `tiles-calculator` on your account (default) |
| `tiles-calculator.github.io` | Free GitHub organisation named `tiles-calculator`, repository `tiles-calculator.github.io` |
| `tilescalculator.app` (example) | Buy a domain, add a `CNAME` file containing the domain, set DNS, enter it under Settings > Pages > Custom domain |

## Publish on GitHub Pages

1. Create a new **public** repository on GitHub named `tiles-calculator` (no README).
2. Push the contents of this folder:
   ```bash
   cd website
   git init
   git add .
   git commit -m "Tiles Calculator website"
   git branch -M main
   git remote add origin git@github.com:bianielbianiel/tiles-calculator.git
   git push -u origin main
   ```
3. On GitHub: **Settings > Pages > Build and deployment > Source: Deploy from a branch**,
   branch `main`, folder `/ (root)`, **Save**. Tick **Enforce HTTPS** when it appears.
4. After a minute or two the site is live at the address above.

## SEO checklist after going live

Already in the site: page title and description with search keywords, canonical links,
Open Graph and Twitter cards with a 1200x630 preview image, structured data
(SoftwareApplication, WebSite, FAQPage), `robots.txt`, `sitemap.xml`, web manifest and icons,
`noindex` on the 404 page, deferred scripts and mobile-friendly layout.

1. **Google Search Console** (search.google.com/search-console): add the site as a
   *URL prefix* property, verify it with the *HTML tag* method (paste the
   `<meta name="google-site-verification" ...>` tag into the `<head>` of `index.html`, push,
   then press Verify), then open **Sitemaps** and submit `sitemap.xml`.
2. **Bing Webmaster Tools** (bing.com/webmasters): import the site from Search Console.
3. **Check structured data**: search.google.com/test/rich-results with the site address.
4. **Check the social card**: paste the address into a WhatsApp or LinkedIn message,
   or use developers.facebook.com/tools/debug.
5. **Google Play Console**: put the site address under *Store settings > Website*. Keep the
   privacy policy URL as it is. Links between the Play listing and the site help both rank.

## Things to check before going live

- **Google Play link**: set in `assets/js/main.js` (`CONFIG.playUrl`). It points to
  `tiles_calculator.tilecalc`; it only works once the app is published.
- **Contact e-mail**: `website.scss@gmail.com` in `index.html`.
- **Privacy policy**: lives in its own repository and is linked from this site:
  https://bianielbianiel.github.io/tiles-calculator-privacy/ (repo `tiles-calculator-privacy`).
  When PRO launches with in-app purchases, update its "Children's Privacy" section there,
  which currently says the app has no in-app purchases.

## After changing CSS or JS

Raise the version number in the links in `i18n/template.html` (and the CSS link in `404.html`), e.g.
`style.css?v=4` to `style.css?v=5`, then run `python3 build_i18n.py`. Browsers then load the new files instead of an old cached copy.

## Preview locally

Open `index.html` in a browser, or run a small server from this folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

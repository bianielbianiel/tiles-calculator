#!/usr/bin/env python3
"""
Builds the website in every language from i18n/template.html (English).

    python3 build_i18n.py

Writes index.html (English) and pl/, de/, es/, fr/, it/, pt/, tr/, hi/ index.html, plus sitemap.xml.
Translations live in i18n/<lang>.json as {"text": {...}, "js": {...}, "seo": {...}} keyed by the
English text. Anything missing falls back to English and is listed when the build finishes.
"""
import html, json, os, re

ROOT = os.path.dirname(os.path.abspath(__file__))
I18N = os.path.join(ROOT, 'i18n')

LANGS = [  # code, menu name, og:locale
    ('en', 'English', 'en_GB'), ('pl', 'Polski', 'pl_PL'), ('de', 'Deutsch', 'de_DE'),
    ('es', 'Español', 'es_ES'), ('fr', 'Français', 'fr_FR'), ('it', 'Italiano', 'it_IT'),
    ('pt', 'Português', 'pt_BR'), ('tr', 'Türkçe', 'tr_TR'), ('hi', 'हिन्दी', 'hi_IN'),
]
META_KEYS = ('description', 'keywords', 'og:title', 'og:description', 'og:image:alt',
             'twitter:title', 'twitter:description')
SEO_EN = {
    'description': "Free tile calculator app for Android. Work out how many tiles you need for any room, "
                   "with 7 layout patterns, waste included, metric and imperial units. No ads, works offline.",
    'features': ["Tile quantity calculator with waste", "7 tile layout patterns", "Several areas per job",
                 "Customer job records", "Metric and imperial units", "Works offline, no ads"],
}
PLAY_URL = 'https://play.google.com/store/apps/details?id=tiles_calculator.tilecalc'
# Same in every language (names, brand, values the page script replaces at once)
KEEP = {'Tiles Calculator', 'English', 'Polski', 'Deutsch', 'Español', 'Français', 'Italiano', 'Português',
        'Türkçe', 'हिन्दी', 'PRO', 'FAQ', 'Google Play', 'EN', 'x', '60 x 30 cm', '3 mm', 'Centred, 0°', 'Herringbone'}


def load(path, default=None):
    if not os.path.exists(path):
        return default
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def page_url(site, code):
    return site if code == 'en' else f'{site}{code}/'


def translate_text(src, tr, missing):
    """Replace text between tags and selected attribute values with their translations."""
    def sub_text(m):
        raw = m.group(1)
        key = raw.strip()
        if key in tr and tr[key]:
            lead = raw[:len(raw) - len(raw.lstrip())]
            trail = raw[len(raw.rstrip()):]
            return '>' + lead + tr[key] + trail + '<'
        if key and key not in KEEP and re.search(r'[A-Za-z]{3}', key) and not re.fullmatch(r'&\w+;', key):
            missing.add(key)
        return m.group(0)

    # Keep <script>/<style> untouched, translate the rest
    parts = re.split(r'(<(?:script|style)\b.*?</(?:script|style)>)', src, flags=re.S)
    for i in range(0, len(parts), 2):
        p = parts[i]
        p = re.sub(r'>([^<>]+)<', sub_text, p)

        def sub_attr(m):
            v = m.group(2)
            return f'{m.group(1)}="{tr[v]}"' if tr.get(v) else m.group(0)
        p = re.sub(r'\b(aria-label|alt)="([^"]+)"', sub_attr, p)

        def sub_meta(m):
            v = m.group(3)
            return f'{m.group(1)}"{m.group(2)}" content="{tr[v]}"' if tr.get(v) else m.group(0)
        p = re.sub(r'(<meta (?:name|property)=)"(' + '|'.join(re.escape(k) for k in META_KEYS)
                   + r')" content="([^"]*)"', sub_meta, p)
        parts[i] = p
    return ''.join(parts)


def json_ld(code, url, site, seo, page):
    def plain(t):
        return html.unescape(re.sub(r'<[^>]+>', '', t)).strip()
    faqs = re.findall(r'<details class="reveal"><summary>(.*?)</summary><p>(.*?)</p></details>', page, re.S)
    items = [
        {"@context": "https://schema.org", "@type": "SoftwareApplication", "name": "Tiles Calculator",
         "operatingSystem": "Android", "applicationCategory": "UtilitiesApplication",
         "description": seo.get(SEO_EN['description']) or SEO_EN['description'],
         "url": url, "image": site + "assets/img/icon-512.png", "screenshot": site + "assets/img/og-image.jpg",
         "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
         "inLanguage": [c for c, _, _ in LANGS], "downloadUrl": PLAY_URL,
         "featureList": [seo.get(f) or f for f in SEO_EN['features']]},
        {"@context": "https://schema.org", "@type": "WebSite", "name": "Tiles Calculator", "url": url, "inLanguage": code},
        {"@context": "https://schema.org", "@type": "FAQPage", "inLanguage": code, "mainEntity": [
            {"@type": "Question", "name": plain(q), "acceptedAnswer": {"@type": "Answer", "text": plain(a)}}
            for q, a in faqs]},
    ]
    return ''.join(f'  <script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>\n' for x in items)


def build():
    site = load(os.path.join(I18N, 'config.json'))['site_url']
    if not site.endswith('/'):
        site += '/'
    with open(os.path.join(I18N, 'template.html'), encoding='utf-8') as f:
        template = f.read()
    report = {}

    for code, name, locale in LANGS:
        data = load(os.path.join(I18N, f'{code}.json'), {}) if code != 'en' else {}
        tr, js, seo = data.get('text', {}), data.get('js', {}), data.get('seo', {})
        url = page_url(site, code)
        prefix = '' if code == 'en' else '../'
        missing = set()

        page = template if code == 'en' else translate_text(template, tr, missing)
        page = (page.replace('{{LANG}}', code).replace('{{URL}}', url)
                    .replace('{{LOCALE}}', locale).replace('{{SITE}}', site))

        # Relative paths from the language folder
        if prefix:
            page = re.sub(r'(href|src)="(assets/|site\.webmanifest)', r'\1="' + prefix + r'\2', page)
            page = page.replace('href="./"', 'href="../"')

        # hreflang alternates (same block on every page)
        alt = ''.join(f'  <link rel="alternate" hreflang="{c}" href="{page_url(site, c)}">\n' for c, _, _ in LANGS)
        alt += f'  <link rel="alternate" hreflang="x-default" href="{site}">'
        page = page.replace('  <!-- HREFLANG -->', alt)

        # Language menu
        items = []
        for c, n, _ in LANGS:
            href = (prefix + ('' if c == 'en' else c + '/')) or './'
            cur = ' aria-current="true"' if c == code else ''
            items.append(f'<li><a href="{href}" hreflang="{c}" lang="{c}" data-lang="{c}" role="menuitem"{cur}>'
                         f'{n}<small>{c.upper()}</small></a></li>')
        page = page.replace('<!-- LANG_MENU -->', ''.join(items))
        page = page.replace('<span>EN</span>', f'<span>{code.upper()}</span>', 1)

        # Script texts
        page = page.replace('  <!-- I18N_JS -->',
                            f'  <script>window.I18N = {json.dumps(js, ensure_ascii=False)};</script>' if js else '')

        # First visit on the English page: follow the browser language (unless chosen before)
        redirect = ''
        if code == 'en':
            others = [c for c, _, _ in LANGS if c != 'en']
            redirect = ('  <script>(function(){var L=' + json.dumps(others) + ';try{'
                        'if(/bot|crawl|spider|slurp|lighthouse|preview/i.test(navigator.userAgent))return;'
                        "var s=localStorage.getItem('tc-lang');if(s==='en')return;"
                        'var w=s&&L.indexOf(s)>=0?s:null;'
                        'if(!w){var ls=navigator.languages||[navigator.language||""];'
                        'for(var i=0;i<ls.length&&!w;i++){var c=(ls[i]||"").slice(0,2).toLowerCase();'
                        'if(c==="en")return;if(L.indexOf(c)>=0)w=c;}}'
                        'if(w)location.replace(w+"/"+location.hash);}catch(e){}})();</script>')
        page = page.replace('  <!-- REDIRECT -->', redirect)

        page = page.replace('  <!-- JSONLD -->\n', '  <!-- Structured data for Google (app, website, FAQ) -->\n'
                            + json_ld(code, url, site, seo, page))

        out_dir = ROOT if code == 'en' else os.path.join(ROOT, code)
        os.makedirs(out_dir, exist_ok=True)
        with open(os.path.join(out_dir, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(page)
        if code != 'en':
            keys = load(os.path.join(I18N, 'keys.json'))
            missing |= {k for k in keys['js'] if not js.get(k)}
            missing |= {k for k in keys['seo'] if not seo.get(k)}
            report[code] = sorted(missing)

    # Sitemap with language alternates
    links = ''.join(f'\n    <xhtml:link rel="alternate" hreflang="{c}" href="{page_url(site, c)}"/>' for c, _, _ in LANGS)
    links += f'\n    <xhtml:link rel="alternate" hreflang="x-default" href="{site}"/>'
    urls = ''.join(f'\n  <url>\n    <loc>{page_url(site, c)}</loc>{links}\n    <changefreq>monthly</changefreq>'
                   f'\n    <priority>{"1.0" if c == "en" else "0.9"}</priority>\n  </url>' for c, _, _ in LANGS)
    with open(os.path.join(ROOT, 'sitemap.xml'), 'w', encoding='utf-8') as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
                'xmlns:xhtml="http://www.w3.org/1999/xhtml">' + urls + '\n</urlset>\n')
    with open(os.path.join(ROOT, 'robots.txt'), 'w') as f:
        f.write(f'User-agent: *\nAllow: /\nDisallow: /i18n/\n\nSitemap: {site}sitemap.xml\n')

    print('Built', len(LANGS), 'languages for', site)
    for code, miss in report.items():
        print(f'  {code}: ' + ('complete' if not miss else f'{len(miss)} untranslated: ' + '; '.join(m[:40] for m in miss[:6])))


if __name__ == '__main__':
    build()

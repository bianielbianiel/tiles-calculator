#!/bin/bash
# Change the site address used for SEO (canonical, hreflang, sitemap, social cards, 404 page)
# and rebuild every language page.
# Usage: ./set-site-url.sh https://<user>.github.io/<repo>/
#        ./set-site-url.sh https://www.your-domain.com/
set -e
cd "$(dirname "$0")"
[ -z "$1" ] && { echo "Usage: $0 https://<user>.github.io/<repo>/"; exit 1; }
NEW="${1%/}/"
python3 - "$NEW" <<'PY'
import json, sys
json.dump({"site_url": sys.argv[1]}, open('i18n/config.json', 'w'), indent=1)
PY
PATH_PART="/$(echo "$NEW" | sed -E 's#https?://[^/]+/?##')"
sed -i "s#<base href=\"[^\"]*\">#<base href=\"${PATH_PART}\">#" 404.html
python3 build_i18n.py

#!/bin/bash
# Change the site address used for SEO (canonical, sitemap, social cards, 404 page).
# Usage: ./set-site-url.sh https://<user>.github.io/<repo>/
#        ./set-site-url.sh https://www.your-domain.com/
set -e
NEW="${1%/}/"
OLD=$(grep -o 'rel="canonical" href="[^"]*"' index.html | head -1 | sed 's/.*href="//;s/"$//')
[ -z "$1" ] && { echo "Usage: $0 https://<user>.github.io/<repo>/"; exit 1; }
for f in index.html robots.txt sitemap.xml; do sed -i "s#${OLD}#${NEW}#g" "$f"; done
# 404 page needs the path part of the address (e.g. /repo/ or /)
PATH_PART="/$(echo "$NEW" | sed -E 's#https?://[^/]+/?##')"
sed -i "s#<base href=\"[^\"]*\">#<base href=\"${PATH_PART}\">#" 404.html
echo "Site URL changed: $OLD -> $NEW"

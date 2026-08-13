#!/usr/bin/env bash
# One-time font fetcher for the Verdana Health design system.
# Downloads the exact WOFF2 files used by Google Fonts' latin subset and
# records the Google Fonts CSS for traceability. Committed once; fonts are
# then bundled by Vite ?url imports (no runtime CDN dependency).
set -euo pipefail
cd "$(dirname "$0")"

UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

fetch_css() {
  local family="$1"
  curl -s -A "$UA" "https://fonts.googleapis.com/css2?family=${family}&display=swap" \
    > "google-fonts-${family%%:*}.css"
}

fetch_css "Plus+Jakarta+Sans:wght@500;600;700"
fetch_css "DM+Sans:wght@400;500;700"
fetch_css "Fira+Code:wght@400;500"

# Extract woff2 URLs from the recorded CSS (latin subset blocks only) and
# download each to a flat filename derived from the URL hash.
grep -o 'https://fonts.gstatic.com/[^)]*\.woff2' google-fonts-*.css \
  | sort -u \
  | while read -r url; do
      name="$(basename "$url")"
      [ -f "$name" ] || curl -s -A "$UA" -o "$name" "$url"
    done

echo "downloaded: $(ls -1 *.woff2 2>/dev/null | wc -l) woff2 files"
ls -1 *.woff2 2>/dev/null

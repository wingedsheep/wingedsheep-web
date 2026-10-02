#!/bin/sh
# Renders the blog figures drawn in HTML here to WebP, with headless Chrome.
# Each page names its output and size: <meta name="render" content="<webp path> <width> <height>">
set -e
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
tmp="${TMPDIR:-/tmp}/blog-figure.png"
for page in tools/blog/*.html; do
    set -- $(sed -n 's/.*<meta name="render" content="\([^"]*\)".*/\1/p' "$page")
    [ -n "$1" ] || continue
    "$chrome" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --virtual-time-budget=3000 \
        --window-size="$2,$3" --screenshot="$tmp" "file://$PWD/$page" 2>/dev/null
    cwebp -quiet -q 80 -resize "$(( $2 * 3 / 2 ))" 0 "$tmp" -o "$1"
    echo "$page → $1"
done

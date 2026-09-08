#!/usr/bin/env bash
#
# Derives everything the site draws from the three brand originals.
#
# The originals live in `assets-src/brand/` rather than `static/`, because they
# are 2.2MB of print-resolution PNG that nothing should ever be served: the
# files under `static/brand/` are what the pages load, and they are built from
# here. Re-run this after replacing an original — the outputs are committed, so
# a deploy never needs ImageMagick.
#
#   npm run brand:assets
#
# Three things happen to each original, and the middle one is the interesting
# one.
#
# 1. The white ground is knocked out and the result trimmed. Both wide files
#    are RGB with the background baked in, so left alone they render as a white
#    slab on a dark page.
#
# 2. A dark-theme variant is generated. The wordmarks are black text beside a
#    red mark, and black text on a dark page is invisible — but negating the
#    whole image turns the red cyan. So the negation is masked to the greyscale
#    parts only: a pixel is "the mark" when it is both saturated *and* light.
#    Saturation alone is not enough. These PNGs carry compression noise, and
#    inside a black glyph a pixel like rgb(10,2,3) is highly saturated while
#    being nothing like red — a saturation-only mask leaves the heavy wordmark
#    visibly speckled with black. The lightness gate is what removes it.
#
# 3. Everything is exported as WebP at roughly 3x its largest on-screen size.
#
# The square mark needs none of this: it ships RGBA with real transparency and
# reads correctly on either theme, so it is only trimmed and resized.
set -euo pipefail

cd "$(dirname "$0")/.."

SRC=assets-src/brand
OUT=static/brand
mkdir -p "$OUT"

# Saturated *and* light — see (2) above.
mask() {
	magick "$1" -alpha off -colorspace HSL \
		\( -clone 0 -channel G -separate +channel -threshold 25% \) \
		\( -clone 0 -channel B -separate +channel -threshold 20% \) \
		-delete 0 -compose multiply -composite -morphology close disk:2 "$2"
}

# $1 source PNG, $2 output basename, $3 export height, $4 optional crop % of width
wide() {
	local src=$1 name=$2 height=$3 keep=${4:-100}
	local tmp
	tmp=$(mktemp -d)
	trap 'rm -rf "$tmp"' RETURN

	# The border restores a little breathing room; -trim leaves glyphs flush
	# against the edge, which crops the outermost glyphs in a flex row.
	magick "$src" -fuzz 8% -transparent white -trim +repage \
		-gravity west -crop "${keep}%x100%+0+0" +repage \
		-bordercolor none -border 12 "$tmp/flat.png"

	mask "$tmp/flat.png" "$tmp/mask.png"

	# Negated everywhere, then the original painted back wherever the mask says
	# "this is the mark", then the original's alpha restored on top.
	magick \( "$tmp/flat.png" -channel RGB -negate +channel \) "$tmp/flat.png" "$tmp/mask.png" -composite \
		\( "$tmp/flat.png" -alpha extract \) -alpha off -compose CopyOpacity -composite "$tmp/dark.png"

	magick "$tmp/flat.png" -resize "x${height}>" -define webp:lossless=false -quality 90 "$OUT/$name.webp"
	magick "$tmp/dark.png" -resize "x${height}>" -define webp:lossless=false -quality 90 "$OUT/$name-dark.webp"
}

# 73%, which cuts the artwork just before the rule that separates the lockup
# from its four-line strapline.
#
# The strapline goes, everywhere. It is set at about a twelfth of the lockup's
# height, so at the sizes this site actually draws a logo — 44px in the header,
# 32px in the footer, 48px on the sign-in pages — it renders as four grey
# smudges rather than as words. Shipping it would be shipping noise; the full
# lockup stays in assets-src/ for print, where it has the room it was drawn for.
#
# To re-derive the number after replacing the original: the crop is the last
# inked column before the divider, over the trimmed width. `-alpha extract`
# resized to one row prints a per-column ink profile that makes both obvious.
wide "$SRC/wordmark.png" wordmark 320 73

# The partner lockup gets no dark variant, on purpose.
#
# Half of it is somebody else's logo. Negating the greyscale parts turns the
# white knockout inside Digital Construct's "D" into a hole and leaves their
# navy wordmark at about 1.5:1 against a dark footer — a recolour of a brand
# that is not ours to recolour. The footer draws this one on a light plate
# instead, so both marks stay exactly as their owners drew them.
magick "$SRC/partners.png" -fuzz 8% -transparent white -trim +repage \
	-bordercolor none -border 12 -resize 'x320>' -quality 90 "$OUT/partners.webp"

# Already transparent, already square, correct on both themes.
magick "$SRC/mark.png" -trim +repage -resize '512x512>' -quality 90 "$OUT/mark.webp"

# Tab and home-screen icons. PNG rather than WebP: Safari still refuses a WebP
# apple-touch-icon, and an .ico is not worth the extra file when every browser
# that matters reads a sized PNG.
magick "$SRC/mark.png" -trim +repage -resize 48x48 -background none -gravity center -extent 48x48 static/favicon.png
magick "$SRC/mark.png" -trim +repage -resize 180x180 -background none -gravity center -extent 180x180 static/apple-touch-icon.png

echo "Brand assets written to $OUT and static/:"
ls -la "$OUT" static/favicon.png static/apple-touch-icon.png

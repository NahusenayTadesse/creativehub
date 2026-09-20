#!/usr/bin/env bash
#
# Derives everything the site draws from the brand originals.
#
# The originals live in `assets-src/brand/` rather than `static/`, because they
# are megabytes of print-resolution PNG that nothing should ever be served: the
# files under `static/brand/` are what the pages load, and they are built from
# here. Re-run this after replacing an original — the outputs are committed, so
# a deploy never needs ImageMagick.
#
#   npm run brand:assets
#
# The originals:
#
#   wordmark.png   the lockup — illustrated icon, gradient dot, "influencer"
#                  in navy and "ETHIOPIA" in slate — on a transparent ground
#   mark.png       the illustrated icon alone, transparent
#   partners.png   the co-branded lockup with Digital Construct (see below)
#   wordmark-on-white.png, wordmark-lowercase-on-white.png
#                  the same lockup flattened onto white, kept for print; the
#                  site does not use them
#   previous/      the red-mark identity these replaced
#
# The site's colour tokens in `src/routes/layout.css` are sampled from these
# files — navy #001020, slate #384860, and the dot's emerald-to-ocean gradient
# — so a new identity means revisiting that palette, not only re-running this.
set -euo pipefail

cd "$(dirname "$0")/.."

SRC=assets-src/brand
OUT=static/brand
ICONS=static/icons
SPLASH=static/icons/splash
mkdir -p "$OUT"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# ---------------------------------------------------------------- wordmark
#
# The light-theme copy is the original, trimmed. The dark-theme copy is the one
# with work in it: navy and slate text disappear on a dark ground, but the
# illustrated icon and the gradient dot must not change at all. So only pixels
# that are both right of the icon *and* low in chroma are recoloured — the icon
# is excluded by position (its white shirts and black backpacks are as colourless
# as the text), the dot by its chroma.
#
# Chroma, not HSL saturation: the navy is #001020, and a colour that dark is
# nearly 100% "saturated" in HSL terms — all of what little colour it has is
# blue — so a saturation mask leaves "influencer" navy on a navy page.
#
# SPLIT is where the icon ends, as a share of the trimmed width: the middle of
# the empty columns between the icon and the "i". To re-derive it after
# replacing the original, look for the gap in the alpha channel's per-column
# profile between a quarter and a half of the way across.
SPLIT=34.5

magick "$SRC/wordmark.png" -trim +repage -bordercolor none -border 12 "$tmp/flat.png"
W=$(magick identify -format '%w' "$tmp/flat.png")
H=$(magick identify -format '%h' "$tmp/flat.png")
X=$(awk -v w="$W" -v s="$SPLIT" 'BEGIN { printf "%d", 12 + (w - 24) * s / 100 }')

# White where the text is: chroma under 25% (navy is 13%, slate 16%, the dot's
# emerald and ocean ends 65–85%) and right of X.
magick "$tmp/flat.png" -alpha off -colorspace HCL -channel G -separate +channel \
	-threshold 25% -negate \
	\( -size "${W}x${H}" xc:white -fill black -draw "rectangle 0,0 $X,$H" \) \
	-compose multiply -composite "$tmp/text-mask.png"

# The text, lightened: inverted to greyscale so navy becomes near-white and slate
# a mid grey, then cooled a touch so it sits with the palette rather than
# reading as plain grey on navy.
magick "$tmp/flat.png" -alpha off -channel RGB -negate +channel -colorspace Gray \
	-colorspace sRGB -fill '#dbe8f7' -colorize 18% "$tmp/text-light.png"

magick "$tmp/flat.png" -alpha off "$tmp/text-light.png" "$tmp/text-mask.png" -composite \
	\( "$tmp/flat.png" -alpha extract \) -alpha off -compose CopyOpacity -composite "$tmp/dark.png"

# About 3x the largest drawn height: 44px in the header, 48px on sign-in.
magick "$tmp/flat.png" -resize 'x320>' -quality 90 "$OUT/wordmark.webp"
magick "$tmp/dark.png" -resize 'x320>' -quality 90 "$OUT/wordmark-dark.webp"

# ---------------------------------------------------------------- mark

# Already transparent and square, and full colour on either theme.
magick "$SRC/mark.png" -trim +repage -resize '512x512>' -quality 90 "$OUT/mark.webp"

# Tab and home-screen icons. PNG rather than WebP: Safari still refuses a WebP
# apple-touch-icon, and an .ico is not worth the extra file when every browser
# that matters reads a sized PNG.
magick "$SRC/mark.png" -trim +repage -resize 48x48 -background none -gravity center -extent 48x48 static/favicon.png
magick "$SRC/mark.png" -trim +repage -resize 180x180 -background none -gravity center -extent 180x180 static/apple-touch-icon.png

# ---------------------------------------------------------------- app icons
#
# What a phone draws on its home screen once the site is installed. Two plain
# sizes, because the manifest wants a small one for the launcher and a large one
# for the splash screen; both are `any`, transparent, drawn as they are.
mkdir -p "$ICONS"
magick "$SRC/mark.png" -trim +repage -resize 192x192 -background none -gravity center -extent 192x192 "$ICONS/icon-192.png"
magick "$SRC/mark.png" -trim +repage -resize 512x512 -background none -gravity center -extent 512x512 "$ICONS/icon-512.png"

# The maskable copy is a different picture, not a resize of those two.
#
# Android crops a maskable icon to whatever shape the launcher uses — circle,
# squircle, teardrop — and only the middle 80% is guaranteed to survive it. So
# the mark is drawn at 60% of the canvas and centred, which leaves room for the
# worst of those crops, and the transparency is filled with the brand navy: a
# maskable icon is never composited over anything, so a transparent one comes
# out as the mark floating on whatever the launcher chose.
magick "$SRC/mark.png" -trim +repage -resize 308x308 -background '#001020' -gravity center -extent 512x512 "$ICONS/icon-maskable-512.png"

# ---------------------------------------------------------------- iOS splash
#
# The screen iOS shows while an installed app starts.
#
# Android takes the manifest's icon and colours and composes one itself. iOS
# does neither: without these it shows a white rectangle for as long as the app
# takes to boot, which is the single most "this is a web page" moment an
# installed app has.
#
# Each file is an exact device resolution — iOS matches them on pixel size, and
# anything that does not match one is ignored rather than scaled. The list is
# the sizes in use rather than every size ever shipped: one per modern iPhone
# family, in both orientations, plus the two common iPad widths. The mark is
# drawn at a fifth of the shorter edge on the brand ground, which is what the
# manifest's `background_color` gives Android.
mkdir -p "$SPLASH"
for size in 1179x2556 2556x1179 1290x2796 2796x1290 1170x2532 2532x1170 \
	1284x2778 2778x1284 1125x2436 2436x1125 1242x2688 2688x1242 \
	828x1792 1792x828 750x1334 1334x750 1640x2360 2360x1640 1668x2388 2388x1668; do
	w=${size%x*}
	h=${size#*x}
	short=$((w < h ? w : h))
	mark=$((short / 5))
	magick "$SRC/mark.png" -trim +repage -resize "${mark}x${mark}" \
		-background '#f2f5f9' -gravity center -extent "${w}x${h}" "$SPLASH/splash-${w}x${h}.png"
done

# ---------------------------------------------------------------- partners
#
# The co-branded lockup has no new original, so it is rebuilt: the new wordmark
# on the left, and the "×" and Digital Construct's mark cut from the existing
# lockup on the right, untouched. Their half is somebody else's logo, so it is
# cropped and never recoloured, and the footer draws the result on a light
# plate in both themes. The four-word strapline under the old lockup is left
# out — at footer size it rendered as a grey smudge rather than as words.
#
# The crop is the top row of partners.png from just before the "×": columns
# 860–1700, rows 260–560. Their half is drawn at 70% of our wordmark's height:
# their mark is a solid block while ours is mostly illustration and letterforms,
# and at equal heights theirs reads as the larger partner.
magick "$tmp/flat.png" -trim +repage -resize 'x600' "$tmp/ours.png"
magick "$SRC/partners.png" -crop 840x300+860+260 +repage \
	-fuzz 8% -transparent white -trim +repage -resize 'x420' "$tmp/theirs.png"
magick "$tmp/ours.png" \( -size 60x1 xc:none \) "$tmp/theirs.png" -background none -gravity center +append \
	-bordercolor none -border 12 -resize 'x320>' -quality 90 "$OUT/partners.webp"

echo "Brand assets written to $OUT, $ICONS and static/:"
ls -la "$OUT" "$ICONS" static/favicon.png static/apple-touch-icon.png
echo "$(ls -1 "$SPLASH" | wc -l) iOS splash screens in $SPLASH"
echo
echo "Now bump BRAND_VERSION in src/lib/brand.ts — Cloudflare keeps the old files for a week."

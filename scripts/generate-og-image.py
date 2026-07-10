#!/usr/bin/env python3
"""Generates the shared 1200x630 Open Graph / Twitter Card preview image used
across the marketing/listings pages (previously og:image pointed at the plain
logo SVG, which most link-unfurlers — Facebook, Telegram, iMessage — either
skip or render tiny/blank).

Composes the actual App Store icon (dark UyDosh navy square, red roof, white
"U" glyph) onto a branded card with the wordmark and tagline, reusing the same
brand palette as the website's CSS (`--bg`, `--brand`, `--muted`).

Usage:
    python3 scripts/generate-og-image.py

Regenerates:
    images/og-image.png
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
IMAGES_DIR = ROOT / "images"
ICON_SRC = IMAGES_DIR / "uydosh-app-icon-1024.png"
OUT_PATH = IMAGES_DIR / "og-image.png"

WIDTH, HEIGHT = 1200, 630
BG = (6, 21, 37)  # matches CSS --bg: #061525
BLUE_GLOW = (0, 66, 110)  # matches CSS --blue: #00426e
RED_GLOW = (225, 29, 46)
BRAND_RED = (255, 0, 0)
FG_WHITE = (235, 240, 247)
MUTED = (168, 182, 201)

FONT_DIR = Path("/System/Library/Fonts/Supplemental")
FONT_BOLD = FONT_DIR / "Arial Bold.ttf"
FONT_REGULAR = FONT_DIR / "Arial.ttf"


def add_radial_glow(
    pixels: np.ndarray,
    center: tuple[float, float],
    radius: float,
    color: tuple[int, int, int],
    peak_alpha: float,
) -> None:
    """Blends a smooth per-pixel radial gradient into `pixels` (float32 HxWx3),
    mirroring the CSS `radial-gradient(...)` glows used in the site's own
    `body` background — avoids the hard-edged look of a blurred filled shape."""
    ys, xs = np.mgrid[0:HEIGHT, 0:WIDTH]
    dist = np.sqrt((xs - center[0]) ** 2 + (ys - center[1]) ** 2) / radius
    alpha = np.clip(1.0 - dist, 0.0, 1.0) ** 1.6 * peak_alpha
    color_arr = np.array(color, dtype=np.float32)
    pixels += alpha[..., None] * (color_arr - pixels)


def build_background() -> Image.Image:
    pixels = np.full((HEIGHT, WIDTH, 3), BG, dtype=np.float32)
    add_radial_glow(pixels, (WIDTH * 0.15, 0), 780, BLUE_GLOW, 0.55)
    add_radial_glow(pixels, (WIDTH * 0.85, HEIGHT * 0.15), 620, (96, 165, 250), 0.16)
    add_radial_glow(pixels, (WIDTH * 0.94, HEIGHT * 0.92), 560, RED_GLOW, 0.16)
    return Image.fromarray(np.clip(pixels, 0, 255).astype("uint8"))


def rounded_icon(size: int, radius_ratio: float = 0.22) -> Image.Image:
    icon = Image.open(ICON_SRC).convert("RGBA").resize((size, size), Image.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size, size], radius=int(size * radius_ratio), fill=255
    )
    icon.putalpha(mask)
    return icon


def main() -> None:
    canvas = build_background()

    icon_size = 300
    icon = rounded_icon(icon_size)
    icon_x, icon_y = 96, (HEIGHT - icon_size) // 2
    canvas.paste(icon, (icon_x, icon_y), icon)

    draw = ImageDraw.Draw(canvas)
    text_x = icon_x + icon_size + 72

    wordmark_font = ImageFont.truetype(str(FONT_BOLD), 108)
    tagline_font = ImageFont.truetype(str(FONT_REGULAR), 36)

    uy_w = draw.textlength("Uy", font=wordmark_font)
    wordmark_y = HEIGHT // 2 - 100
    draw.text((text_x, wordmark_y), "Uy", font=wordmark_font, fill=BRAND_RED)
    draw.text((text_x + uy_w, wordmark_y), "Dosh", font=wordmark_font, fill=FG_WHITE)

    draw.text(
        (text_x, wordmark_y + 128),
        "Ijara toping. Ulaning. Ko\u2018ching.",
        font=tagline_font,
        fill=MUTED,
    )

    canvas.save(OUT_PATH, "PNG")
    print(f"wrote {OUT_PATH.relative_to(ROOT)} ({OUT_PATH.stat().st_size} bytes)")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Stamps the UyDosh logo mark (the red roof + white "U" chimney glyph, no
background pill, no wordmark) onto the generic "no photo" placeholder
illustrations used by the Telegram Mini App, so they read as official UyDosh
artwork rather than a random stock photo.

Requires the `rsvg-convert` binary (brew install librsvg) to rasterize the
vector logo at high resolution.

Usage:
    python3 scripts/watermark-generic-images.py

Regenerates the four images in place:
    images/no-photo-room-needed-male.jpg
    images/no-photo-room-needed-female.jpg
    images/no-photo-roommate-needed-male.jpg
    images/no-photo-roommate-needed-female.jpg
"""

import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
IMAGES_DIR = ROOT / "images"
LOGO_SVG = ROOT / "images" / "uydosh-logo.svg"

TARGETS = [
    ("no-photo-room-needed-male.jpg", "white"),
    ("no-photo-room-needed-female.jpg", "black"),
    ("no-photo-roommate-needed-male.jpg", "white"),
    ("no-photo-roommate-needed-female.jpg", "black"),
]

LOGO_OPACITY = 0.88
LOGO_HEIGHT_RATIO = 0.16  # logo height as a fraction of the photo height
MARGIN_RATIO = 0.035  # margin from the edges as a fraction of photo height
EXTRA_LEFT_SHIFT_PX = 24  # additional horizontal-only nudge away from the right edge

SHADOW_BLUR = 6
SHADOW_ALPHA = 0.55
SHADOW_OFFSET = (0, 3)


def render_logo(render_px: int, u_color: str = "white") -> Image.Image:
    """Rasterizes the vector logo (transparent bg) at a large size, then
    crops to its opaque bounding box so no extra padding is baked in.

    `u_color` overrides the fill of the "U" glyph (the `.fil1` class in the
    source SVG) while the roof (`.fil2`, red) is left untouched.
    """

    svg_source = LOGO_SVG.read_text().replace(
        ".fil1 {fill:white;", f".fil1 {{fill:{u_color};"
    )

    with tempfile.NamedTemporaryFile(
        suffix=".svg", mode="w"
    ) as tmp_svg, tempfile.NamedTemporaryFile(suffix=".png") as tmp_png:
        tmp_svg.write(svg_source)
        tmp_svg.flush()

        subprocess.run(
            [
                "rsvg-convert",
                # Only the width is pinned; height is left for rsvg-convert to
                # derive from the SVG's native aspect ratio. Forcing both `-w`
                # and `-h` to the same value stretches the artwork into a
                # square and distorts the "U" glyph.
                "-w",
                str(render_px),
                "-o",
                tmp_png.name,
                tmp_svg.name,
            ],
            check=True,
        )
        logo = Image.open(tmp_png.name).convert("RGBA")
        logo.load()

    return logo.crop(logo.getbbox())


def with_shadow(logo: Image.Image) -> Image.Image:
    """Adds a soft dark drop shadow behind the glyph so the white "U" stays
    legible on light backgrounds and the red roof pops on dark ones."""

    pad = SHADOW_BLUR * 3
    canvas = Image.new(
        "RGBA", (logo.width + pad * 2, logo.height + pad * 2), (0, 0, 0, 0)
    )

    shadow_alpha = logo.split()[3].point(lambda a: int(a * SHADOW_ALPHA))
    shadow_shape = Image.new("RGBA", logo.size, (0, 0, 0, 255))
    shadow_shape.putalpha(shadow_alpha)

    shadow_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    shadow_layer.alpha_composite(
        shadow_shape, (pad + SHADOW_OFFSET[0], pad + SHADOW_OFFSET[1])
    )
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(SHADOW_BLUR))

    canvas.alpha_composite(shadow_layer)
    canvas.alpha_composite(logo, (pad, pad))
    return canvas


def stamp(image_path: Path, base_logo: Image.Image) -> None:
    photo = Image.open(image_path).convert("RGBA")

    target_h = int(photo.height * LOGO_HEIGHT_RATIO)
    scale = target_h / base_logo.height
    logo = base_logo.resize(
        (max(1, round(base_logo.width * scale)), target_h), Image.LANCZOS
    )
    watermark = with_shadow(logo)

    scaled_alpha = watermark.split()[3].point(lambda a: int(a * LOGO_OPACITY))
    watermark.putalpha(scaled_alpha)

    margin = int(photo.height * MARGIN_RATIO)
    x = photo.width - watermark.width - margin - EXTRA_LEFT_SHIFT_PX
    y = photo.height - watermark.height - margin

    photo.alpha_composite(watermark, (x, y))
    photo.convert("RGB").save(image_path, quality=92)
    print(f"watermarked {image_path.relative_to(ROOT)}")


def main() -> None:
    logos_by_color = {}
    for name, u_color in TARGETS:
        if u_color not in logos_by_color:
            logos_by_color[u_color] = render_logo(render_px=1200, u_color=u_color)
        stamp(IMAGES_DIR / name, logos_by_color[u_color])


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Generate app icons and the default link preview for Dynasty Ticker."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

REPO = Path(__file__).resolve().parents[1]
DOCS = REPO / "docs"
FONTS = REPO / "netlify" / "fonts"
PAPER, INK, GREEN, RULE = "#fafaf7", "#202c29", "#146248", "#daddd5"
# Masthead mark on a 24 by 20 grid.
BARS = (
    ((3, 11), (1, 19), (5, 19), (7, 11)),
    ((11, 6), (8, 19), (12, 19), (15, 6)),
    ((19, 1), (15, 19), (19, 19), (23, 1)),
)


def font(size, weight):
    return ImageFont.truetype(str(FONTS / f"instrument-sans-{weight}.ttf"), size)


def mark(size):
    # Draw above target resolution for smooth diagonals on small icons.
    canvas = Image.new("RGBA", (size * 4, size * 4))
    draw = ImageDraw.Draw(canvas)
    scale = canvas.width / 28
    for bar in BARS:
        draw.polygon([((x + 2) * scale, (y + 4) * scale) for x, y in bar], fill=GREEN)
    return canvas.resize((size, size), Image.Resampling.LANCZOS)


def make_icons():
    svg = (DOCS / "brand/compact-mark.svg").read_bytes()
    (DOCS / "favicon.svg").write_bytes(svg)
    mark(32).save(DOCS / "favicon-32.png")
    mark(128).save(DOCS / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    apple = Image.new("RGB", (180, 180), PAPER)
    icon = mark(156)
    apple.paste(icon, (12, 12), icon)
    apple.save(DOCS / "apple-touch-icon.png", optimize=True)


def make_og_image():
    image = Image.new("RGB", (1200, 630), PAPER)
    draw = ImageDraw.Draw(image)
    badge = mark(72)
    image.paste(badge, (70, 65), badge)
    draw.text((155, 67), "Dynasty Ticker", font=font(55, 700), fill=INK)
    draw.line((76, 168, 1124, 168), fill=RULE, width=2)
    draw.text((76, 220), "Player rankings", font=font(76, 700), fill=INK)
    draw.text((76, 328), "Trade calculator  /  League history", font=font(38, 400), fill=INK)
    draw.text((76, 513), "12-team Superflex  ·  Full PPR", font=font(28, 400), fill=GREEN)
    image.save(DOCS / "og-image.jpg", quality=88, optimize=True, progressive=True)


if __name__ == "__main__":
    make_icons()
    make_og_image()

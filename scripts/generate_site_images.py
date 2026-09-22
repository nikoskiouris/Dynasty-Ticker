#!/usr/bin/env python3
"""Paint the Ice Box favicon, apple-touch icon, and Open Graph card."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1] / "docs"
FONT_BOLD = Path("/usr/share/fonts/truetype/macos/Inter-Bold.ttf")
FONT_SEMI = Path("/usr/share/fonts/truetype/macos/Inter-SemiBold.ttf")
FONT_MED = Path("/usr/share/fonts/truetype/macos/Inter-Medium.ttf")

BG = (238, 243, 247, 255)
TEXT = (21, 32, 43, 255)
MUTED = (91, 107, 124, 255)
BLUE = (31, 134, 239, 255)
BLUE_SOFT = (94, 182, 255, 255)
WHITE = (255, 255, 255, 255)


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size)


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def paint_mark(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=int(size * 0.28), fill=BLUE_SOFT)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=int(size * 0.28), fill=None)
    gradient = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(gradient)
    for y in range(size):
        t = y / max(size - 1, 1)
        r = int(94 + (31 - 94) * t)
        g = int(182 + (134 - 182) * t)
        b = int(255 + (239 - 255) * t)
        gdraw.line([(0, y), (size, y)], fill=(r, g, b, 255))
    mask = rounded_mask((size, size), int(size * 0.28))
    gradient.putalpha(mask)
    img = Image.alpha_composite(img, gradient)
    draw = ImageDraw.Draw(img)
    mark_font = font(FONT_BOLD, int(size * 0.58))
    letter = "D"
    bbox = draw.textbbox((0, 0), letter, font=mark_font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((size - tw) / 2 - bbox[0], (size - th) / 2 - bbox[1] - size * 0.03), letter, font=mark_font, fill=WHITE)
    return img


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    rgb = image.convert("RGBA")
    rgb.save(path, format="PNG", optimize=True)


def make_favicon_svg() -> None:
    (ROOT / "favicon.svg").write_text(
        """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#5eb6ff"/>
      <stop offset="1" stop-color="#1f86ef"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="18" fill="url(#g)"/>
  <text x="32" y="44" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="800" text-anchor="middle" fill="#ffffff">D</text>
</svg>
""",
        encoding="utf-8",
    )


def make_icons() -> None:
    apple = paint_mark(180)
    save_png(apple, ROOT / "apple-touch-icon.png")
    fav32 = paint_mark(32)
    save_png(fav32, ROOT / "favicon-32.png")
    ico_base = paint_mark(256)
    ico_base.save(
        ROOT / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )


def make_og_image() -> None:
    width, height = 1200, 630
    img = Image.new("RGBA", (width, height), BG)
    glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.ellipse((620, -220, 1380, 420), fill=(94, 182, 255, 70))
    gdraw.ellipse((-120, 280, 520, 820), fill=(147, 197, 253, 80))
    gdraw.ellipse((420, 240, 980, 720), fill=(255, 255, 255, 90))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(42)))

    card = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    cdraw = ImageDraw.Draw(card)
    margin = 48
    cdraw.rounded_rectangle((margin, margin, width - margin, height - margin), radius=36, fill=(255, 255, 255, 210))
    img = Image.alpha_composite(img, card)

    draw = ImageDraw.Draw(img)
    mark = paint_mark(88)
    img.paste(mark, (88, 96), mark)

    eyebrow = font(FONT_SEMI, 22)
    title = font(FONT_BOLD, 58)
    lede = font(FONT_MED, 28)
    chip = font(FONT_SEMI, 20)
    url_font = font(FONT_MED, 20)

    draw.text((200, 108), "DYNASTY TICKER", font=eyebrow, fill=BLUE)
    draw.text((88, 214), "Your league, on a", font=title, fill=TEXT)
    draw.text((88, 286), "live ticker.", font=title, fill=TEXT)
    draw.text((88, 372), "Scores, rosters, trades, and history in one desk.", font=lede, fill=MUTED)

    chips = ["Live scores", "Sit / start", "Trade match"]
    x = 88
    chip_bg = (214, 234, 252, 255)
    for label in chips:
        bbox = draw.textbbox((0, 0), label, font=chip)
        tw = bbox[2] - bbox[0]
        pad_x = 16
        box = (x, 450, x + tw + pad_x * 2, 450 + 42)
        draw.rounded_rectangle(box, radius=14, fill=chip_bg)
        draw.text((x + pad_x, 458), label, font=chip, fill=BLUE)
        x = box[2] + 12

    draw.text((88, 528), "dynastyticker.com", font=url_font, fill=MUTED)
    jpeg = img.convert("RGB")
    jpeg.save(ROOT / "og-image.jpg", format="JPEG", quality=82, optimize=True, progressive=True)


def main() -> None:
    make_favicon_svg()
    make_icons()
    make_og_image()
    for name in ("og-image.jpg", "apple-touch-icon.png", "favicon.ico", "favicon-32.png", "favicon.svg"):
        path = ROOT / name
        print(f"{name}\t{path.stat().st_size}")


if __name__ == "__main__":
    main()

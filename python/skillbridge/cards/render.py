"""Server-side share card: 1200x630 PNG in the app's design tokens.

Rendered with Pillow so the download is pixel-identical everywhere
(docs/05_DESIGN.md §8). Colors mirror web/styles.css.
"""

import io

from PIL import Image, ImageDraw, ImageFont

BG = (16, 19, 18)
SURFACE = (20, 25, 23)
BORDER = (35, 40, 38)
TEXT = (232, 236, 233)
TEXT2 = (138, 148, 142)
TEXT3 = (111, 122, 116)
ACCENT = (46, 224, 138)

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "C:/Windows/Fonts/arial.ttf",
]
FONT_BOLD_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
]


def _font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    for path in FONT_BOLD_CANDIDATES if bold else FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def render_card(bom: dict) -> bytes:
    img = Image.new("RGB", (1200, 630), BG)
    d = ImageDraw.Draw(img)

    d.text((60, 48), "SKILLBRIDGE", font=_font(22, bold=True), fill=TEXT2)
    if bom.get("synthetic"):
        d.text((1140, 48), "DEMO DATA", font=_font(20, bold=True), fill=TEXT3, anchor="ra")

    d.text((60, 130), "My career escape plan", font=_font(26), fill=TEXT2)
    headline = f"{bom['from_title']}  \u2192  {bom['to_title']}"
    size = 44
    while size > 22 and d.textlength(headline, font=_font(size, bold=True)) > 560:
        size -= 2
    d.text((60, 175), headline, font=_font(size, bold=True), fill=TEXT)

    wage = bom.get("wage_delta")
    minus = "\u2212"
    if wage is not None:
        sign = "+" if wage >= 0 else minus
        wage_text = f"{sign}${abs(round(wage)):,}/yr"
    else:
        wage_text = "wage: n/a"
    d.text((60, 270), wage_text, font=_font(64, bold=True), fill=ACCENT)

    exp = bom.get("exposure_delta")
    if exp is not None:
        arrow = "lower" if exp < 0 else "higher"
        d.text(
            (60, 360),
            f"AI exposure: {arrow} ({round(exp * 100):+d} percentile points)",
            font=_font(26),
            fill=TEXT2,
        )

    to_learn = (bom.get("acquire", []) + bom.get("upgrade", []))[:3]
    d.rounded_rectangle((640, 130, 1140, 430), radius=16, fill=SURFACE, outline=BORDER)
    d.text((672, 158), "Skills to learn first", font=_font(24), fill=TEXT2)
    y = 210
    for item in to_learn:
        d.ellipse((672, y + 8, 686, y + 22), fill=ACCENT)
        d.text((704, y), str(item["skill"]), font=_font(28), fill=TEXT)
        y += 62
    if not to_learn:
        d.text((672, 210), "You already have the skills.", font=_font(28), fill=TEXT)

    d.line((60, 520, 1140, 520), fill=BORDER, width=1)
    d.text(
        (60, 545),
        "Data: O*NET (USDOL/ETA, CC BY 4.0) · BLS OEWS · AIOE · OpenAI · Microsoft Research",
        font=_font(20),
        fill=TEXT3,
    )
    d.text(
        (60, 578),
        "Estimates from public data - not career advice. Built with SkillBridge.",
        font=_font(20),
        fill=TEXT3,
    )

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()

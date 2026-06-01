"""
Hablaya logo generator — "ñ" with playful tilde.

Concept: a chunky lowercase Spanish ñ on deep-teal canvas.
- The "n" body is friendly: rounded stems, soft arch, slight terminal-flick
  on each stem-foot for a hand-drawn (not math-perfect) feel.
- The tilde above the n is the hero: an asymmetric, brush-stroke shape in
  coral, slightly larger than a "correct" tilde — playing the role of a
  smile / wave / character mark. It is what makes this feel "Spanish" and
  "playful" instead of just "lowercase n".
- All in brand-palette colors. No outlines, no gradients, no extra clutter.

Produces:
- assets/preview/icon.png         (1024x1024 full-bleed master)
- assets/preview/adaptive-icon.png (1024x1024 foreground only, transparent bg)
- assets/preview/splash-icon.png  (1024x1024 with margin)
- assets/preview/favicon.png      (192x192 web favicon)
- assets/preview/logo.svg         (scalable SVG with background)
- assets/preview/logo-mark.svg    (scalable SVG, transparent)

Run: python tools/generate-logo.py
"""
from PIL import Image, ImageDraw
from pathlib import Path

# ── Brand palette ──────────────────────────────────────────────────────────
DEEP_TEAL = "#1A7B72"
CORAL = "#E85D4A"
SOFT_ORANGE = "#F2994A"
WARM_WHITE = "#FAFAF8"

SIZE = 1024

# ── Geometry of the "ñ" on a 1024×1024 master ──────────────────────────────
# Letter body (the lowercase "n") sits a bit below center to leave room
# for the tilde at the top. The whole mark is shifted slightly down so the
# canvas feels balanced.

# n stems
STEM_WIDTH = 130
LEFT_STEM_X = 280
RIGHT_STEM_X = 1024 - LEFT_STEM_X - STEM_WIDTH  # = 614
STEM_TOP_Y = 480        # where the stems start (below the arch)
STEM_BOT_Y = 850        # baseline

# n arch (curved top connecting the two stems)
ARCH_TOP_Y = 360        # top of the arch
ARCH_OUTER_LEFT = LEFT_STEM_X
ARCH_OUTER_RIGHT = RIGHT_STEM_X + STEM_WIDTH  # 744
ARCH_INNER_LEFT = LEFT_STEM_X + STEM_WIDTH  # 410
ARCH_INNER_RIGHT = RIGHT_STEM_X              # 614

# Tilde — the playful hero element above the n.
# Hand-drawn brush stroke vibe: not a math-perfect sine wave but a
# slightly irregular "S" with thicker middle and rounded ends.
# Defined as a polygon traced from left-end → top edge → right-end →
# bottom edge → back to start.
TILDE_POLY_TOP = [
    (270, 250),  # left tip, upper edge
    (340, 200),  # rising left shoulder
    (470, 175),  # left peak (high point)
    (560, 195),  # crossing-down
    (650, 235),  # right valley
    (730, 235),  # right shoulder
    (790, 215),  # heading up to right tip
    (820, 230),  # right tip, upper edge
]
TILDE_POLY_BOTTOM = [
    (810, 295),  # right tip, lower edge
    (730, 305),
    (650, 305),
    (560, 270),
    (470, 245),
    (380, 270),
    (310, 305),  # left tip, lower edge
    (260, 290),
]


def _draw_n(draw: ImageDraw.ImageDraw, scale: float, margin: int, fill: str):
    """Draw the lowercase 'n' body."""

    def s(v):
        return int(v * scale + margin)

    # Left stem (rounded both ends — friendlier than square base)
    draw.rounded_rectangle(
        (s(LEFT_STEM_X), s(STEM_TOP_Y), s(LEFT_STEM_X + STEM_WIDTH), s(STEM_BOT_Y)),
        radius=int(STEM_WIDTH * scale / 2),
        fill=fill,
    )
    # Right stem
    draw.rounded_rectangle(
        (s(RIGHT_STEM_X), s(STEM_TOP_Y), s(RIGHT_STEM_X + STEM_WIDTH), s(STEM_BOT_Y)),
        radius=int(STEM_WIDTH * scale / 2),
        fill=fill,
    )
    # Arch — build it as an outer pill minus an inner pill (cut by the
    # background). We can't easily "cut" on a single Pillow draw, so we
    # construct it geometrically with two shapes.
    # Outer arch silhouette: a pill from (LEFT_STEM_X, ARCH_TOP_Y) to
    # (ARCH_OUTER_RIGHT, STEM_TOP_Y + STEM_WIDTH/2) — i.e., the curved cap.
    arch_outer = (
        s(ARCH_OUTER_LEFT),
        s(ARCH_TOP_Y),
        s(ARCH_OUTER_RIGHT),
        s(STEM_TOP_Y + STEM_WIDTH // 2),
    )
    draw.rounded_rectangle(
        arch_outer,
        radius=int((ARCH_OUTER_RIGHT - ARCH_OUTER_LEFT) * scale / 2),
        fill=fill,
    )


def _draw_arch_cutout(draw: ImageDraw.ImageDraw, scale: float, margin: int, bg_color: str):
    """Carve the hollow inside of the arch so the 'n' looks like a real n."""

    def s(v):
        return int(v * scale + margin)

    # Inner hollow — narrower pill inside the arch, in background color.
    # Extends downward so the gap between the two stems also shows the bg.
    inner_w = ARCH_INNER_RIGHT - ARCH_INNER_LEFT
    inner_top = ARCH_TOP_Y + 90       # offset down from arch top to create the wall thickness
    inner_bot = STEM_BOT_Y + 40       # extend below baseline so the bottom-between-stems is bg
    draw.rounded_rectangle(
        (s(ARCH_INNER_LEFT), s(inner_top), s(ARCH_INNER_RIGHT), s(inner_bot)),
        radius=int(inner_w * scale / 2),
        fill=bg_color,
    )


def _draw_tilde(draw: ImageDraw.ImageDraw, scale: float, margin: int, fill: str):
    """Draw the playful tilde — a hand-drawn brush-stroke shape above the n."""

    def s(point):
        x, y = point
        return (int(x * scale + margin), int(y * scale + margin))

    # Build the tilde as a single closed polygon traced clockwise:
    # along the top edge (left → right), then along the bottom edge (right → left).
    polygon = [s(p) for p in TILDE_POLY_TOP] + [s(p) for p in TILDE_POLY_BOTTOM]
    draw.polygon(polygon, fill=fill)


def draw_logo(canvas_size: int, *, with_background: bool, margin: int = 0) -> Image.Image:
    """Render the Hablaya 'ñ' logo at the given canvas size."""
    if with_background:
        img = Image.new("RGB", (canvas_size, canvas_size), DEEP_TEAL)
    else:
        img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))

    draw = ImageDraw.Draw(img, "RGBA")
    inner_size = canvas_size - 2 * margin
    scale = inner_size / SIZE

    # 1) n body (warm white)
    _draw_n(draw, scale, margin, WARM_WHITE)

    # 2) carve the arch hollow — must match the background color, otherwise
    # the adaptive-icon (transparent bg) shows a teal hole instead of empty.
    cutout_color = DEEP_TEAL if with_background else (0, 0, 0, 0)
    _draw_arch_cutout(draw, scale, margin, cutout_color)

    # 3) playful tilde (coral)
    _draw_tilde(draw, scale, margin, CORAL)

    return img


# ── SVG version ────────────────────────────────────────────────────────────

def _svg_polygon_path(points):
    return " ".join(f"{x},{y}" for x, y in points)


def build_svg(with_background: bool = True) -> str:
    bg = (
        f'  <rect width="{SIZE}" height="{SIZE}" fill="{DEEP_TEAL}"/>\n'
        if with_background else ""
    )

    arch_w = ARCH_OUTER_RIGHT - ARCH_OUTER_LEFT
    arch_h = (STEM_TOP_Y + STEM_WIDTH // 2) - ARCH_TOP_Y

    inner_w = ARCH_INNER_RIGHT - ARCH_INNER_LEFT
    inner_top = ARCH_TOP_Y + 90
    inner_bot = STEM_BOT_Y + 40
    inner_h = inner_bot - inner_top

    cutout_color = DEEP_TEAL if with_background else "none"

    tilde_pts = _svg_polygon_path(TILDE_POLY_TOP + TILDE_POLY_BOTTOM)

    return f'''<svg width="{SIZE}" height="{SIZE}" viewBox="0 0 {SIZE} {SIZE}" xmlns="http://www.w3.org/2000/svg">
{bg}  <!-- Left stem -->
  <rect x="{LEFT_STEM_X}" y="{STEM_TOP_Y}" width="{STEM_WIDTH}" height="{STEM_BOT_Y - STEM_TOP_Y}" rx="{STEM_WIDTH // 2}" fill="{WARM_WHITE}"/>
  <!-- Right stem -->
  <rect x="{RIGHT_STEM_X}" y="{STEM_TOP_Y}" width="{STEM_WIDTH}" height="{STEM_BOT_Y - STEM_TOP_Y}" rx="{STEM_WIDTH // 2}" fill="{WARM_WHITE}"/>
  <!-- Arch (outer pill) -->
  <rect x="{ARCH_OUTER_LEFT}" y="{ARCH_TOP_Y}" width="{arch_w}" height="{arch_h}" rx="{arch_w // 2}" fill="{WARM_WHITE}"/>
  <!-- Arch hollow (cutout to bg) -->
  <rect x="{ARCH_INNER_LEFT}" y="{inner_top}" width="{inner_w}" height="{inner_h}" rx="{inner_w // 2}" fill="{cutout_color}"/>
  <!-- Playful tilde -->
  <polygon points="{tilde_pts}" fill="{CORAL}"/>
</svg>
'''


def main():
    import sys
    repo_root = Path(__file__).parent.parent
    target_dir = "assets" if "--commit" in sys.argv else "assets/preview"
    assets = repo_root / target_dir
    assets.mkdir(parents=True, exist_ok=True)
    print(f"Writing to: {assets}")

    draw_logo(1024, with_background=True).save(assets / "icon.png", "PNG")
    print(f"  [ok] {assets / 'icon.png'}")

    draw_logo(1024, with_background=False).save(assets / "adaptive-icon.png", "PNG")
    print(f"  [ok] {assets / 'adaptive-icon.png'}")

    draw_logo(1024, with_background=True, margin=80).save(assets / "splash-icon.png", "PNG")
    print(f"  [ok] {assets / 'splash-icon.png'}")

    draw_logo(192, with_background=True).save(assets / "favicon.png", "PNG")
    print(f"  [ok] {assets / 'favicon.png'}")

    (assets / "logo.svg").write_text(build_svg(with_background=True), encoding="utf-8")
    print(f"  [ok] {assets / 'logo.svg'}")

    (assets / "logo-mark.svg").write_text(build_svg(with_background=False), encoding="utf-8")
    print(f"  [ok] {assets / 'logo-mark.svg'}")

    print("\nAll assets generated. Inspect them in", target_dir, "before committing.")


if __name__ == "__main__":
    main()

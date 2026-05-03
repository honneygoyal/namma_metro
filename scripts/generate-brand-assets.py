from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]

INK = (7, 17, 31)
INK_2 = (8, 47, 73)
TEAL = (15, 118, 110)
TEAL_LIGHT = (45, 212, 191)
PURPLE = (124, 58, 237)
GREEN = (34, 197, 94)
GOLD = (250, 204, 21)
WHITE = (255, 255, 255)
MIST = (224, 247, 250)


def font(size: int, bold: bool = True):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/SFNS.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def gradient_rect(width, height, start=INK_2, end=INK):
    image = Image.new("RGB", (width, height), start)
    pixels = image.load()
    for y in range(height):
        for x in range(width):
            mix = (x * 0.65 + y) / max(width * 0.65 + height, 1)
            pixels[x, y] = tuple(round(start[i] * (1 - mix) + end[i] * mix) for i in range(3))
    return image.convert("RGBA")


def rounded_mask(width, height, radius):
    mask = Image.new("L", (width, height), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, width, height), radius=radius, fill=255)
    return mask


def draw_soft_circle(image, center, radius, color, alpha):
    glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    x, y = center
    draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color + (alpha,))
    image.alpha_composite(glow.filter(ImageFilter.GaussianBlur(radius / 2)))


def draw_map_lines(draw, width, height, scale=1.0):
    lines = [
        (PURPLE, [(0.08, 0.68), (0.23, 0.57), (0.38, 0.58), (0.54, 0.44), (0.72, 0.47), (0.92, 0.32)]),
        (GREEN, [(0.26, 0.12), (0.38, 0.28), (0.48, 0.42), (0.46, 0.62), (0.34, 0.82)]),
        (GOLD, [(0.52, 0.86), (0.60, 0.70), (0.62, 0.56), (0.70, 0.45), (0.84, 0.44)]),
    ]
    for color, points in lines:
        path = [(round(x * width), round(y * height)) for x, y in points]
        draw.line(path, fill=color + (210,), width=max(4, round(width * 0.035 * scale)), joint="curve")
        for x, y in path[1:-1]:
            r = max(3, round(width * 0.014 * scale))
            draw.ellipse((x - r, y - r, x + r, y + r), fill=WHITE + (255,))
            draw.ellipse((x - r + 1, y - r + 1, x + r - 1, y + r - 1), fill=color + (255,))


def draw_mark(draw, box, with_shadow=False):
    x0, y0, x1, y1 = box
    w = x1 - x0
    h = y1 - y0
    stroke = max(5, round(w * 0.105))
    if with_shadow:
        shadow = Image.new("RGBA", (round(w), round(h)), (0, 0, 0, 0))
        shadow_draw = ImageDraw.Draw(shadow)
        sx = lambda value: round(value * w)
        sy = lambda value: round(value * h)
        shadow_draw.line(
            [(sx(0.20), sy(0.70)), (sx(0.20), sy(0.28)), (sx(0.50), sy(0.62)), (sx(0.80), sy(0.28)), (sx(0.80), sy(0.70))],
            fill=(0, 0, 0, 110),
            width=stroke,
            joint="curve",
        )
        shadow = shadow.filter(ImageFilter.GaussianBlur(max(2, round(w * 0.035))))
        draw.bitmap((x0 + round(w * 0.03), y0 + round(h * 0.05)), shadow, fill=None)

    def point(px, py):
        return (round(x0 + px * w), round(y0 + py * h))

    draw.line(
        [point(0.20, 0.70), point(0.20, 0.28), point(0.50, 0.62), point(0.80, 0.28), point(0.80, 0.70)],
        fill=WHITE + (255,),
        width=stroke,
        joint="curve",
    )
    draw.line([point(0.22, 0.82), point(0.78, 0.82)], fill=GOLD + (255,), width=max(4, round(stroke * 0.72)))
    for px, color in [(0.28, PURPLE), (0.50, GREEN), (0.72, GOLD)]:
        cx, cy = point(px, 0.82)
        r = max(3, round(w * 0.04))
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=color + (255,))


def make_icon(size, radius_ratio=0.22, transparent_corners=True):
    image = gradient_rect(size, size)
    draw_soft_circle(image, (round(size * 0.15), round(size * 0.18)), round(size * 0.35), TEAL_LIGHT, 80)
    draw_soft_circle(image, (round(size * 0.9), round(size * 0.75)), round(size * 0.3), PURPLE, 55)
    draw = ImageDraw.Draw(image)
    draw_map_lines(draw, size, size, 0.85)
    pad = round(size * 0.19)
    draw.rounded_rectangle((pad, pad, size - pad, size - pad), radius=round(size * 0.12), fill=(5, 14, 26, 176), outline=(255, 255, 255, 36), width=max(1, size // 96))
    draw_mark(draw, (round(size * 0.22), round(size * 0.19), round(size * 0.78), round(size * 0.80)), with_shadow=False)

    if not transparent_corners:
        return image

    mask = rounded_mask(size, size, round(size * radius_ratio))
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(image, (0, 0), mask)
    return out


def draw_lockup(draw, x, y, title_size, subtitle_size, light=True):
    title_font = font(title_size)
    subtitle_font = font(subtitle_size, False)
    title_color = WHITE if light else INK
    sub_color = MIST if light else (71, 85, 105)
    draw.text((x, y), "MetroMate", font=title_font, fill=title_color + (255,))
    draw.text((x, y + title_size + 8), "Bengaluru", font=title_font, fill=title_color + (255,))
    draw.text((x, y + title_size * 2 + 28), "Offline metro route planner", font=subtitle_font, fill=sub_color + (255,))


def make_splash(width, height):
    image = gradient_rect(width, height)
    draw_soft_circle(image, (round(width * 0.18), round(height * 0.18)), round(min(width, height) * 0.42), TEAL_LIGHT, 70)
    draw_soft_circle(image, (round(width * 0.86), round(height * 0.78)), round(min(width, height) * 0.34), PURPLE, 55)
    draw = ImageDraw.Draw(image)
    draw_map_lines(draw, width, height, 0.55)
    icon_size = min(width, height) // 4
    icon = make_icon(icon_size)
    image.alpha_composite(icon, ((width - icon_size) // 2, (height - icon_size) // 2 - icon_size // 3))
    title_font = font(max(30, width // 14))
    sub_font = font(max(16, width // 34), False)
    title = "MetroMate Bengaluru"
    subtitle = "Offline routes. Live station context."
    title_box = draw.textbbox((0, 0), title, font=title_font)
    sub_box = draw.textbbox((0, 0), subtitle, font=sub_font)
    title_y = (height + icon_size) // 2 + 22
    draw.text(((width - (title_box[2] - title_box[0])) // 2, title_y), title, font=title_font, fill=WHITE + (255,))
    draw.text(((width - (sub_box[2] - sub_box[0])) // 2, title_y + (title_box[3] - title_box[1]) + 12), subtitle, font=sub_font, fill=MIST + (255,))
    return image


def make_feature_graphic(width=1024, height=500):
    image = gradient_rect(width, height)
    draw_soft_circle(image, (140, 90), 260, TEAL_LIGHT, 90)
    draw_soft_circle(image, (930, 400), 280, PURPLE, 60)
    draw = ImageDraw.Draw(image)
    draw_map_lines(draw, width, height, 0.75)
    draw.rounded_rectangle((246, 58, 820, 318), radius=34, fill=(7, 17, 31, 188), outline=(255, 255, 255, 30), width=1)
    icon = make_icon(168)
    image.alpha_composite(icon, (74, 96))
    draw_lockup(draw, 282, 94, 56, 25, True)
    pill_font = font(24)
    pills = [("Purple", PURPLE), ("Green", GREEN), ("Yellow", GOLD)]
    x = 282
    for label, color in pills:
        tw = draw.textbbox((0, 0), label, font=pill_font)
        box_w = tw[2] - tw[0] + 44
        draw.rounded_rectangle((x, 342, x + box_w, 394), radius=26, fill=color + (255,))
        text_color = INK if color == GOLD else WHITE
        draw.text((x + 22, 354), label, font=pill_font, fill=text_color + (255,))
        x += box_w + 18
    return image


def save(path, image):
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)


def main():
    public = ROOT / "public"
    store = ROOT / "store-assets"
    android_res = ROOT / "android/app/src/main/res"
    fastlane_android_images = ROOT / "fastlane/metadata/android/en-US/images"

    save(public / "icon-192.png", make_icon(192))
    save(public / "icon-512.png", make_icon(512))
    save(store / "ios/app-icon-1024.png", make_icon(1024, 0.18, transparent_corners=False).convert("RGB"))
    save(ROOT / "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png", make_icon(1024, 0.18, transparent_corners=False).convert("RGB"))
    save(store / "ios/marketing-header.png", make_feature_graphic(1200, 628))
    save(store / "android/app-icon-512.png", make_icon(512, 0.18))
    save(store / "android/feature-graphic.png", make_feature_graphic())
    save(fastlane_android_images / "icon.png", make_icon(512, 0.18))
    save(fastlane_android_images / "featureGraphic.png", make_feature_graphic())

    densities = {
        "mdpi": 48,
        "hdpi": 72,
        "xhdpi": 96,
        "xxhdpi": 144,
        "xxxhdpi": 192,
    }
    for density, size in densities.items():
        icon = make_icon(size, 0.18)
        save(android_res / f"mipmap-{density}/ic_launcher.png", icon)
        save(android_res / f"mipmap-{density}/ic_launcher_round.png", make_icon(size, 0.5))
        save(android_res / f"mipmap-{density}/ic_launcher_foreground.png", make_icon(size * 2, 0.5))

    splash_sizes = {
        "drawable/splash.png": (1080, 1080),
        "drawable-port-mdpi/splash.png": (480, 800),
        "drawable-port-hdpi/splash.png": (720, 1280),
        "drawable-port-xhdpi/splash.png": (1080, 1920),
        "drawable-port-xxhdpi/splash.png": (1440, 2560),
        "drawable-port-xxxhdpi/splash.png": (2160, 3840),
        "drawable-land-mdpi/splash.png": (800, 480),
        "drawable-land-hdpi/splash.png": (1280, 720),
        "drawable-land-xhdpi/splash.png": (1920, 1080),
        "drawable-land-xxhdpi/splash.png": (2560, 1440),
        "drawable-land-xxxhdpi/splash.png": (3840, 2160),
    }
    for path, size in splash_sizes.items():
        save(android_res / path, make_splash(*size))


if __name__ == "__main__":
    main()

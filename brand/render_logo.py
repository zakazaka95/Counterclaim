"""Render the original vector mark with matching geometry; no external assets."""
from pathlib import Path
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent
SCALE = 4


def bezier(start, control1, control2, end, steps=48):
    result = []
    for i in range(1, steps + 1):
        t = i / steps
        s = 1 - t
        result.append(tuple(s**3 * start[d] + 3*s*s*t*control1[d]
                            + 3*s*t*t*control2[d] + t**3*end[d]
                            for d in (0, 1)))
    return result


left = [(240, 120), (188, 120)]
left += bezier(left[-1], (134, 120), (92, 162), (92, 220))
left += [(92, 292)]
left += bezier(left[-1], (92, 350), (134, 392), (188, 392))
left += [(240, 392), (240, 336), (188, 336)]
left += bezier(left[-1], (166, 336), (148, 314), (148, 292))
left += [(148, 220)]
left += bezier(left[-1], (148, 198), (166, 176), (188, 176))
left += [(240, 176)]

image = Image.new('RGBA', (512*SCALE, 512*SCALE), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((0, 0, 512*SCALE, 512*SCALE), radius=112*SCALE, fill='#0b0d09')
for points, color in [(left, '#d9f433'), ([(512-x, y) for x, y in left], '#f6f5ee')]:
    draw.polygon([(round(x*SCALE), round(y*SCALE)) for x, y in points], fill=color)
image.resize((512, 512), Image.Resampling.LANCZOS).save(ROOT / 'counterclaim-logo.png', optimize=True)
print(ROOT / 'counterclaim-logo.png')

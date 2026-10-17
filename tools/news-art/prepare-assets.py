# Flow originals (D:\AI-ART\BotPress\brand\ihc-press\news-art\*.jpg, ~0.5-0.8 MB each) -> render-sized copies in tools/news-art/assets
# usage: python tools/news-art/prepare-assets.py [srcDir]   (needs Pillow)
import sys
from pathlib import Path
from PIL import Image, ImageStat

src = Path(sys.argv[1] if len(sys.argv) > 1 else r"D:\AI-ART\BotPress\brand\ihc-press\news-art")
dst = Path(__file__).resolve().parent / "assets"
dst.mkdir(exist_ok=True)


def trim_letterbox(im):
    """Flow sometimes adds cinematic black bars even when told not to: cut rows that are dark AND flat (no detail),
    only when both top and bottom have them, so the empty dark sky deliberately left above a subject is kept."""
    g = im.convert("L")
    flat = lambda y: (lambda st: st.mean[0] < 16 and st.stddev[0] < 4)(ImageStat.Stat(g.crop((0, y, g.width, y + 1))))
    top = 0
    while top < g.height // 4 and flat(top):
        top += 1
    bot = g.height
    while bot > g.height * 3 // 4 and flat(bot - 1):
        bot -= 1
    if top > 20 and g.height - bot > 20:  # real letterbox = bars on BOTH edges; one dark edge is just empty sky
        print(f"  trimmed bars top {top}px, bottom {g.height - bot}px")
        return im.crop((0, top, im.width, bot))
    return im

for p in sorted(src.glob("*.jpg")):
    if p.stem.startswith("_"):
        continue
    im = Image.open(p).convert("RGB")
    if p.stem.startswith("beat-"):
        im = trim_letterbox(im)
    im.thumbnail((1920, 1920), Image.LANCZOS)  # largest canvas is 1600x900 / 1080x1350, so this keeps headroom for cover-cropping
    out = dst / (p.stem + ".jpg")
    im.save(out, quality=86, optimize=True, progressive=True)
    print(out.name, im.size, out.stat().st_size // 1024, "KB")

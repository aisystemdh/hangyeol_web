"""
public/hangyeol-mark.png 생성 — 헤더용 **심볼만** 로고.

    python scripts/make-mark.py

원본 `public/hangyeol-logo.png`(351×489)는 심볼 아래에 "한결" 워드마크가 함께 들어 있다.
헤더는 높이 26px로 쓰기 때문에 그 글씨가 뭉개져 읽히지도 않으면서 심볼만 작아 보이게 만든다.
그래서 헤더에는 글씨를 잘라낸 심볼만 쓴다.

원본 이미지의 잉크 구간(가로줄 단위로 검사한 결과):
    y  39~ 92   위쪽 점 2개
    y 109~304   마주보는 획 2개
    y 340~477   "한결" 워드마크   ← 이 부분을 버린다

⚠️ 원본(hangyeol-logo.png)은 그대로 둔다. 히어로·푸터·OG 이미지는 워드마크가 있는
   전체 로고를 계속 쓴다 — 거기서는 크게 나와 글씨가 제 역할을 한다.
"""

import sys
from pathlib import Path

from PIL import Image

# 윈도 기본 콘솔 인코딩(cp949)에서 한글·기호가 깨지지 않게 한다
sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "hangyeol-logo.png"
OUT = ROOT / "public" / "hangyeol-mark.png"


def ink_rows(im: Image.Image) -> list[bool]:
    """행마다 잉크(불투명하고 어두운 픽셀)가 있는지."""
    w, h = im.size
    px = im.load()
    return [
        any(px[x, y][3] > 40 and sum(px[x, y][:3]) < 400 for x in range(0, w, 2))
        for y in range(h)
    ]


def main() -> None:
    im = Image.open(SRC).convert("RGBA")
    w, h = im.size

    rows = ink_rows(im)
    bands: list[tuple[int, int]] = []
    start = None
    for y, has_ink in enumerate(rows):
        if has_ink and start is None:
            start = y
        elif not has_ink and start is not None:
            bands.append((start, y - 1))
            start = None
    if start is not None:
        bands.append((start, h - 1))

    if len(bands) < 3:
        raise SystemExit(f"잉크 구간이 {len(bands)}개다. 3개(점·획·워드마크)를 기대했다.")

    # 마지막 구간이 워드마크다. 그 앞까지가 심볼.
    symbol_top = bands[0][0]
    symbol_bottom = bands[-2][1]

    # 심볼 구간 안에서 가로 범위를 잰다
    px = im.load()
    left, right = w, 0
    for y in range(symbol_top, symbol_bottom + 1):
        for x in range(w):
            if px[x, y][3] > 40 and sum(px[x, y][:3]) < 400:
                left = min(left, x)
                right = max(right, x)

    mark = im.crop((left, symbol_top, right + 1, symbol_bottom + 1))
    mark.save(OUT, "PNG", optimize=True)
    print(
        f"wrote {OUT.name} {mark.size[0]}×{mark.size[1]} "
        f"({OUT.stat().st_size:,} bytes) — 원본에서 y{symbol_top}~{symbol_bottom} 크롭"
    )


if __name__ == "__main__":
    main()

"""
src/app/favicon.ico 생성 — 브라우저 탭 아이콘.

    python scripts/make-favicon.py

`public/hangyeol-mark-v2.png`(심볼만, 딥그린)를 오프화이트 정사각 바탕에 얹어
16·32·48px ICO로 저장한다.

⚠️ 투명 배경을 쓰지 않는 이유 — 다크 모드 탭바에서 딥그린 심볼이 배경에
   묻혀 사라진다. 종이색 바탕이 있어야 어느 탭바에서도 형태가 보인다.
"""

import sys
from pathlib import Path

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
MARK = ROOT / "public" / "hangyeol-mark-v2.png"
OUT = ROOT / "src" / "app" / "favicon.ico"

PAPER = (245, 241, 232, 255)  # --paper


def main() -> None:
    mark = Image.open(MARK).convert("RGBA")

    size = 256
    canvas = Image.new("RGBA", (size, size), PAPER)
    # 심볼을 정사각 안에 84%로 맞춰 여백을 조금 남긴다
    box = round(size * 0.84)
    ratio = min(box / mark.width, box / mark.height)
    w, h = round(mark.width * ratio), round(mark.height * ratio)
    resized = mark.resize((w, h), Image.LANCZOS)
    canvas.paste(resized, ((size - w) // 2, (size - h) // 2), resized)

    canvas.save(OUT, sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"wrote {OUT} ({OUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()

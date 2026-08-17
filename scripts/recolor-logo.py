"""
public/hangyeol-logo-v2.png 잉크 재염색 — 검정 → 딥그린(#1E3A2F, 2026-08 리브랜딩).

    python scripts/recolor-logo.py
    python scripts/make-mark.py   # 이어서 실행 — 심볼 크롭은 재염색된 원본에서 다시 딴다
    python scripts/make-og.py     # OG 썸네일도 새 팔레트로 다시 그린다

왜 새 카드 이미지에서 오려내지 않는가
  `design/한결 로고 최종본_딥그린.오프화이트.png`는 프레젠테이션 카드(어두운 틀 +
  "01" 칩 + 하단 텍스트)이고 심볼이 불투명한 오프화이트 위에 있다. 알파를 새로
  만들어야 하고 형상 좌표도 달라진다 — HomeHero의 STROKE와 make-mark.py의 크롭이
  기존 형상 좌표에 맞춰져 있으므로, **기존 자산의 잉크만 재염색**하는 쪽이 안전하다.

방식: 모든 픽셀의 RGB를 딥그린으로 통일하고 알파는 그대로 둔다.
      안티에일리어싱이 알파 채널에 있으므로 형태·윤곽이 그대로 보존된다.
"""

import sys
from pathlib import Path

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
TARGETS = [ROOT / "public" / "hangyeol-logo-v2.png"]

# globals.css의 --green-900과 같은 값이어야 한다
GREEN = (0x1E, 0x3A, 0x2F)


def main() -> None:
    for path in TARGETS:
        im = Image.open(path).convert("RGBA")
        alpha = im.getchannel("A")
        solid = Image.new("RGBA", im.size, GREEN + (255,))
        solid.putalpha(alpha)
        solid.save(path, "PNG", optimize=True)
        print(f"recolored {path.name} → #1E3A2F ({path.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()

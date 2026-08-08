"""
public/og.png (1200x630) 생성기 — 링크를 공유했을 때 뜨는 썸네일.

    python scripts/make-og.py

왜 스크립트로 만드는가
  Next의 `ImageResponse`(Satori)로 만들 수도 있지만, 한글을 그리려면 TTF/OTF 폰트를
  빌드에 끼워 넣어야 한다(woff2는 지원하지 않는다). 5MB짜리 한글 폰트를 저장소에
  넣거나 빌드마다 내려받게 되고, 글리프가 빠지면 글자가 통째로 사라진다.
  1200x630 한 장을 미리 그려 두면 그 위험이 전부 사라진다.

왜 날짜·참가비를 넣지 않는가
  이미지에 박은 숫자는 `lib/event.ts`를 고쳐도 따라오지 않는다. 카카오톡·인스타에
  캐시된 썸네일이 옛 정보를 계속 보여주면 "광고와 실제가 다르다"가 된다 —
  이 시장의 대표 불만이다.
  그래서 여기에는 **바뀌지 않는 것**만 담는다: 로고 · 슬로건 · 한 줄 소개.

폰트
  Windows 기본 맑은 고딕을 쓴다. 사이트 본문 서체(Noto Sans KR)와 완전히 같지는
  않지만 썸네일은 작게 보이고, 이 때문에 저장소에 폰트를 넣는 것은 과하다.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
LOGO = ROOT / "public" / "hangyeol-logo.png"
OUT = ROOT / "public" / "og.png"

W, H = 1200, 630
INK = (17, 17, 17)        # --ink
MUTE = (107, 107, 107)    # --mute (흰 위 5.33:1)


FONT_BOLD = "C:/Windows/Fonts/malgunbd.ttf"
FONT_BODY = "C:/Windows/Fonts/malgun.ttf"

SLOGAN = "결국에는 결이더라, 한결같이"
LEAD = "가치관이 맞는 사람을 오프라인에서 만나는 자리"


def centered(draw: ImageDraw.ImageDraw, y: int, text: str, font, fill) -> int:
    """text를 y에 가로 중앙 정렬로 그리고, 그린 높이를 돌려준다."""
    left, top, right, bottom = draw.textbbox((0, 0), text, font=font)
    draw.text(((W - (right - left)) / 2 - left, y - top), text, font=font, fill=fill)
    return bottom - top


def main() -> None:
    canvas = Image.new("RGB", (W, H), "white")
    draw = ImageDraw.Draw(canvas)

    # 로고 — 원본 351x489 흑백 PNG. 알파를 흰 배경에 합성한다.
    logo = Image.open(LOGO).convert("RGBA")
    logo_h = 190
    logo_w = round(logo.width * logo_h / logo.height)
    logo = logo.resize((logo_w, logo_h), Image.LANCZOS)
    # 로고 위 140 ~ 한 줄 소개 아래 ~500. 가운데가 320으로 캔버스 중앙(315)에 온다.
    # 값을 만질 때는 이 블록 전체의 수직 중앙을 315 근처로 유지할 것.
    canvas.paste(logo, ((W - logo_w) // 2, 140), logo)

    centered(draw, 374, SLOGAN, ImageFont.truetype(FONT_BOLD, 54), INK)
    centered(draw, 468, LEAD, ImageFont.truetype(FONT_BODY, 28), MUTE)

    canvas.save(OUT, "PNG", optimize=True)
    print(f"wrote {OUT} ({OUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()

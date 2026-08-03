"use client";

import { useEffect, useRef } from "react";

/**
 * 나무결 배경.
 *
 * 근거 — 01_brand_philosophy.md §4.1
 *   "결은 나무를 세로로 켰을 때 드러나는 무늬다. (…) 결은 살아온 시간의 흔적이고,
 *    그래서 바꿀 수 없다."
 *
 * 그래서 여기 그려지는 선은 규칙적인 줄무늬가 아니다. 하나의 저주파 흐름(shared warp)을
 * 모든 선이 공유하되 선마다 조금씩 다르게 따라가고, 간격은 나이테처럼 불규칙하다.
 *
 * 성능 원칙: **결은 마운트/리사이즈 때 딱 한 번만 그린다.** 스크롤 패럴랙스는
 * 캔버스 픽셀을 다시 칠하지 않고 CSS transform만 갱신한다.
 */

/** 패럴랙스로 밀려도 위아래가 비지 않도록 캔버스가 컨테이너 밖으로 나가는 여유(px). CSS와 맞출 것. */
const PAD = 220;
/** 스크롤량 대비 이동 비율. 0.15면 배경이 페이지보다 15% 느리게 흐른다. */
const PARALLAX = 0.15;
/** 레티나에서 메모리가 터지지 않게 상한을 둔다. 배경이라 2배면 충분하다. */
const MAX_DPR = 2;

/** 결정적 난수 — 리사이즈해도 같은 나무가 나오도록 시드를 고정해 쓴다. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 1D 값 노이즈. 사인파만으로는 나오지 않는 "불규칙하지만 부드러운" 흔들림을 만든다. */
function makeNoise(rand: () => number, size = 256) {
  const table = new Float32Array(size);
  for (let i = 0; i < size; i += 1) table[i] = rand() * 2 - 1;
  return (x: number) => {
    const i = Math.floor(x);
    const f = x - i;
    const a = table[((i % size) + size) % size];
    const b = table[(((i + 1) % size) + size) % size];
    const u = f * f * (3 - 2 * f); // smoothstep
    return a + (b - a) * u;
  };
}

type Line = {
  base: number;
  follow: number; // 공통 흐름을 얼마나 따라가는가 — 선끼리 벌어졌다 모이게 한다
  ownAmp: number;
  ownScale: number;
  ownSeed: number;
  width: number;
  alpha: number;
};

/**
 * 캔버스에 결을 한 번 그린다.
 * @param w CSS 픽셀 폭
 * @param h CSS 픽셀 높이
 */
function paint(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const rand = mulberry32(0x9e3779b9);
  const flowNoise = makeNoise(rand);
  const detailNoise = makeNoise(rand);

  // 모든 선이 공유하는 저주파 흐름. 이게 있어야 "줄무늬"가 아니라 "결"로 보인다.
  const f1 = 0.0032 + rand() * 0.004;
  const f2 = 0.011 + rand() * 0.012;
  const p1 = rand() * Math.PI * 2;
  const p2 = rand() * Math.PI * 2;
  const a1 = 14 + rand() * 12;
  const a2 = 4 + rand() * 5;
  const a3 = 8 + rand() * 8;
  const flow = (x: number) =>
    a1 * Math.sin(x * f1 + p1) + a2 * Math.sin(x * f2 + p2) + a3 * flowNoise(x / 260);

  // 나이테처럼 간격이 불규칙하다. rand()*rand()가 좁은 간격 쪽으로 치우친 분포를 만든다.
  const lines: Line[] = [];
  for (let y = -PAD; y < h + PAD; ) {
    y += 8 + rand() * rand() * 52;
    lines.push({
      base: y,
      follow: 0.72 + rand() * 0.56,
      ownAmp: 2 + rand() * 8,
      ownScale: 220 + rand() * 260,
      ownSeed: rand() * 1000,
      width: 0.6 + rand() * 1.7,
      alpha: 0.03 + rand() * 0.07,
    });
  }

  ctx.clearRect(0, 0, w, h);
  ctx.lineCap = "round";

  const step = 8;
  for (const line of lines) {
    ctx.beginPath();
    for (let x = -step; x <= w + step; x += step) {
      const y =
        line.base +
        flow(x) * line.follow +
        detailNoise(x / line.ownScale + line.ownSeed) * line.ownAmp;
      if (x <= -step) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(17, 17, 17, ${line.alpha.toFixed(3)})`;
    ctx.lineWidth = line.width;
    ctx.stroke();
  }

  // 종이질 입자감. 96px 타일을 한 번 만들어 패턴으로 깐다 — 픽셀 루프는 타일 한 장뿐이다.
  const tile = document.createElement("canvas");
  tile.width = 96;
  tile.height = 96;
  const tctx = tile.getContext("2d");
  if (tctx) {
    const img = tctx.createImageData(96, 96);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 17;
      d[i + 1] = 17;
      d[i + 2] = 17;
      d[i + 3] = rand() * 13; // 최대 알파 0.05 — 있는지 없는지 모를 정도로만
    }
    tctx.putImageData(img, 0, 0);
    const pattern = ctx.createPattern(tile, "repeat");
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, w, h);
    }
  }
}

export default function GrainCanvas({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let lastW = 0;
    let lastH = 0;

    const draw = () => {
      const w = Math.round(canvas.clientWidth);
      const h = Math.round(canvas.clientHeight);
      if (w === 0 || h === 0) return;
      // 모바일 주소창이 접혔다 펴질 때마다 높이가 몇십 px씩 흔들린다.
      // 그때마다 다시 그리면 나무결이 깜빡이므로 의미 있는 변화일 때만 다시 그린다.
      if (w === lastW && Math.abs(h - lastH) < 48) return;
      lastW = w;
      lastH = h;
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint(ctx, w, h);
    };

    draw();

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

    // 패럴랙스: 캔버스는 다시 칠하지 않고 transform만 바꾼다.
    const applyParallax = () => {
      raf = 0;
      const offset = Math.min(window.scrollY * PARALLAX, PAD);
      canvas.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(applyParallax);
    };

    let scrolling = false;
    const enableParallax = () => {
      if (scrolling || reduce.matches) return;
      scrolling = true;
      window.addEventListener("scroll", onScroll, { passive: true });
      applyParallax();
    };
    const disableParallax = () => {
      if (!scrolling) return;
      scrolling = false;
      window.removeEventListener("scroll", onScroll);
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      canvas.style.transform = "";
    };

    // reduce면 애니메이션 없이 위에서 그린 1회 렌더로 끝난다(정지 이미지).
    const onPrefChange = () => (reduce.matches ? disableParallax() : enableParallax());
    enableParallax();
    reduce.addEventListener("change", onPrefChange);

    const ro = new ResizeObserver(draw);
    ro.observe(canvas);

    return () => {
      disableParallax();
      reduce.removeEventListener("change", onPrefChange);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}

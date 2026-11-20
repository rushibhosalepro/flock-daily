import { useEffect, useRef } from 'react';
import { BIRD_COLORS } from '../constants.ts';

type Feather = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  size: number;
  color: string;
  sway: number;
};

const LIFE_MS = 1900;

const reducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A short burst of feathers in the three bird colors. `burst` changes each time
 * the player solves, which starts a new burst. A Perfect gets a bigger burst.
 */
export const Celebrate = ({ burst, big }: { burst: number; big: boolean }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (burst === 0 || !canvas || reducedMotion()) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const colors = [...BIRD_COLORS, '#ffffff'];
    const count = big ? 110 : 45;
    const feathers: Feather[] = [];
    for (let i = 0; i < count; i++) {
      // Launch from anywhere along the top, fanning out, with colors mixed at random.
      const x = w * (0.05 + Math.random() * 0.9);
      feathers.push({
        x,
        y: h * (0.02 + Math.random() * 0.12),
        vx: ((x - w / 2) / w) * 6 + (Math.random() - 0.5) * 3,
        vy: -(2 + Math.random() * 5),
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.3,
        size: 5 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)] ?? '#ffffff',
        sway: Math.random() * Math.PI * 2,
      });
    }

    let frame = 0;
    const start = performance.now();
    const draw = (now: number) => {
      const t = now - start;
      ctx.clearRect(0, 0, w, h);
      const fade = Math.max(0, 1 - t / LIFE_MS);
      for (const f of feathers) {
        f.vy += 0.22;
        f.vx *= 0.985;
        f.vy *= 0.985;
        f.sway += 0.12;
        f.x += f.vx + Math.sin(f.sway) * 0.6;
        f.y += f.vy;
        f.angle += f.spin;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(f.x, f.y);
        ctx.rotate(f.angle);
        ctx.fillStyle = f.color;
        ctx.strokeStyle = '#2b2d42';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(0, 0, f.size, f.size * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      if (t < LIFE_MS) frame = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, w, h);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [burst, big]);

  return <canvas ref={canvasRef} className="celebrate" aria-hidden="true" />;
};

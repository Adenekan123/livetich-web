'use client';

import { useEffect, useRef } from 'react';

/*
 * Telemetry globe for the terminal hero — a 3D point-cloud sphere that orbits
 * around its vertical (Y) axis, so the surface travels left→right like a real
 * spinning planet (not a flat 2D pinwheel spin). Rendered on a <canvas>: each
 * frame the points and wireframe great-circles are rotated in 3D and projected
 * to 2D, with size + opacity driven by depth so the front reads brighter than
 * the back. Teal to match the brand, with a few amber accent points.
 *
 * Cost is CPU-only (no network) — fine for the data-saver posture. It draws a
 * single static frame under prefers-reduced-motion, and pauses the animation
 * loop whenever the globe is scrolled out of view.
 */

const N = 720; // point count
const MERIDIANS = 12; // longitude great-circles
const PARALLELS = 8; // latitude circles
const SEG = 84; // segments per ring
const SPEED = 0.0013; // radians / frame (orbit rate)
const TILT = 0.32; // fixed tilt around X so the poles read
const USERS = 9; // pulsing "live user" nodes riding the surface

type V3 = { x: number; y: number; z: number; hot: boolean };
type UserNode = { x: number; y: number; z: number; phase: number };

/** Evenly distributed surface points (Fibonacci sphere). */
function spherePoints(): V3[] {
  const out: V3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const t = i * golden;
    out.push({
      x: Math.cos(t) * r,
      y,
      z: Math.sin(t) * r,
      hot: i % 10 === 3, // a few brighter "hot" nodes
    });
  }
  return out;
}

/** A meridian great-circle (through both poles) at longitude `lon`. */
function meridian(lon: number): V3[] {
  const cl = Math.cos(lon);
  const sl = Math.sin(lon);
  const ring: V3[] = [];
  for (let i = 0; i <= SEG; i++) {
    const t = (i / SEG) * Math.PI * 2;
    const st = Math.sin(t);
    ring.push({ x: st * cl, y: Math.cos(t), z: st * sl, hot: false });
  }
  return ring;
}

/** A latitude circle at polar angle `lat` (-1…1 fraction of a hemisphere). */
function parallel(lat: number): V3[] {
  const y = lat;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const ring: V3[] = [];
  for (let i = 0; i <= SEG; i++) {
    const u = (i / SEG) * Math.PI * 2;
    ring.push({ x: Math.cos(u) * r, y, z: Math.sin(u) * r, hot: false });
  }
  return ring;
}

/** A scattering of surface points that stand in for live users, each with its
 *  own pulse phase. Positions are random (client-only render, no SSR markup). */
function userNodes(): UserNode[] {
  const out: UserNode[] = [];
  for (let i = 0; i < USERS; i++) {
    // uniform on a sphere
    const u = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    out.push({
      x: r * Math.cos(theta),
      y: u,
      z: r * Math.sin(theta),
      phase: Math.random() * Math.PI * 2,
    });
  }
  return out;
}

export function HeroSphere({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Particle colours come from CSS vars so they flip with the page theme.
    let cBase = '190,242,100';
    let cHot = '217,249,157';
    let cArc = '163,230,53';
    // On the light ground the dark-green particles need more opacity to read,
    // since they no longer glow against a near-black backdrop.
    let aMul = 1;
    const readColors = () => {
      const s = getComputedStyle(document.documentElement);
      cBase = s.getPropertyValue('--lp-globe-rgb').trim() || cBase;
      cHot = s.getPropertyValue('--lp-globe-hot-rgb').trim() || cHot;
      cArc = s.getPropertyValue('--lp-globe-arc-rgb').trim() || cArc;
      aMul = document.documentElement.getAttribute('data-theme') === 'light' ? 1.9 : 1;
    };
    readColors();

    const pts = spherePoints();
    const users = userNodes();
    const rings: V3[][] = [];
    for (let i = 0; i < MERIDIANS; i++) rings.push(meridian((i / MERIDIANS) * Math.PI));
    for (let i = 1; i <= PARALLELS; i++) {
      rings.push(parallel(-1 + (i / (PARALLELS + 1)) * 2));
    }

    const cosT = Math.cos(TILT);
    const sinT = Math.sin(TILT);

    let W = 0;
    let H = 0;
    let cx = 0;
    let cy = 0;
    let R = 0;
    let angle = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, Math.round(rect.width));
      H = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = W / 2;
      cy = H / 2;
      R = Math.min(W, H) * 0.46;
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    // Project a unit-sphere point: spin around Y, then tilt around X.
    const project = (p: { x: number; y: number; z: number }) => {
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);
      const x = p.x * ca + p.z * sa;
      const z = -p.x * sa + p.z * ca;
      const y2 = p.y * cosT - z * sinT;
      const z2 = p.y * sinT + z * cosT; // -1 (back) … 1 (front)
      return { X: cx + x * R, Y: cy + y2 * R, z: z2 };
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // Wireframe great-circles behind the points.
      ctx.lineWidth = 1;
      for (const ring of rings) {
        let depthSum = 0;
        ctx.beginPath();
        for (let i = 0; i < ring.length; i++) {
          const a = project(ring[i]);
          depthSum += a.z;
          if (i === 0) ctx.moveTo(a.X, a.Y);
          else ctx.lineTo(a.X, a.Y);
        }
        const depth = (depthSum / ring.length + 1) / 2;
        ctx.strokeStyle = `rgba(${cArc},${(0.05 + depth * 0.15) * aMul})`;
        ctx.stroke();
      }

      // Points, drawn back-to-front so nearer dots sit on top.
      const proj = pts.map((p) => {
        const a = project(p);
        return { X: a.X, Y: a.Y, z: a.z, hot: p.hot };
      });
      proj.sort((a, b) => a.z - b.z);
      for (const q of proj) {
        const depth = (q.z + 1) / 2; // 0 back … 1 front
        const radius = (q.hot ? 0.7 : 0.5) + depth * 1.9;
        const alpha = Math.min(1, (0.12 + depth * 0.8) * aMul);
        ctx.beginPath();
        ctx.arc(q.X, q.Y, radius, 0, Math.PI * 2);
        // themed lime, with brighter "hot" highlight nodes
        ctx.fillStyle = q.hot
          ? `rgba(${cHot},${Math.min(1, alpha + 0.1)})`
          : `rgba(${cBase},${alpha})`;
        ctx.fill();
      }

      // Live-user nodes — a bright core with an outward pulsing halo, hidden
      // on the far side of the globe so they read as people on the surface.
      const now = performance.now() / 1000;
      for (const un of users) {
        const a = project(un);
        if (a.z < -0.15) continue;
        const depth = (a.z + 1) / 2;
        const p = (Math.sin(now * 2 + un.phase) + 1) / 2; // 0 … 1
        ctx.beginPath();
        ctx.arc(a.X, a.Y, 3 + p * 9, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${cHot},${(1 - p) * 0.5 * (0.4 + depth * 0.6)})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(a.X, a.Y, 2.3 + depth * 0.9, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${cHot},${0.6 + depth * 0.4})`;
        ctx.fill();
      }
    };

    let raf = 0;
    let running = false;
    const tick = () => {
      angle += SPEED;
      draw();
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };
    const stop = () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
    };

    draw(); // always paint at least one frame

    let io: IntersectionObserver | undefined;
    if (!reduce) {
      io = new IntersectionObserver(
        (entries) => (entries[0].isIntersecting ? start() : stop()),
        { threshold: 0.01 },
      );
      io.observe(canvas);
    }

    // Re-read palette when the page theme flips; repaint if we're not animating.
    const themeObserver = new MutationObserver(() => {
      readColors();
      draw();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => {
      stop();
      ro.disconnect();
      io?.disconnect();
      themeObserver.disconnect();
    };
  }, []);

  return (
    <div className={className} aria-hidden>
      <div className="relative aspect-square w-full">
        {/* soft radial glow behind the globe */}
        <div
          className="absolute inset-[10%] rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(var(--lp-globe-arc-rgb),0.16) 0%, rgba(var(--lp-globe-arc-rgb),0.05) 45%, transparent 70%)',
          }}
        />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      </div>
    </div>
  );
}

/**
 * CrosswalkGraph — GPU-style particle network of ALL frameworks.
 *
 * Scroll-driven formation with continuous animation after settling.
 * Category-clustered layout, pulsing edges, drifting nodes, ambient particles.
 */

import { useEffect, useRef } from 'react';

interface NodeInput {
  id: string;
  shortName: string;
  category: string;
  controlCount: number;
  hasCrosswalk: boolean;
}

interface EdgeInput {
  source: string;
  target: string;
  mappingCount: number;
}

interface SimNode extends NodeInput {
  x: number; y: number;
  sx: number; sy: number;
  vx: number; vy: number;
  angle: number; // for orbital drift
  driftSpeed: number;
  driftRadius: number;
}

interface Props {
  nodes: NodeInput[];
  edges: EdgeInput[];
}

const CAT_COLORS: Record<string, [number, number, number]> = {
  federal:       [137, 180, 250],
  enterprise:    [148, 226, 213],
  ai:            [203, 166, 247],
  privacy:       [249, 226, 175],
  international: [116, 199, 236],
  meta:          [166, 227, 161],
};

// Category cluster positions (radial arrangement)
const CAT_CENTERS: Record<string, [number, number]> = {
  federal:       [-35, -30],
  enterprise:    [40, -20],
  ai:            [-20, 35],
  privacy:       [45, 30],
  international: [-50, 5],
  meta:          [10, 0],
};

const TEAL: [number, number, number] = [148, 226, 213];

export function CrosswalkGraph({ nodes: rawNodes, edges }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio, 2);

    const connectedIds = new Set<string>();
    for (const e of edges) { connectedIds.add(e.source); connectedIds.add(e.target); }

    // Initialize ALL nodes with scattered + settled positions
    const simNodes: SimNode[] = rawNodes.map((n, i) => {
      const isConn = connectedIds.has(n.id);
      const catCenter = CAT_CENTERS[n.category] || [0, 0];
      const angle = Math.random() * Math.PI * 2;
      const spread = isConn ? 20 + Math.random() * 25 : 35 + Math.random() * 50;

      return {
        ...n,
        x: catCenter[0] + Math.cos(angle) * spread,
        y: catCenter[1] + Math.sin(angle) * spread,
        sx: (Math.random() - 0.5) * 500,
        sy: (Math.random() - 0.5) * 400,
        vx: 0, vy: 0,
        angle: Math.random() * Math.PI * 2,
        driftSpeed: 0.002 + Math.random() * 0.004,
        driftRadius: isConn ? 1.5 + Math.random() * 2 : 2 + Math.random() * 3,
      };
    });

    const nodeMap = new Map<string, SimNode>();
    simNodes.forEach(n => nodeMap.set(n.id, n));

    // Force simulation (only connected nodes attract via edges)
    const connNodes = simNodes.filter(n => connectedIds.has(n.id));
    for (let tick = 0; tick < 200; tick++) {
      for (const node of simNodes) {
        // Repulsion from nearby nodes
        for (const other of simNodes) {
          if (node === other) continue;
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const distSq = dx * dx + dy * dy;
          if (distSq > 10000) continue; // skip distant nodes
          const dist = Math.sqrt(distSq) || 1;
          const force = 200 / (dist * dist);
          node.vx += (dx / dist) * force;
          node.vy += (dy / dist) * force;
        }

        // Edge attraction (connected nodes only)
        if (connectedIds.has(node.id)) {
          for (const edge of edges) {
            const isS = edge.source === node.id;
            const isT = edge.target === node.id;
            if (!isS && !isT) continue;
            const other = nodeMap.get(isS ? edge.target : edge.source);
            if (!other) continue;
            node.vx += (other.x - node.x) * 0.003;
            node.vy += (other.y - node.y) * 0.003;
          }
        }

        // Category clustering force
        const cc = CAT_CENTERS[node.category] || [0, 0];
        node.vx += (cc[0] - node.x) * 0.002;
        node.vy += (cc[1] - node.y) * 0.002;

        // Center gravity (weak)
        node.vx -= node.x * 0.001;
        node.vy -= node.y * 0.001;

        node.vx *= 0.88;
        node.vy *= 0.88;
        node.x += node.vx;
        node.y += node.vy;
      }
    }

    // Ambient particles (tiny, floating)
    const ambientCount = 50;
    const ambientDots = Array.from({ length: ambientCount }, () => {
      const colors = Object.values(CAT_COLORS);
      return {
        x: (Math.random() - 0.5) * 250,
        y: (Math.random() - 0.5) * 250,
        vx: (Math.random() - 0.5) * 0.08,
        vy: (Math.random() - 0.5) * 0.08,
        size: Math.random() * 0.8 + 0.3,
        opacity: Math.random() * 0.15 + 0.03,
        color: colors[Math.floor(Math.random() * colors.length)] as [number, number, number],
      };
    });

    let animId: number;
    let time = 0;
    let scrollProgress = 0;

    function updateScroll() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const vh = window.innerHeight;
      scrollProgress = Math.max(0, Math.min(1, (vh - rect.top) / (vh * 0.85)));
    }
    window.addEventListener('scroll', updateScroll, { passive: true });
    updateScroll();

    function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
    function easeOut(t: number) { return 1 - Math.pow(1 - t, 3); }

    function draw() {
      if (!ctx || !canvas) return;

      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      if (w === 0 || h === 0) { animId = requestAnimationFrame(draw); return; }
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const scale = Math.min(w, h) / 240;
      time += 0.016;

      const formT = easeOut(scrollProgress);

      // Slow global rotation
      const rot = time * 0.025 * (0.15 + formT * 0.85);
      const cosR = Math.cos(rot);

      function project(x: number, y: number): [number, number] {
        return [cx + x * cosR * scale, cy + y * scale];
      }

      // ── Ambient particles ──
      for (const dot of ambientDots) {
        dot.x += dot.vx;
        dot.y += dot.vy;
        if (Math.abs(dot.x) > 140) dot.vx *= -1;
        if (Math.abs(dot.y) > 140) dot.vy *= -1;
        const [px, py] = project(dot.x, dot.y);
        const [r, g, b] = dot.color;
        ctx.beginPath();
        ctx.arc(px, py, dot.size * scale, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${dot.opacity})`;
        ctx.fill();
      }

      // ── Edges with pulsing flow ──
      const edgeAlpha = Math.max(0, (formT - 0.2) / 0.5);
      if (edgeAlpha > 0) {
        for (let ei = 0; ei < edges.length; ei++) {
          const edge = edges[ei];
          const src = nodeMap.get(edge.source);
          const tgt = nodeMap.get(edge.target);
          if (!src || !tgt) continue;

          // Current positions with drift
          const srcDx = Math.cos(src.angle + time * src.driftSpeed) * src.driftRadius * formT;
          const srcDy = Math.sin(src.angle + time * src.driftSpeed) * src.driftRadius * formT;
          const tgtDx = Math.cos(tgt.angle + time * tgt.driftSpeed) * tgt.driftRadius * formT;
          const tgtDy = Math.sin(tgt.angle + time * tgt.driftSpeed) * tgt.driftRadius * formT;

          const sx = lerp(src.sx, src.x + srcDx, formT);
          const sy = lerp(src.sy, src.y + srcDy, formT);
          const tx = lerp(tgt.sx, tgt.x + tgtDx, formT);
          const ty = lerp(tgt.sy, tgt.y + tgtDy, formT);

          const [x1, y1] = project(sx, sy);
          const [x2, y2] = project(tx, ty);

          // Base alpha from mapping count
          const baseA = (Math.min(edge.mappingCount / 80, 0.45) + 0.03) * edgeAlpha;

          // Pulse traveling along the edge
          const pulsePhase = (time * 0.8 + ei * 0.7) % (Math.PI * 2);
          const pulseIntensity = (Math.sin(pulsePhase) * 0.5 + 0.5) * 0.25;

          // Glow line
          ctx.beginPath();
          ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
          ctx.strokeStyle = `rgba(148,226,213,${(baseA + pulseIntensity) * 0.3})`;
          ctx.lineWidth = (2 + pulseIntensity * 2) * scale;
          ctx.stroke();

          // Core line
          ctx.beginPath();
          ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
          ctx.strokeStyle = `rgba(148,226,213,${baseA + pulseIntensity * 0.5})`;
          ctx.lineWidth = 0.4 * scale;
          ctx.stroke();
        }
      }

      // ── All nodes ──
      for (const node of simNodes) {
        // Continuous orbital drift (even after formation)
        node.angle += node.driftSpeed;
        const driftX = Math.cos(node.angle) * node.driftRadius * formT;
        const driftY = Math.sin(node.angle) * node.driftRadius * formT;

        const curX = lerp(node.sx, node.x + driftX, formT);
        const curY = lerp(node.sy, node.y + driftY, formT);
        const [px, py] = project(curX, curY);

        const isConn = connectedIds.has(node.id);
        const [r, g, b] = CAT_COLORS[node.category] || TEAL;

        // Size based on control count (more controls = bigger node)
        const controlScale = Math.sqrt(Math.max(node.controlCount, 10));
        const baseSize = isConn
          ? 1.2 + controlScale * 0.05
          : 0.5 + controlScale * 0.015;

        // Heartbeat pulse (phase offset per node)
        const heartbeat = Math.sin(time * 1.8 + node.x * 0.03 + node.y * 0.03);
        const pulse = 1 + heartbeat * 0.08;
        const radius = baseSize * scale * pulse;

        if (isConn) {
          // ── Connected: full particle glow treatment ──

          // Outer halo
          const og = ctx.createRadialGradient(px, py, 0, px, py, radius * 6);
          og.addColorStop(0, `rgba(${r},${g},${b},0.06)`);
          og.addColorStop(1, `rgba(${r},${g},${b},0)`);
          ctx.beginPath();
          ctx.arc(px, py, radius * 6, 0, Math.PI * 2);
          ctx.fillStyle = og;
          ctx.fill();

          // Mid glow
          const mg = ctx.createRadialGradient(px, py, 0, px, py, radius * 2.5);
          mg.addColorStop(0, `rgba(${r},${g},${b},0.3)`);
          mg.addColorStop(1, `rgba(${r},${g},${b},0)`);
          ctx.beginPath();
          ctx.arc(px, py, radius * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = mg;
          ctx.fill();

          // Bright core
          ctx.beginPath();
          ctx.arc(px, py, radius * 0.7, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${g},${b},0.9)`;
          ctx.fill();

          // Hot center (white-ish)
          ctx.beginPath();
          ctx.arc(px, py, radius * 0.25, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${Math.min(r + 60, 255)},${Math.min(g + 60, 255)},${Math.min(b + 60, 255)},0.6)`;
          ctx.fill();

          // Label
          if (formT > 0.55 && scale > 0.55) {
            const la = (formT - 0.55) / 0.45;
            const fs = Math.max(5.5, 6.5 * scale);
            ctx.font = `${fs}px system-ui, sans-serif`;
            ctx.fillStyle = `rgba(205,214,244,${la * 0.4})`;
            ctx.textAlign = 'center';
            ctx.fillText(node.shortName, px, py - radius * 3.5 - 1);
          }
        } else {
          // ── Peripheral: dim ambient dots ──
          const dimAlpha = 0.08 + formT * 0.12 + heartbeat * 0.03;

          // Soft glow
          ctx.beginPath();
          ctx.arc(px, py, radius * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${g},${b},${dimAlpha * 0.3})`;
          ctx.fill();

          // Dot
          ctx.beginPath();
          ctx.arc(px, py, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${g},${b},${dimAlpha})`;
          ctx.fill();
        }
      }

      animId = requestAnimationFrame(draw);
    }

    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('scroll', updateScroll);
    };
  }, [rawNodes, edges]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      aria-label="Framework connection universe"
    />
  );
}

export default CrosswalkGraph;

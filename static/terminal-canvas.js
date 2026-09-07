/**
 * GeoSpeak — Terminal Chic Aesthetic Background Engine
 * Theme-aware Cybernetic Matrix Canvas:
 * - Automatically adapts to Light Mode (Cobalt/Sky) and Dark Mode (Cyber Obsidian/Neon Cyan)
 * - High-precision coordinate grid with crosshair (+) intersections
 * - Bidirectional data bus pulses (neural/vector bus traces)
 * - Ambient radar telemetry sweep beam
 * - Floating alphanumeric terminal telemetry badges ([FAISS::384D], [QPU_BUS], etc.)
 * - Interactive mouse reticle HUD with real-time viewport coordinates
 */
(function () {
  'use strict';

  function initTerminalCanvas() {
    const canvas = document.getElementById('terminal-canvas') || document.getElementById('pixel-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Terminal Grid configuration
    const GRID_SPACING = 48; // Grid cell size in CSS pixels
    const CROSS_SIZE = 4;    // Half-width of crosshairs (+) at intersections

    function isDarkMode() {
      return document.documentElement.getAttribute('data-theme') === 'dark';
    }

    // Mouse tracking with smooth damping
    const mouse = {
      x: -1000,
      y: -1000,
      targetX: -1000,
      targetY: -1000,
      active: false,
      idleTimer: null,
    };

    // Telemetry badges catalog (bilingual & AI system tokens)
    const TELEMETRY_TOKENS = [
      'SYS.NODE // 0x4E',
      'FAISS::384-DIM',
      'VECTOR_RETRIEVAL // OK',
      'LAT 48.8566° N',
      'LNG 2.3522° E',
      'QPU_STREAM // 99.8%',
      'LLAMA-3.3-70B',
      'LATENCY // 14ms',
      'UTF-8 // MULTILINGUAL',
      'RAG_PIPELINE // READY',
      'GEO.SYNAPSE // v2.6',
      'FR ⇄ EN ⇄ ES ⇄ DE ⇄ UR ⇄ JA',
      'CONFIDENCE // >98.2%',
      'GROQ_HARDWARE // ACCEL',
      'MEM_BANDWIDTH // OPTIMAL'
    ];

    // Responsive Canvas Resizing
    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rebuildGrid();
    }

    // Grid intersections and active telemetry items
    let intersections = [];
    let activeFloatingBadges = [];
    let busPulses = [];
    let radarX = 0;
    const RADAR_SPEED = 0.65; // Horizontal sweep velocity

    function rebuildGrid() {
      intersections = [];
      const cols = Math.ceil(width / GRID_SPACING) + 1;
      const rows = Math.ceil(height / GRID_SPACING) + 1;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          intersections.push({
            x: c * GRID_SPACING,
            y: r * GRID_SPACING,
            col: c,
            row: r,
            glow: 0,
          });
        }
      }

      seedFloatingBadges();
      seedBusPulses();
    }

    function seedFloatingBadges() {
      activeFloatingBadges = [];
      const count = Math.min(Math.floor((width * height) / 160000), 9);

      for (let i = 0; i < count; i++) {
        spawnBadge(true);
      }
    }

    function spawnBadge(initial = false) {
      if (intersections.length === 0) return;
      const pt = intersections[Math.floor(Math.random() * intersections.length)];
      const token = TELEMETRY_TOKENS[Math.floor(Math.random() * TELEMETRY_TOKENS.length)];
      
      activeFloatingBadges.push({
        x: pt.x + 8,
        y: pt.y - 8,
        text: token,
        opacity: initial ? Math.random() * 0.4 : 0,
        targetOpacity: 0.35 + Math.random() * 0.35,
        fadeSpeed: 0.005 + Math.random() * 0.005,
        state: 'in',
        holdTime: 120 + Math.random() * 240,
      });
    }

    function seedBusPulses() {
      busPulses = [];
      const pulseCount = Math.min(Math.floor(width / 140), 10);
      for (let i = 0; i < pulseCount; i++) {
        busPulses.push(createBusPulse(true));
      }
    }

    function createBusPulse(initial = false) {
      const isHorizontal = Math.random() > 0.45;
      const speed = (2.0 + Math.random() * 2.8) * (Math.random() > 0.5 ? 1 : -1);
      const cols = Math.ceil(width / GRID_SPACING);
      const rows = Math.ceil(height / GRID_SPACING);
      const dark = isDarkMode();

      const color = dark
        ? (Math.random() > 0.4 ? '#38BDF8' : '#818CF8')
        : (Math.random() > 0.3 ? '#1774EE' : '#0284C7');

      if (isHorizontal) {
        const row = Math.floor(Math.random() * rows);
        const y = row * GRID_SPACING;
        const length = 32 + Math.random() * 64;
        const x = initial ? Math.random() * width : (speed > 0 ? -length : width + length);
        return {
          isHorizontal: true,
          x: x,
          y: y,
          length: length,
          speed: speed,
          color: color,
          size: Math.random() > 0.7 ? 2.5 : 1.5,
          alpha: 0.35 + Math.random() * 0.45,
        };
      } else {
        const col = Math.floor(Math.random() * cols);
        const x = col * GRID_SPACING;
        const length = 32 + Math.random() * 64;
        const y = initial ? Math.random() * height : (speed > 0 ? -length : height + length);
        return {
          isHorizontal: false,
          x: x,
          y: y,
          length: length,
          speed: speed,
          color: color,
          size: Math.random() > 0.7 ? 2.5 : 1.5,
          alpha: 0.35 + Math.random() * 0.45,
        };
      }
    }

    // Mouse Tracking
    window.addEventListener('mousemove', (e) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
      mouse.active = true;

      clearTimeout(mouse.idleTimer);
      mouse.idleTimer = setTimeout(() => {
        mouse.active = false;
      }, 4000);
    });

    window.addEventListener('mouseleave', () => {
      mouse.active = false;
    });

    // Listen to theme switch to refresh bus pulses with new palette
    window.addEventListener('geospeak-theme-change', () => {
      seedBusPulses();
    });

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    window.addEventListener('resize', resize);
    resize();

    let lastTime = performance.now();

    // Main animation loop
    function render(now) {
      const dt = Math.min((now - lastTime) / 16.666, 3);
      lastTime = now;

      const dark = isDarkMode();

      ctx.clearRect(0, 0, width, height);

      // Smooth mouse interpolation
      if (mouse.active) {
        mouse.x += (mouse.targetX - mouse.x) * 0.15 * dt;
        mouse.y += (mouse.targetY - mouse.y) * 0.15 * dt;
      }

      // Update radar sweep position
      radarX = (radarX + RADAR_SPEED * dt) % (width + 300);
      const sweepX = radarX - 150;

      // ── 1. Draw Grid Lines (Micro Blueprint Grid) ──
      ctx.lineWidth = 1;
      ctx.strokeStyle = dark ? 'rgba(56, 189, 248, 0.06)' : 'rgba(23, 116, 238, 0.04)';

      ctx.beginPath();
      for (let x = 0; x <= width; x += GRID_SPACING) {
        ctx.moveTo(Math.round(x) + 0.5, 0);
        ctx.lineTo(Math.round(x) + 0.5, height);
      }
      for (let y = 0; y <= height; y += GRID_SPACING) {
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(width, Math.round(y) + 0.5);
      }
      ctx.stroke();

      // ── 2. Draw Radar Sweep Beam ──
      if (!prefersReducedMotion) {
        const sweepGrad = ctx.createLinearGradient(sweepX - 80, 0, sweepX + 80, 0);
        if (dark) {
          sweepGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
          sweepGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.065)');
          sweepGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
        } else {
          sweepGrad.addColorStop(0, 'rgba(23, 116, 238, 0)');
          sweepGrad.addColorStop(0.5, 'rgba(23, 116, 238, 0.045)');
          sweepGrad.addColorStop(1, 'rgba(23, 116, 238, 0)');
        }
        ctx.fillStyle = sweepGrad;
        ctx.fillRect(sweepX - 80, 0, 160, height);

        // Thin vertical radar line
        ctx.strokeStyle = dark ? 'rgba(56, 189, 248, 0.22)' : 'rgba(23, 116, 238, 0.12)';
        ctx.beginPath();
        ctx.moveTo(Math.round(sweepX) + 0.5, 0);
        ctx.lineTo(Math.round(sweepX) + 0.5, height);
        ctx.stroke();
      }

      // ── 3. Draw Grid Intersection Crosshairs (+) & Nodes ──
      const ptCount = intersections.length;
      for (let i = 0; i < ptCount; i++) {
        const pt = intersections[i];

        // Distance to radar sweep line
        const distRadar = Math.abs(pt.x - sweepX);
        if (distRadar < 100 && !prefersReducedMotion) {
          const radarGlow = (1 - distRadar / 100) * 0.45;
          if (radarGlow > pt.glow) pt.glow = radarGlow;
        }

        // Distance to mouse reticle
        if (mouse.active) {
          const dx = pt.x - mouse.x;
          const dy = pt.y - mouse.y;
          const distMouse = Math.sqrt(dx * dx + dy * dy);
          if (distMouse < 140) {
            const mouseGlow = (1 - distMouse / 140) * 0.7;
            if (mouseGlow > pt.glow) pt.glow = mouseGlow;
          }
        }

        // Decay glow gradually
        pt.glow = Math.max(0, pt.glow - 0.015 * dt);

        const baseAlpha = dark ? 0.16 : 0.12;
        const totalAlpha = Math.min(baseAlpha + pt.glow, 0.90);

        ctx.strokeStyle = dark
          ? `rgba(56, 189, 248, ${totalAlpha})`
          : `rgba(23, 116, 238, ${totalAlpha})`;
        ctx.lineWidth = pt.glow > 0.3 ? 1.5 : 1;

        const px = Math.round(pt.x) + 0.5;
        const py = Math.round(pt.y) + 0.5;

        ctx.beginPath();
        ctx.moveTo(px - CROSS_SIZE, py);
        ctx.lineTo(px + CROSS_SIZE, py);
        ctx.moveTo(px, py - CROSS_SIZE);
        ctx.lineTo(px, py + CROSS_SIZE);
        ctx.stroke();

        if (pt.glow > 0.25) {
          ctx.fillStyle = dark
            ? `rgba(56, 189, 248, ${pt.glow * 0.9})`
            : `rgba(23, 116, 238, ${pt.glow * 0.8})`;
          ctx.fillRect(px - 1, py - 1, 2, 2);
        }
      }

      // ── 4. Draw Data Bus Pulses ──
      if (!prefersReducedMotion) {
        for (let p = busPulses.length - 1; p >= 0; p--) {
          const pulse = busPulses[p];

          if (pulse.isHorizontal) {
            pulse.x += pulse.speed * dt;
            const py = Math.round(pulse.y) + 0.5;

            const startX = pulse.speed > 0 ? pulse.x - pulse.length : pulse.x + pulse.length;
            const grad = ctx.createLinearGradient(startX, py, pulse.x, py);
            grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
            grad.addColorStop(1, pulse.color);

            ctx.strokeStyle = grad;
            ctx.lineWidth = pulse.size;
            ctx.beginPath();
            ctx.moveTo(startX, py);
            ctx.lineTo(pulse.x, py);
            ctx.stroke();

            ctx.fillStyle = dark ? '#38BDF8' : '#1774EE';
            ctx.fillRect(Math.round(pulse.x) - 1.5, py - 1.5, 3, 3);

            if ((pulse.speed > 0 && pulse.x > width + pulse.length + 50) ||
                (pulse.speed < 0 && pulse.x < -pulse.length - 50)) {
              busPulses[p] = createBusPulse();
            }
          } else {
            pulse.y += pulse.speed * dt;
            const px = Math.round(pulse.x) + 0.5;

            const startY = pulse.speed > 0 ? pulse.y - pulse.length : pulse.y + pulse.length;
            const grad = ctx.createLinearGradient(px, startY, px, pulse.y);
            grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
            grad.addColorStop(1, pulse.color);

            ctx.strokeStyle = grad;
            ctx.lineWidth = pulse.size;
            ctx.beginPath();
            ctx.moveTo(px, startY);
            ctx.lineTo(px, pulse.y);
            ctx.stroke();

            ctx.fillStyle = dark ? '#38BDF8' : '#1774EE';
            ctx.fillRect(px - 1.5, Math.round(pulse.y) - 1.5, 3, 3);

            if ((pulse.speed > 0 && pulse.y > height + pulse.length + 50) ||
                (pulse.speed < 0 && pulse.y < -pulse.length - 50)) {
              busPulses[p] = createBusPulse();
            }
          }
        }
      }

      // ── 5. Draw Floating Terminal Telemetry Badges ──
      ctx.font = '500 10px "Pixelify Sans", monospace';
      ctx.textBaseline = 'top';

      for (let b = activeFloatingBadges.length - 1; b >= 0; b--) {
        const badge = activeFloatingBadges[b];

        if (badge.state === 'in') {
          badge.opacity += badge.fadeSpeed * dt;
          if (badge.opacity >= badge.targetOpacity) {
            badge.opacity = badge.targetOpacity;
            badge.state = 'hold';
          }
        } else if (badge.state === 'hold') {
          badge.holdTime -= dt;
          if (badge.holdTime <= 0) {
            badge.state = 'out';
          }
        } else if (badge.state === 'out') {
          badge.opacity -= badge.fadeSpeed * dt;
          if (badge.opacity <= 0) {
            activeFloatingBadges.splice(b, 1);
            spawnBadge();
            continue;
          }
        }

        ctx.fillStyle = dark
          ? `rgba(56, 189, 248, ${Math.max(0, badge.opacity * 1.1)})`
          : `rgba(23, 116, 238, ${Math.max(0, badge.opacity)})`;
        ctx.fillText(`⌜ ${badge.text} ⌟`, Math.round(badge.x), Math.round(badge.y));
      }

      if (activeFloatingBadges.length < 5) {
        spawnBadge();
      }

      // ── 6. Draw Interactive Mouse Reticle HUD ──
      if (mouse.active) {
        const mx = Math.round(mouse.x);
        const my = Math.round(mouse.y);
        const rSize = 14;

        ctx.strokeStyle = dark ? 'rgba(56, 189, 248, 0.6)' : 'rgba(23, 116, 238, 0.45)';
        ctx.lineWidth = 1.2;

        ctx.beginPath();
        // Top-left
        ctx.moveTo(mx - rSize, my - rSize + 4);
        ctx.lineTo(mx - rSize, my - rSize);
        ctx.lineTo(mx - rSize + 4, my - rSize);

        // Top-right
        ctx.moveTo(mx + rSize - 4, my - rSize);
        ctx.lineTo(mx + rSize, my - rSize);
        ctx.lineTo(mx + rSize, my - rSize + 4);

        // Bottom-left
        ctx.moveTo(mx - rSize, my + rSize - 4);
        ctx.lineTo(mx - rSize, my + rSize);
        ctx.lineTo(mx - rSize + 4, my + rSize);

        // Bottom-right
        ctx.moveTo(mx + rSize - 4, my + rSize);
        ctx.lineTo(mx + rSize, my + rSize);
        ctx.lineTo(mx + rSize, my + rSize - 4);
        ctx.stroke();

        ctx.fillStyle = dark ? 'rgba(56, 189, 248, 0.9)' : 'rgba(23, 116, 238, 0.65)';
        ctx.fillRect(mx - 1, my - 1, 2, 2);

        ctx.font = '500 9px "Pixelify Sans", monospace';
        ctx.fillStyle = dark ? 'rgba(56, 189, 248, 0.75)' : 'rgba(23, 116, 238, 0.55)';
        ctx.fillText(`LOC // [${mx.toString().padStart(4, '0')}, ${my.toString().padStart(4, '0')}]`, mx + rSize + 6, my - 4);
      }

      requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTerminalCanvas);
  } else {
    initTerminalCanvas();
  }
})();

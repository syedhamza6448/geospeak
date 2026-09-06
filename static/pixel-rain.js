/**
 * GeoSpeak — Full-Webpage Raining Pixels Animation
 * "Terminal Chic" digital pixel rain across the entire viewport.
 * Interacts with Apple Glass UI backdrop-filter blurs for realistic optical refraction.
 */
(function () {
  'use strict';

  function initPixelRain() {
    const canvas = document.getElementById('pixel-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = window.devicePixelRatio || 1;

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rebuildColumns();
    }

    const GRID_SIZE = 16; // spacing between pixel rain tracks
    const PIXEL_SIZES = [2, 3, 4, 5];

    let columns = [];

    function createDrop(colIndex, initialY) {
      const sizeIndex = Math.floor(Math.random() * PIXEL_SIZES.length);
      const size = PIXEL_SIZES[sizeIndex];
      // Larger pixels appear closer and move faster
      const speed = 1.2 + size * 0.45 + Math.random() * 1.5;
      const length = 4 + Math.floor(Math.random() * 10);
      const trailDecay = 0.85 + Math.random() * 0.1;
      const brightness = 0.55 + (size / 5) * 0.45;

      return {
        x: colIndex * GRID_SIZE + (GRID_SIZE - size) / 2,
        y: initialY !== undefined ? initialY : -length * (size + 2) - Math.random() * 300,
        speed: speed,
        size: size,
        length: length,
        brightness: brightness,
        active: true,
        // Individual pulse/twinkle offset
        twinkle: Math.random() * Math.PI * 2,
      };
    }

    function rebuildColumns() {
      const colCount = Math.ceil(width / GRID_SIZE) + 1;
      columns = [];

      for (let i = 0; i < colCount; i++) {
        // Density: not every column is active simultaneously for clean aesthetics
        const hasDrop = Math.random() < 0.72;
        const drops = [];
        if (hasDrop) {
          // Spread initial drops across the full height so the page is immediately alive
          const count = 1 + Math.floor(Math.random() * 2);
          for (let d = 0; d < count; d++) {
            drops.push(createDrop(i, Math.random() * height));
          }
        }
        columns.push({
          index: i,
          drops: drops,
          nextSpawn: Math.random() * 200,
        });
      }
    }

    window.addEventListener('resize', resize);
    resize();

    let lastTime = performance.now();

    function frame(now) {
      const dt = Math.min((now - lastTime) / 16.666, 3); // normalized to ~60fps
      lastTime = now;

      ctx.clearRect(0, 0, width, height);

      const colCount = columns.length;
      for (let c = 0; c < colCount; c++) {
        const col = columns[c];

        // Spawn new drops occasionally
        col.nextSpawn -= dt;
        if (col.nextSpawn <= 0 && col.drops.length < 3) {
          col.drops.push(createDrop(col.index));
          col.nextSpawn = 120 + Math.random() * 350;
        }

        for (let d = col.drops.length - 1; d >= 0; d--) {
          const drop = col.drops[d];
          drop.y += drop.speed * dt;
          drop.twinkle += 0.05 * dt;

          const step = drop.size + 2;
          const headY = drop.y;

          // Draw trailing pixels
          for (let i = 0; i < drop.length; i++) {
            const py = headY - i * step;
            if (py < -drop.size || py > height + drop.size) continue;

            // Head pixel is brightest / deep cobalt; tail fades out
            let alpha;
            let fill;

            if (i === 0) {
              // Glowing head pixel - prominent deep cobalt
              alpha = Math.min(drop.brightness * 1.25, 1);
              fill = '#0C4AB8';
            } else if (i === 1) {
              // Transition pixel - vibrant electric blue
              alpha = Math.min(drop.brightness * 1.05, 1);
              fill = '#1774EE';
            } else {
              // Trailing pixels - azure to sky blue
              const progress = (drop.length - i) / drop.length;
              alpha = Math.max(0.32, drop.brightness * progress * 0.85);
              fill = '#2563EB';
            }

            // Subtle twinkle
            const twinkleMod = 0.85 + Math.sin(drop.twinkle + i * 0.8) * 0.15;
            ctx.globalAlpha = Math.max(0, Math.min(1, alpha * twinkleMod));
            ctx.fillStyle = fill;
            ctx.fillRect(Math.round(drop.x), Math.round(py), drop.size, drop.size);
          }

          // Reset drop once fully off-screen
          const totalTailY = headY - drop.length * step;
          if (totalTailY > height + 50) {
            col.drops.splice(d, 1);
          }
        }
      }

      ctx.globalAlpha = 1;
      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPixelRain);
  } else {
    initPixelRain();
  }
})();

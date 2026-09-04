/**
 * GeoSpeak — Interactive Side Pixel Simulation
 * Detaches and merges yellow square pixel clusters along viewport edges.
 */
(function () {
  function initPixelCanvas() {
    const canvas = document.getElementById('pixel-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width = window.innerWidth;
    let height = window.innerHeight;

    function resizeCanvas() {
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Shape catalogs for different pixel counts
    const SHAPES_2 = [
      [[0, 0], [1, 0]],       // horizontal domino
      [[0, 0], [0, 1]],       // vertical domino
    ];
    const SHAPES_3 = [
      [[0, 0], [1, 0], [2, 0]], // horizontal 3-bar
      [[0, 0], [0, 1], [0, 2]], // vertical 3-bar
      [[0, 0], [0, 1], [1, 1]], // L-tromino
      [[1, 0], [0, 1], [1, 1]], // reversed L
      [[0, 0], [1, 0], [1, 1]], // top L
    ];
    const SHAPES_4 = [
      [[0, 0], [1, 0], [0, 1], [1, 1]], // 2x2 square
      [[0, 0], [1, 0], [2, 0], [3, 0]], // 4-bar
      [[0, 0], [0, 1], [0, 2], [0, 3]], // vertical 4-bar
      [[0, 0], [1, 0], [2, 0], [1, 1]], // T-shape
      [[0, 0], [0, 1], [0, 2], [1, 2]], // L-tetromino
    ];
    const SHAPES_6 = [
      [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]], // 2x3 chip block
      [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]], // 3x2 chip block
    ];

    function getShapesForCount(count) {
      if (count === 2) return SHAPES_2;
      if (count === 3) return SHAPES_3;
      if (count === 4) return SHAPES_4;
      return SHAPES_6;
    }

    function easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    function easeOutQuad(t) {
      return 1 - (1 - t) * (1 - t);
    }

    const PIXEL_SIZE = 9;
    const PIXEL_GAP = 2;
    const STEP = PIXEL_SIZE + PIXEL_GAP;

    // Cluster configuration — STRICTLY ON SIDES ONLY (left: 2%-11%, right: 89%-97.5%)
    const CLUSTER_DEFS = [
      // Left side (5 clusters, evenly spread top to bottom)
      { side: 'left', xPct: 0.035, yPct: 0.12, count: 4 },
      { side: 'left', xPct: 0.080, yPct: 0.28, count: 6 },
      { side: 'left', xPct: 0.028, yPct: 0.48, count: 3 },
      { side: 'left', xPct: 0.090, yPct: 0.68, count: 4 },
      { side: 'left', xPct: 0.040, yPct: 0.88, count: 6 },

      // Right side (5 clusters, evenly spread top to bottom)
      { side: 'right', xPct: 0.940, yPct: 0.15, count: 6 },
      { side: 'right', xPct: 0.895, yPct: 0.35, count: 4 },
      { side: 'right', xPct: 0.950, yPct: 0.55, count: 3 },
      { side: 'right', xPct: 0.890, yPct: 0.72, count: 6 },
      { side: 'right', xPct: 0.945, yPct: 0.90, count: 4 },
    ];

    class PixelCluster {
      constructor(def, index) {
        this.def = def;
        this.count = def.count;
        this.shapes = getShapesForCount(this.count);
        this.currentShapeIndex = Math.floor(Math.random() * this.shapes.length);

        // State: 'merged', 'detaching', 'detached', 'merging'
        this.state = 'merged';
        this.stateTime = 0;

        // Stagger initial phase so clusters animate asynchronously
        this.mergedDuration = 1800 + Math.random() * 1200;
        this.detachDuration = 900;
        this.detachedDuration = 1200 + Math.random() * 1000;
        this.mergeDuration = 900;

        this.stateTime = (index * 450) % this.mergedDuration;

        this.pixels = [];
        for (let i = 0; i < this.count; i++) {
          this.pixels.push({
            x: 0,
            y: 0,
            startX: 0,
            startY: 0,
            targetX: 0,
            targetY: 0,
            scatterX: 0,
            scatterY: 0,
            seed: Math.random() * 100,
          });
        }

        this.setupPositions();
      }

      getBasePos() {
        return {
          x: this.def.xPct * width,
          y: this.def.yPct * height
        };
      }

      setupPositions() {
        const base = this.getBasePos();
        const shape = this.shapes[this.currentShapeIndex];

        for (let i = 0; i < this.count; i++) {
          const slot = shape[i] || [0, 0];
          const px = base.x + slot[0] * STEP;
          const py = base.y + slot[1] * STEP;
          this.pixels[i].x = px;
          this.pixels[i].y = py;
          this.pixels[i].targetX = px;
          this.pixels[i].targetY = py;
        }
      }

      prepareDetaching() {
        const base = this.getBasePos();
        for (let i = 0; i < this.count; i++) {
          const p = this.pixels[i];
          p.startX = p.x;
          p.startY = p.y;

          const angle = Math.random() * Math.PI * 2;
          const dist = 18 + Math.random() * 32;

          let rawX = base.x + Math.cos(angle) * dist;
          if (this.def.side === 'left') {
            rawX = Math.max(8, Math.min(rawX, width * 0.125));
          } else {
            rawX = Math.max(width * 0.875, Math.min(rawX, width - 20));
          }

          p.scatterX = rawX;
          p.scatterY = base.y + Math.sin(angle) * dist;
        }
      }

      prepareMerging() {
        const base = this.getBasePos();
        let nextShapeIndex = Math.floor(Math.random() * this.shapes.length);
        if (this.shapes.length > 1 && nextShapeIndex === this.currentShapeIndex) {
          nextShapeIndex = (nextShapeIndex + 1) % this.shapes.length;
        }
        this.currentShapeIndex = nextShapeIndex;
        const shape = this.shapes[this.currentShapeIndex];

        for (let i = 0; i < this.count; i++) {
          const p = this.pixels[i];
          p.startX = p.x;
          p.startY = p.y;

          const slot = shape[i] || [0, 0];
          p.targetX = base.x + slot[0] * STEP;
          p.targetY = base.y + slot[1] * STEP;
        }
      }

      update(dt, now) {
        this.stateTime += dt;

        if (this.state === 'merged') {
          const base = this.getBasePos();
          const shape = this.shapes[this.currentShapeIndex];
          for (let i = 0; i < this.count; i++) {
            const slot = shape[i] || [0, 0];
            this.pixels[i].x = base.x + slot[0] * STEP;
            this.pixels[i].y = base.y + slot[1] * STEP;
          }

          if (this.stateTime >= this.mergedDuration) {
            this.state = 'detaching';
            this.stateTime = 0;
            this.prepareDetaching();
          }
        } else if (this.state === 'detaching') {
          const t = Math.min(this.stateTime / this.detachDuration, 1);
          const ease = easeOutQuad(t);

          for (let i = 0; i < this.count; i++) {
            const p = this.pixels[i];
            p.x = p.startX + (p.scatterX - p.startX) * ease;
            p.y = p.startY + (p.scatterY - p.startY) * ease;
          }

          if (t >= 1) {
            this.state = 'detached';
            this.stateTime = 0;
          }
        } else if (this.state === 'detached') {
          for (let i = 0; i < this.count; i++) {
            const p = this.pixels[i];
            const driftX = Math.sin((now / 1000) * 1.5 + p.seed) * 0.4;
            const driftY = Math.cos((now / 1000) * 1.5 + p.seed) * 0.4;
            p.x = p.scatterX + driftX;
            p.y = p.scatterY + driftY;
          }

          if (this.stateTime >= this.detachedDuration) {
            this.state = 'merging';
            this.stateTime = 0;
            this.prepareMerging();
          }
        } else if (this.state === 'merging') {
          const t = Math.min(this.stateTime / this.mergeDuration, 1);
          const ease = easeInOutCubic(t);

          for (let i = 0; i < this.count; i++) {
            const p = this.pixels[i];
            p.x = p.startX + (p.targetX - p.startX) * ease;
            p.y = p.startY + (p.targetY - p.startY) * ease;
          }

          if (t >= 1) {
            this.state = 'merged';
            this.stateTime = 0;
            this.mergedDuration = 1800 + Math.random() * 1200;
          }
        }
      }

      draw(ctx) {
        ctx.fillStyle = '#FDE74C';

        for (let i = 0; i < this.count; i++) {
          const p = this.pixels[i];
          const px = Math.round(p.x);
          const py = Math.round(p.y);

          if (this.state === 'merged') {
            ctx.globalAlpha = 0.95;
          } else {
            ctx.globalAlpha = 0.80;
          }

          ctx.fillRect(px, py, PIXEL_SIZE, PIXEL_SIZE);
        }
        ctx.globalAlpha = 1;
      }
    }

    const clusters = CLUSTER_DEFS.map((def, i) => new PixelCluster(def, i));

    let lastTime = performance.now();
    function loop(now) {
      const dt = Math.min(now - lastTime, 100);
      lastTime = now;

      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < clusters.length; i++) {
        clusters[i].update(dt, now);
        clusters[i].draw(ctx);
      }

      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPixelCanvas);
  } else {
    initPixelCanvas();
  }
})();

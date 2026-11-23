import { iconHTML } from '../core/icons.js';

function safeEval(expr, x) {
  try {
    // 1. Pre-process the string
    let clean = expr
      .replace(/\^/g, '**')
      .replace(/sin/g, 'Math.sin')
      .replace(/cos/g, 'Math.cos')
      .replace(/tan/g, 'Math.tan')
      .replace(/sqrt/g, 'Math.sqrt')
      .replace(/abs/g, 'Math.abs')
      .replace(/log/g, 'Math.log')
      .replace(/pi/g, 'Math.PI')
      .replace(/e/g, 'Math.E');

    // 2. Evaluate using Function (safe because we control the scope)
    const fn = new Function('x', `return ${clean};`);
    return fn(x);
  } catch {
    return NaN;
  }
}

export const graphCalcApp = {
  id: 'graphcalc',
  name: 'GraphCalc',
  icon: 'calc',
  defaultSize: [800, 600],

  launch(body, args, ctx) {
    let equations = [
      { expr: 'sin(x)', id: 1 }
    ];
    let idCounter = 2;
    
    // Camera state
    let zoom = 50; // pixels per unit
    let offsetX = 0;
    let offsetY = 0;
    let isPanning = false;
    let startX = 0;
    let startY = 0;

    body.innerHTML = `
      <div class="gc-app">
        <div class="gc-sidebar">
          <div class="gc-sidebar-header">
            <span>Equations</span>
            <button class="toolbar-btn" id="gc-add" style="height:20px; padding:0 4px;">${iconHTML('plus', 12)}</button>
          </div>
          <div class="gc-equation-list" id="gc-list"></div>
          <div class="gc-toolbar">
            <button id="gc-zoom-in">${iconHTML('zoom-in', 14)}</button>
            <button id="gc-zoom-out">${iconHTML('zoom-out', 14)}</button>
            <button id="gc-reset">${iconHTML('refresh', 14)}</button>
          </div>
        </div>
        <div class="gc-canvas-wrap">
          <canvas class="gc-canvas" id="gc-canvas"></canvas>
        </div>
      </div>
    `;

    const canvas = body.querySelector('#gc-canvas');
    const ctx2d = canvas.getContext('2d');
    const listEl = body.querySelector('#gc-list');
    const btnAdd = body.querySelector('#gc-add');
    const btnZoomIn = body.querySelector('#gc-zoom-in');
    const btnZoomOut = body.querySelector('#gc-zoom-out');
    const btnReset = body.querySelector('#gc-reset');

    // --- Equation Management ---
    function renderList() {
      listEl.innerHTML = '';
      equations.forEach((eq, index) => {
        const row = document.createElement('div');
        row.className = 'gc-eq-item';
        row.innerHTML = `
          <div class="gc-eq-color"></div>
          <input type="text" value="${eq.expr}" spellcheck="false" data-id="${eq.id}">
          <button class="gc-remove" title="Remove" ${equations.length === 1 ? 'disabled' : ''}>
            ${iconHTML('close', 12)}
          </button>
        `;
        
        const input = row.querySelector('input');
        input.addEventListener('input', (e) => {
          eq.expr = e.target.value;
          draw();
        });

        row.querySelector('.gc-remove').onclick = () => {
          if (equations.length <= 1) return;
          equations = equations.filter(e => e.id !== eq.id);
          renderList();
          draw();
        };

        listEl.appendChild(row);
      });
    }

    btnAdd.onclick = () => {
      equations.push({ expr: '', id: idCounter++ });
      renderList();
      // Focus the new input
      setTimeout(() => {
        const inputs = listEl.querySelectorAll('input');
        inputs[inputs.length - 1].focus();
      }, 10);
    };

    // --- Canvas Logic ---
    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      draw();
    }
    new ResizeObserver(resize).observe(canvas.parentElement);

    function draw() {
      const w = canvas.width;
      const h = canvas.height;
      if (w === 0 || h === 0) return;

      ctx2d.clearRect(0, 0, w, h);
      
      // 1. Draw Grid
      const step = zoom; 
      
      // Grid lines
      ctx2d.strokeStyle = 'var(--shade-10)';
      ctx2d.lineWidth = 1;
      
      const originX = w / 2 + offsetX;
      const originY = h / 2 + offsetY;

      // Vertical lines
      const startX = originX % step;
      for (let x = startX; x < w; x += step) {
        ctx2d.beginPath(); ctx2d.moveTo(x, 0); ctx2d.lineTo(x, h); ctx2d.stroke();
      }
      // Horizontal lines
      const startY = originY % step;
      for (let y = startY; y < h; y += step) {
        ctx2d.beginPath(); ctx2d.moveTo(0, y); ctx2d.lineTo(w, y); ctx2d.stroke();
      }

      // 2. Draw Axes
      ctx2d.strokeStyle = 'var(--ink)';
      ctx2d.lineWidth = 2;
      
      // X-Axis
      ctx2d.beginPath(); ctx2d.moveTo(0, originY); ctx2d.lineTo(w, originY); ctx2d.stroke();
      // Y-Axis
      ctx2d.beginPath(); ctx2d.moveTo(originX, 0); ctx2d.lineTo(originX, h); ctx2d.stroke();

      // 3. Draw Equations
      equations.forEach((eq, index) => {
        if (!eq.expr.trim()) return;
        
        ctx2d.strokeStyle = index === 0 ? 'var(--ink)' : 'var(--shade-50)';
        ctx2d.lineWidth = 2;
        if (index > 1) ctx2d.setLineDash([5, 5]);
        else ctx2d.setLineDash([]);
        
        ctx2d.beginPath();
        let penDown = false;

        for (let px = 0; px < w; px++) {
          // Map screen X to math X
          const mx = (px - originX) / zoom;
          
          // Calculate math Y
          const my = safeEval(eq.expr, mx);
          
          if (isNaN(my) || !isFinite(my)) {
            penDown = false;
            continue;
          }

          // Map math Y to screen Y
          const py = originY - (my * zoom);

          if (!penDown) {
            ctx2d.moveTo(px, py);
            penDown = true;
          } else {
            ctx2d.lineTo(px, py);
          }
        }
        ctx2d.stroke();
      });
    }

    // --- Interaction (Pan & Zoom) ---
    canvas.addEventListener('pointerdown', (e) => {
      isPanning = true;
      startX = e.clientX - offsetX;
      startY = e.clientY - offsetY;
      canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!isPanning) return;
      offsetX = e.clientX - startX;
      offsetY = e.clientY - startY;
      draw();
    });

    canvas.addEventListener('pointerup', (e) => {
      isPanning = false;
      canvas.releasePointerCapture(e.pointerId);
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = zoom * zoomFactor;

      // Limit zoom
      if (newZoom < 5 || newZoom > 500) return;

      // Zoom toward mouse cursor
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const originX = canvas.width / 2 + offsetX;
      const originY = canvas.height / 2 + offsetY;

      offsetX -= (mouseX - originX) * (zoomFactor - 1);
      offsetY -= (mouseY - originY) * (zoomFactor - 1);
      
      zoom = newZoom;
      draw();
    }, { passive: false });

    btnZoomIn.onclick = () => { zoom *= 1.2; draw(); };
    btnZoomOut.onclick = () => { zoom /= 1.2; draw(); };
    btnReset.onclick = () => { zoom = 50; offsetX = 0; offsetY = 0; draw(); };

    // Init
    renderList();
    resize();
  }
};

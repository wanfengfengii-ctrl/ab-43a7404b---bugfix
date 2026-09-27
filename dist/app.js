/* 彩窗铅条骨架编排 —— 页面交互 */
(function () {
  'use strict';

  const Solver = window.SkeletonSolver;
  const $ = (sel) => document.querySelector(sel);

  const state = {
    pieces: [],     // {id, minDeg, maxDeg}
    candidates: [], // {a, b, grade, cost}
  };

  /* ---------------- 编辑表格 ---------------- */

  function textInput(value, onChange) {
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.value = value;
    inp.maxLength = 12;
    inp.addEventListener('input', () => onChange(inp.value));
    return inp;
  }

  function numInput(value, onChange, opts) {
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.value = value;
    inp.min = opts && opts.min != null ? opts.min : '';
    inp.step = opts && opts.step != null ? opts.step : '1';
    inp.addEventListener('input', () => {
      onChange(inp.value === '' ? NaN : Number(inp.value));
    });
    return inp;
  }

  function cell(node) {
    const td = document.createElement('td');
    td.appendChild(node);
    return td;
  }

  function delButton(enabled, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'row-del';
    btn.textContent = '✕';
    btn.disabled = !enabled;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function renderEditors() {
    const pb = $('#pieces-tbody');
    pb.innerHTML = '';
    state.pieces.forEach((p, i) => {
      const tr = document.createElement('tr');
      tr.appendChild(cell(textInput(p.id, (v) => { p.id = v; })));
      tr.appendChild(cell(numInput(p.minDeg, (v) => { p.minDeg = v; }, { min: 0 })));
      tr.appendChild(cell(numInput(p.maxDeg, (v) => { p.maxDeg = v; }, { min: 0 })));
      tr.appendChild(cell(delButton(state.pieces.length > Solver.MIN_PIECES, () => {
        state.pieces.splice(i, 1);
        renderEditors();
      })));
      pb.appendChild(tr);
    });
    $('#add-piece').disabled = state.pieces.length >= Solver.MAX_PIECES;

    const cb = $('#candidates-tbody');
    cb.innerHTML = '';
    state.candidates.forEach((c, i) => {
      const tr = document.createElement('tr');
      const no = document.createElement('td');
      no.textContent = `#${i + 1}`;
      tr.appendChild(no);
      tr.appendChild(cell(textInput(c.a, (v) => { c.a = v; })));
      tr.appendChild(cell(textInput(c.b, (v) => { c.b = v; })));
      tr.appendChild(cell(numInput(c.grade, (v) => { c.grade = v; }, { min: 0 })));
      tr.appendChild(cell(numInput(c.cost, (v) => { c.cost = v; }, { min: 0, step: 'any' })));
      tr.appendChild(cell(delButton(state.candidates.length > Solver.MIN_CANDIDATES, () => {
        state.candidates.splice(i, 1);
        renderEditors();
      })));
      cb.appendChild(tr);
    });
    $('#add-candidate').disabled = state.candidates.length >= Solver.MAX_CANDIDATES;
  }

  function nextPieceId() {
    let k = 1;
    const used = new Set(state.pieces.map((p) => String(p.id).trim()));
    while (used.has(String(k))) k++;
    return String(k);
  }

  /* ---------------- 结果渲染 ---------------- */

  function hideResults() {
    ['#errors', '#summary', '#evidence-panel', '#canvas-panel',
      '#adopted-panel', '#rejected-panel', '#degrees-panel',
    ].forEach((sel) => { $(sel).hidden = true; });
  }

  function showErrors(errors) {
    const box = $('#errors');
    box.innerHTML = '<strong>录入校验未通过：</strong>';
    const ul = document.createElement('ul');
    errors.forEach((e) => {
      const li = document.createElement('li');
      li.textContent = e;
      ul.appendChild(li);
    });
    box.appendChild(ul);
    box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function fillBarTable(tbodySel, indices) {
    const tbody = $(tbodySel);
    tbody.innerHTML = '';
    indices.forEach((i) => {
      const c = state.candidates[i];
      const tr = document.createElement('tr');
      [`#${i + 1}`, String(c.a).trim(), String(c.b).trim(), c.grade, c.cost]
        .forEach((v) => {
          const td = document.createElement('td');
          td.textContent = v;
          tr.appendChild(td);
        });
      tbody.appendChild(tr);
    });
  }

  function showSolution(res) {
    const summary = $('#summary');
    summary.innerHTML = '';
    const cards = [
      ['采用铅条', `${res.adopted.length} 条（玻璃片 ${state.pieces.length} 片）`],
      ['最弱采用铅条等级', res.minGrade],
      ['总代价', res.totalCost],
      ['骨架形态', '连通 · 无环 · 连接数全部达标'],
    ];
    cards.forEach(([label, value]) => {
      const card = document.createElement('div');
      card.className = 'card';
      const l = document.createElement('div');
      l.className = 'label';
      l.textContent = label;
      const v = document.createElement('div');
      v.className = 'value';
      v.textContent = value;
      card.appendChild(l);
      card.appendChild(v);
      summary.appendChild(card);
    });
    summary.hidden = false;

    fillBarTable('#adopted-table tbody', res.adopted);
    fillBarTable('#rejected-table tbody', res.rejected);
    $('#adopted-panel').hidden = false;
    $('#rejected-panel').hidden = false;

    const tbody = $('#degrees-table tbody');
    tbody.innerHTML = '';
    const sorted = state.pieces
      .map((p) => String(p.id).trim())
      .sort(Solver.compareIds);
    sorted.forEach((id) => {
      const p = state.pieces.find((x) => String(x.id).trim() === id);
      const actual = res.degrees[id];
      const ok = actual >= p.minDeg && actual <= p.maxDeg;
      const tr = document.createElement('tr');
      [id, actual, `[${p.minDeg}, ${p.maxDeg}]`].forEach((v) => {
        const td = document.createElement('td');
        td.textContent = v;
        tr.appendChild(td);
      });
      const mark = document.createElement('td');
      mark.textContent = ok ? '✓' : '✗';
      mark.className = ok ? 'ok-mark' : 'bad-mark';
      tr.appendChild(mark);
      tbody.appendChild(tr);
    });
    $('#degrees-panel').hidden = false;
  }

  function showEvidence(evidence) {
    const list = $('#evidence-list');
    list.innerHTML = '';
    evidence.forEach((ev, i) => {
      const li = document.createElement('li');
      if (i === 0) li.className = 'first';
      const tag = document.createElement('span');
      tag.className = `tag ${ev.type}`;
      tag.textContent = ev.type === 'range' ? '连接范围' : '连通性';
      li.appendChild(tag);
      li.appendChild(document.createTextNode(ev.message));
      list.appendChild(li);
    });
    $('#evidence-panel').hidden = false;
  }

  /* ---------------- 骨架结构画布 ---------------- */

  function drawSkeleton(res) {
    const canvas = $('#skeleton-canvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.font = '12px sans-serif';

    const ids = state.pieces.map((p) => String(p.id).trim()).sort(Solver.compareIds);
    const n = ids.length;
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(W, H) / 2 - 78;
    const pos = {};
    ids.forEach((id, i) => {
      const ang = -Math.PI / 2 + (2 * Math.PI * i) / n;
      pos[id] = { x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang) };
    });

    const adopted = new Set(res && res.status === 'ok' ? res.adopted : []);

    // 平行边分组，绘制时横向错开
    const groups = new Map();
    state.candidates.forEach((c, i) => {
      const key = [String(c.a).trim(), String(c.b).trim()].sort(Solver.compareIds).join('|');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(i);
    });

    state.candidates.forEach((c, i) => {
      const a = String(c.a).trim();
      const b = String(c.b).trim();
      if (!pos[a] || !pos[b]) return;
      const g = groups.get([a, b].sort(Solver.compareIds).join('|'));
      const k = g.indexOf(i) - (g.length - 1) / 2;
      const p1 = pos[a];
      const p2 = pos[b];
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy) || 1;
      const off = k * 26;
      const ctrl = { x: mx - (dy / len) * off, y: my + (dx / len) * off };

      const isAdopted = adopted.has(i);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.quadraticCurveTo(ctrl.x, ctrl.y, p2.x, p2.y);
      ctx.strokeStyle = isAdopted ? '#0b7285' : '#b6bcc7';
      ctx.lineWidth = isAdopted ? 4 : 1.5;
      ctx.setLineDash(isAdopted ? [] : [5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // 边标签：序号 / 等级 / 代价（二次贝塞尔 t=0.5 处）
      const lx = 0.25 * p1.x + 0.5 * ctrl.x + 0.25 * p2.x;
      const ly = 0.25 * p1.y + 0.5 * ctrl.y + 0.25 * p2.y;
      ctx.fillStyle = isAdopted ? '#0b7285' : '#8a919e';
      ctx.textAlign = 'center';
      ctx.fillText(`#${i + 1} G${c.grade} ¥${c.cost}`, lx, ly - 4);
    });

    ids.forEach((id) => {
      const p = pos[id];
      ctx.beginPath();
      ctx.arc(p.x, p.y, 22, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#1864ab';
      ctx.stroke();
      ctx.fillStyle = '#1864ab';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(id, p.x, p.y);
      ctx.textBaseline = 'alphabetic';

      const piece = state.pieces.find((x) => String(x.id).trim() === id);
      const actual = res && res.status === 'ok' ? res.degrees[id] : null;
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#6b7280';
      const info = actual != null
        ? `连接 ${actual} ∈ [${piece.minDeg}, ${piece.maxDeg}]`
        : `[${piece.minDeg}, ${piece.maxDeg}]`;
      ctx.fillText(info, p.x, p.y + 38);
    });

    $('#canvas-panel').hidden = false;
  }

  /* ---------------- 编排入口 ---------------- */

  function onSolve() {
    hideResults();
    const errors = Solver.validate(state.pieces, state.candidates);
    if (errors.length) {
      showErrors(errors);
      return;
    }
    const res = Solver.solve(state.pieces, state.candidates);
    if (res.status === 'ok') {
      showSolution(res);
    } else {
      showEvidence(res.evidence);
    }
    drawSkeleton(res);
  }

  /* ---------------- 初始化 ---------------- */

  function loadSample() {
    const s = window.SkeletonSample.SKELETON_SAMPLE;
    state.pieces = s.pieces.map((p) => ({ ...p }));
    state.candidates = s.candidates.map((c) => ({ ...c }));
    renderEditors();
    hideResults();
  }

  $('#add-piece').addEventListener('click', () => {
    if (state.pieces.length >= Solver.MAX_PIECES) return;
    state.pieces.push({ id: nextPieceId(), minDeg: 1, maxDeg: 2 });
    renderEditors();
  });

  $('#add-candidate').addEventListener('click', () => {
    if (state.candidates.length >= Solver.MAX_CANDIDATES) return;
    const ids = state.pieces.map((p) => String(p.id).trim());
    state.candidates.push({
      a: ids[0] || '1',
      b: ids[1] || '2',
      grade: 5,
      cost: 1,
    });
    renderEditors();
  });

  $('#load-sample').addEventListener('click', loadSample);
  $('#solve-btn').addEventListener('click', onSolve);

  loadSample();
})();

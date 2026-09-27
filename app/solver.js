/*
 * 彩窗铅条骨架求解器
 * ------------------
 * 从候选铅条中联合选择恰好「玻璃片数 - 1」条，使：
 *   1. 全部玻璃片连通；
 *   2. 任意子集不形成环（即整体为生成树）；
 *   3. 每片玻璃片的实际连接数落在其闭区间 [minDeg, maxDeg] 内。
 * 在所有合格骨架中按优先级依次取：
 *   ① 最弱采用铅条等级最高（最大化最小抗拉等级）；
 *   ② 总代价最低（按录入的十进制代价精确求和比较，见 costDecimals 注释）；
 *   ③ 采用候选的录入序号序列（升序）字典序最小。
 * 无解时给出按玻璃片编号排序的失败证据（连接范围 / 连通性）。
 *
 * 同时兼容浏览器（window.SkeletonSolver）与 Node（module.exports）。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SkeletonSolver = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  const MIN_PIECES = 5;
  const MAX_PIECES = 8;
  const MIN_CANDIDATES = 8;
  const MAX_CANDIDATES = 14;

  /*
   * 十进制代价精确比较：
   * 录入代价允许小数（如 0.1 / 0.2），直接以 IEEE-754 浮点求和会出现
   * 0.2 + 0.1 = 0.30000000000000004 ≠ 0.3 的偏差，使十进制总代价相等的
   * 可行骨架无法进入第 ③ 级序号裁决。为此按录入的小数位把代价放大为整数
   * （统一放大 10^d 倍，d 为全部候选中的最大小数位），整数求和与比较均精确；
   * 总代价再缩回十进制输出。小数位上限 9 位：兼顾录入精度与整数求和不溢出
   * （代价 ≤ 1e6 时 14 条求和仍远低于 Number.MAX_SAFE_INTEGER）。
   * 真实存在的总代价差（只要不超过该精度）仍按数值严格裁决，不会被当作并列。
   */
  const MAX_COST_DECIMALS = 9;

  /* 数值 x 的十进制小数位数（兼容 1e-7 等科学计数法表示） */
  function costDecimals(x) {
    const s = String(x);
    const e = s.indexOf('e');
    const dot = s.indexOf('.');
    if (e === -1) return dot === -1 ? 0 : s.length - dot - 1;
    const frac = dot === -1 || dot > e ? 0 : e - dot - 1;
    return Math.max(0, frac - Number(s.slice(e + 1)));
  }

  /* 编号排序：纯数字按数值，否则按字符串（确定性，保证证据稳定排序） */
  function compareIds(a, b) {
    const sa = String(a).trim();
    const sb = String(b).trim();
    const na = Number(sa);
    const nb = Number(sb);
    const fa = sa !== '' && Number.isFinite(na);
    const fb = sb !== '' && Number.isFinite(nb);
    if (fa && fb) return na - nb;
    return sa < sb ? -1 : sa > sb ? 1 : 0;
  }

  /* 录入校验，返回错误信息数组（空数组表示通过） */
  function validate(pieces, candidates) {
    const errors = [];
    const pn = Array.isArray(pieces) ? pieces.length : 0;
    const cn = Array.isArray(candidates) ? candidates.length : 0;
    if (pn < MIN_PIECES || pn > MAX_PIECES) {
      errors.push(`玻璃片数量须为 ${MIN_PIECES}~${MAX_PIECES} 片，当前 ${pn} 片`);
    }
    if (cn < MIN_CANDIDATES || cn > MAX_CANDIDATES) {
      errors.push(`候选铅条数量须为 ${MIN_CANDIDATES}~${MAX_CANDIDATES} 条，当前 ${cn} 条`);
    }
    if (errors.length) return errors;

    const seen = new Set();
    pieces.forEach((p, i) => {
      const id = String(p && p.id != null ? p.id : '').trim();
      if (!id) errors.push(`第 ${i + 1} 片玻璃片编号为空`);
      else if (seen.has(id)) errors.push(`玻璃片编号重复：${id}`);
      else seen.add(id);
      if (!Number.isInteger(p.minDeg) || p.minDeg < 0) {
        errors.push(`玻璃片 ${id || i + 1} 的连接数下限须为非负整数`);
      }
      if (!Number.isInteger(p.maxDeg) || p.maxDeg < p.minDeg) {
        errors.push(`玻璃片 ${id || i + 1} 的连接数上限须为不小于下限的整数`);
      }
    });
    candidates.forEach((c, i) => {
      const a = String(c && c.a != null ? c.a : '').trim();
      const b = String(c && c.b != null ? c.b : '').trim();
      if (!seen.has(a)) errors.push(`第 ${i + 1} 条候选铅条端点「${a || '(空)'}」不存在`);
      if (!seen.has(b)) errors.push(`第 ${i + 1} 条候选铅条端点「${b || '(空)'}」不存在`);
      if (a && b && a === b) errors.push(`第 ${i + 1} 条候选铅条两端不能为同一片玻璃`);
      if (!Number.isFinite(c.grade)) errors.push(`第 ${i + 1} 条候选铅条抗拉等级须为数值`);
      if (!Number.isFinite(c.cost) || c.cost < 0) errors.push(`第 ${i + 1} 条候选铅条安装代价须为非负数值`);
    });
    return errors;
  }

  /* 生成 C(m, k) 的全部组合（元素为 0 基序号，升序） */
  function* combinations(m, k, start, prefix) {
    start = start || 0;
    prefix = prefix || [];
    if (prefix.length === k) {
      yield prefix;
      return;
    }
    for (let i = start; i <= m - (k - prefix.length); i++) {
      prefix.push(i);
      yield* combinations(m, k, i + 1, prefix);
      prefix.pop();
    }
  }

  /* 方案比较：a 严格优于 b 时返回 true */
  function isBetter(a, b) {
    if (a.minGrade !== b.minGrade) return a.minGrade > b.minGrade; // ① 最弱等级最高
    if (a.cost !== b.cost) return a.cost < b.cost;                 // ② 总代价最低
    for (let i = 0; i < a.indices.length; i++) {                   // ③ 序号序列字典序最小
      if (a.indices[i] !== b.indices[i]) return a.indices[i] < b.indices[i];
    }
    return false;
  }

  function normalize(pieces, candidates) {
    const normPieces = pieces.map((p) => ({
      id: String(p.id).trim(),
      minDeg: p.minDeg,
      maxDeg: p.maxDeg,
    }));
    const indexOf = new Map(normPieces.map((p, i) => [p.id, i]));
    const edges = candidates.map((c) => ({
      a: indexOf.get(String(c.a).trim()),
      b: indexOf.get(String(c.b).trim()),
      grade: c.grade,
      cost: c.cost,
    }));
    return { pieces: normPieces, edges };
  }

  /*
   * 求解主入口。
   * 返回：
   *  { status:'ok', adopted, rejected, degrees, minGrade, totalCost }
   *  { status:'infeasible', evidence:[{pieceId,type,message}...] }（按编号排序）
   *  { status:'invalid', errors:[...] }
   */
  function solve(pieces, candidates) {
    const errors = validate(pieces, candidates);
    if (errors.length) return { status: 'invalid', errors };

    const { pieces: ps, edges } = normalize(pieces, candidates);
    const n = ps.length;
    const m = edges.length;
    const need = n - 1; // 恰好比玻璃片数少一条

    // 十进制代价放大为整数，保证总代价按录入精度精确求和、精确比较
    let decimals = 0;
    for (const e of edges) decimals = Math.max(decimals, costDecimals(e.cost));
    const scale = 10 ** Math.min(decimals, MAX_COST_DECIMALS);
    edges.forEach((e) => { e.costInt = Math.round(e.cost * scale); });

    let best = null;
    for (const combo of combinations(m, need, 0, [])) {
      // 并查集：检环 + 连通（n-1 条边且无环 ⇒ 必为连通生成树，任意子集亦无环）
      const parent = Array.from({ length: n }, (_, i) => i);
      const find = (x) => {
        while (parent[x] !== x) {
          parent[x] = parent[parent[x]];
          x = parent[x];
        }
        return x;
      };
      const deg = new Array(n).fill(0);
      let acyclic = true;
      for (const ci of combo) {
        const e = edges[ci];
        const ra = find(e.a);
        const rb = find(e.b);
        if (ra === rb) { acyclic = false; break; }
        parent[ra] = rb;
        deg[e.a]++;
        deg[e.b]++;
      }
      if (!acyclic) continue;

      let fit = true;
      for (let i = 0; i < n; i++) {
        if (deg[i] < ps[i].minDeg || deg[i] > ps[i].maxDeg) { fit = false; break; }
      }
      if (!fit) continue;

      let minGrade = Infinity;
      let cost = 0;
      for (const ci of combo) {
        if (edges[ci].grade < minGrade) minGrade = edges[ci].grade;
        cost += edges[ci].costInt; // 整数累加，十进制总代价精确
      }
      const candidate = { indices: combo.slice(), minGrade, cost, deg };
      if (!best || isBetter(candidate, best)) best = candidate;
    }

    if (!best) {
      return { status: 'infeasible', evidence: diagnose(ps, edges) };
    }

    const adoptedSet = new Set(best.indices);
    const degrees = {};
    ps.forEach((p, i) => { degrees[p.id] = best.deg[i]; });
    return {
      status: 'ok',
      adopted: best.indices,
      rejected: edges.map((_, i) => i).filter((i) => !adoptedSet.has(i)),
      degrees,
      minGrade: best.minGrade,
      totalCost: best.cost / scale, // 缩回十进制（如整数 3 / 10 = 0.3）
    };
  }

  /*
   * 无解诊断：按玻璃片编号排序，依次报告
   *   - 连接范围证据（range）：上限为 0 / 可用候选数低于下限 / 全局上下限之和越界；
   *   - 连通性证据（connectivity）：所在连通分量无法覆盖全部玻璃片。
   */
  function diagnose(ps, edges) {
    const n = ps.length;
    const parent = Array.from({ length: n }, (_, i) => i);
    const find = (x) => {
      while (parent[x] !== x) {
        parent[x] = parent[parent[x]];
        x = parent[x];
      }
      return x;
    };
    const incident = new Array(n).fill(0);
    edges.forEach((e) => {
      incident[e.a]++;
      incident[e.b]++;
      parent[find(e.a)] = find(e.b);
    });
    const compSize = new Array(n).fill(0);
    for (let i = 0; i < n; i++) compSize[find(i)]++;

    const order = ps.map((_, i) => i).sort((x, y) => compareIds(ps[x].id, ps[y].id));
    const evidence = [];
    for (const i of order) {
      const p = ps[i];
      if (p.maxDeg < 1) {
        evidence.push({
          pieceId: p.id,
          type: 'range',
          message: `玻璃片 ${p.id}：连接数上限为 ${p.maxDeg}，骨架中每片至少需 1 条连接`,
        });
      } else if (incident[i] < p.minDeg) {
        evidence.push({
          pieceId: p.id,
          type: 'range',
          message: `玻璃片 ${p.id}：仅 ${incident[i]} 条候选铅条可用，低于连接数下限 ${p.minDeg}`,
        });
      } else if (compSize[find(i)] < n) {
        evidence.push({
          pieceId: p.id,
          type: 'connectivity',
          message: `玻璃片 ${p.id}：所在连通分量仅 ${compSize[find(i)]} 片，无法与全部 ${n} 片玻璃片连通`,
        });
      }
    }
    if (!evidence.length) {
      const sumMin = ps.reduce((s, p) => s + p.minDeg, 0);
      const sumMax = ps.reduce((s, p) => s + p.maxDeg, 0);
      const total = 2 * (n - 1); // 骨架 n-1 条铅条可提供的连接数总和
      const first = ps[order[0]].id;
      if (sumMin > total) {
        evidence.push({
          pieceId: first,
          type: 'range',
          message: `全部连接数下限之和 ${sumMin} 超过骨架可承载的 ${total}（${n} 片需 ${n - 1} 条铅条）`,
        });
      } else if (sumMax < total) {
        evidence.push({
          pieceId: first,
          type: 'range',
          message: `全部连接数上限之和 ${sumMax} 低于骨架所需的 ${total}（${n} 片需 ${n - 1} 条铅条）`,
        });
      } else {
        evidence.push({
          pieceId: first,
          type: 'range',
          message: '各片连接数区间在无环骨架结构下无法同时满足',
        });
      }
    }
    return evidence;
  }

  return {
    MIN_PIECES,
    MAX_PIECES,
    MIN_CANDIDATES,
    MAX_CANDIDATES,
    compareIds,
    validate,
    solve,
    diagnose,
  };
});

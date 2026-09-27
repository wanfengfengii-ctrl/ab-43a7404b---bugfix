/*
 * 彩窗铅条骨架求解器
 * ------------------
 * 从候选铅条中联合选择恰好「玻璃片数 - 1」条，使：
 *   1. 全部玻璃片连通；
 *   2. 任意子集不形成环（即整体为生成树）；
 *   3. 每片玻璃片的实际连接数落在其闭区间 [minDeg, maxDeg] 内。
 * 在所有合格骨架中按优先级依次取：
 *   ① 最弱采用铅条等级最高（最大化最小抗拉等级）；
 *   ② 总代价最低（十进制精确求和与比较，小数代价并列可进入下级裁决）；
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

  /*
   * 十进制代价的精确表示：录入代价为十进制小数，二进制浮点求和会产生误差
   * （如 0.2 + 0.1 ≠ 0.3），使总代价并列的可行骨架被误判为更贵、无法进入
   * 序号裁决。这里把每条代价解析为「整数 × 10^exp」，全部代价统一按最小
   * 指数缩放为整数键（BigInt），求和与比较都在整数键上进行，真实代价差
   * 与十进制并列都能被精确区分。
   */
  function toDecimal(value) {
    let s = String(value);
    let exp = 0;
    const e = s.indexOf('e');
    if (e >= 0) {
      exp = Number(s.slice(e + 1));
      s = s.slice(0, e);
    }
    const dot = s.indexOf('.');
    if (dot >= 0) {
      exp -= s.length - dot - 1;
      s = s.slice(0, dot) + s.slice(dot + 1);
    }
    return { digits: BigInt(s), exp };
  }

  /* 由「整数 × 10^exp」还原展示用数值（经十进制字符串解析，结果确定） */
  function decimalValue(digits, exp) {
    const s = digits.toString();
    if (exp >= 0) return Number(s + '0'.repeat(exp));
    const point = s.length + exp;
    return Number(point > 0
      ? s.slice(0, point) + '.' + s.slice(point)
      : '0.' + '0'.repeat(-point) + s);
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
    if (a.costKey !== b.costKey) return a.costKey < b.costKey;     // ② 总代价最低（十进制精确）
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
    // 十进制精确化：以全部代价的最小十进制指数为公共单位，缩放为整数代价键
    const decimals = edges.map((e) => toDecimal(e.cost));
    const costExp = Math.min(...decimals.map((d) => d.exp));
    edges.forEach((e, i) => {
      e.costKey = decimals[i].digits * 10n ** BigInt(decimals[i].exp - costExp);
    });
    return { pieces: normPieces, edges, costExp };
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

    const { pieces: ps, edges, costExp } = normalize(pieces, candidates);
    const n = ps.length;
    const m = edges.length;
    const need = n - 1; // 恰好比玻璃片数少一条

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
      let costKey = 0n;
      for (const ci of combo) {
        if (edges[ci].grade < minGrade) minGrade = edges[ci].grade;
        costKey += edges[ci].costKey;
      }
      const candidate = { indices: combo.slice(), minGrade, costKey, deg };
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
      totalCost: decimalValue(best.costKey, costExp),
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

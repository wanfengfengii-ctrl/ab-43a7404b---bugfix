/* 求解器单元测试：node tests/run-tests.js */
'use strict';

const assert = require('node:assert');
const path = require('path');

const solver = require(path.join(__dirname, '..', 'app', 'solver.js'));
const { SKELETON_SAMPLE } = require(path.join(__dirname, '..', 'app', 'sample.js'));

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log('求解器单元测试');

test('骨架样例：采用序号、最弱等级、总代价、各片连接数精确匹配', () => {
  const res = solver.solve(SKELETON_SAMPLE.pieces, SKELETON_SAMPLE.candidates);
  assert.strictEqual(res.status, 'ok');
  assert.deepStrictEqual(res.adopted, SKELETON_SAMPLE.expected.adopted);
  assert.strictEqual(res.minGrade, SKELETON_SAMPLE.expected.minGrade);
  assert.strictEqual(res.totalCost, SKELETON_SAMPLE.expected.totalCost);
  assert.deepStrictEqual(res.degrees, SKELETON_SAMPLE.expected.degrees);
});

test('采用铅条数恰好等于玻璃片数 - 1，且未采用集互补', () => {
  const res = solver.solve(SKELETON_SAMPLE.pieces, SKELETON_SAMPLE.candidates);
  assert.strictEqual(res.adopted.length, SKELETON_SAMPLE.pieces.length - 1);
  assert.strictEqual(res.adopted.length + res.rejected.length, SKELETON_SAMPLE.candidates.length);
  assert.deepStrictEqual([...res.adopted, ...res.rejected].sort((a, b) => a - b),
    SKELETON_SAMPLE.candidates.map((_, i) => i));
});

test('优先级①：最弱等级最高优先于总代价最低', () => {
  // 弱骨架（等级3，代价4）与强骨架（等级7，代价20）二选一，须取强骨架
  const pieces = [1, 2, 3, 4, 5].map((i) => ({ id: String(i), minDeg: 1, maxDeg: 2 }));
  const candidates = [
    { a: '1', b: '2', grade: 3, cost: 1 },
    { a: '2', b: '3', grade: 3, cost: 1 },
    { a: '3', b: '4', grade: 3, cost: 1 },
    { a: '4', b: '5', grade: 3, cost: 1 },
    { a: '1', b: '2', grade: 7, cost: 5 },
    { a: '2', b: '3', grade: 7, cost: 5 },
    { a: '3', b: '4', grade: 7, cost: 5 },
    { a: '4', b: '5', grade: 7, cost: 5 },
  ];
  const res = solver.solve(pieces, candidates);
  assert.strictEqual(res.status, 'ok');
  assert.deepStrictEqual(res.adopted, [4, 5, 6, 7]);
  assert.strictEqual(res.minGrade, 7);
  assert.strictEqual(res.totalCost, 20);
});

test('优先级③：等级与代价并列时取录入序号序列字典序最小', () => {
  // #1 与 #2 是平行边（同端点同等级同代价），只能取其一，须取序号更小的 #1
  const pieces = [1, 2, 3, 4, 5].map((i) => ({ id: String(i), minDeg: 1, maxDeg: 2 }));
  const candidates = [
    { a: '1', b: '2', grade: 5, cost: 1 }, // #1（0 基 0）
    { a: '1', b: '2', grade: 5, cost: 1 }, // #2（0 基 1）
    { a: '2', b: '3', grade: 5, cost: 1 },
    { a: '3', b: '4', grade: 5, cost: 1 },
    { a: '4', b: '5', grade: 5, cost: 1 },
    { a: '1', b: '5', grade: 9, cost: 9 },
    { a: '2', b: '4', grade: 9, cost: 9 },
    { a: '3', b: '5', grade: 9, cost: 9 },
  ];
  const res = solver.solve(pieces, candidates);
  assert.strictEqual(res.status, 'ok');
  assert.deepStrictEqual(res.adopted, [0, 2, 3, 4]);
});

/* 小数代价场景：5 片（连接数均 [1,2]）、10 条等级均为 5 的候选 */
const DECIMAL_CASE = {
  pieces: [1, 2, 3, 4, 5].map((i) => ({ id: String(i), minDeg: 1, maxDeg: 2 })),
  candidates: [
    { a: '1', b: '2', grade: 5, cost: 0.3 }, // #1
    { a: '1', b: '3', grade: 5, cost: 0 },   // #2
    { a: '1', b: '4', grade: 5, cost: 0.2 }, // #3
    { a: '1', b: '5', grade: 5, cost: 0 },   // #4
    { a: '2', b: '3', grade: 5, cost: 0.3 }, // #5
    { a: '2', b: '4', grade: 5, cost: 0.3 }, // #6
    { a: '2', b: '5', grade: 5, cost: 0 },   // #7
    { a: '3', b: '4', grade: 5, cost: 0.3 }, // #8
    { a: '3', b: '5', grade: 5, cost: 0.3 }, // #9
    { a: '4', b: '5', grade: 5, cost: 0.1 }, // #10
  ],
};

test('小数代价：十进制总代价并列时进入序号裁决（0.2+0.1 与 0.3 视为相等）', () => {
  // #2,#3,#7,#10 与 #2,#4,#6,#7 的十进制总代价同为 0.3，
  // 但 0.2+0.1 在二进制浮点下为 0.30000000000000004，不能据此判负；
  // 前者序号序列字典序更小，须稳定返回 #2,#3,#7,#10
  const res = solver.solve(DECIMAL_CASE.pieces, DECIMAL_CASE.candidates);
  assert.strictEqual(res.status, 'ok');
  assert.deepStrictEqual(res.adopted, [1, 2, 6, 9]);
  assert.strictEqual(res.minGrade, 5);
  assert.strictEqual(res.totalCost, 0.3);
});

test('小数代价：采用骨架连通、无环且各片连接数达标', () => {
  const res = solver.solve(DECIMAL_CASE.pieces, DECIMAL_CASE.candidates);
  assert.strictEqual(res.adopted.length, DECIMAL_CASE.pieces.length - 1);
  // 独立复核：并查集检环 + 连通，逐片核对连接数区间
  const n = DECIMAL_CASE.pieces.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x) => {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  };
  const deg = new Array(n).fill(0);
  for (const ci of res.adopted) {
    const c = DECIMAL_CASE.candidates[ci];
    const a = Number(c.a) - 1;
    const b = Number(c.b) - 1;
    assert.notStrictEqual(find(a), find(b), '采用骨架不得含环');
    parent[find(a)] = find(b);
    deg[a]++;
    deg[b]++;
  }
  for (let i = 1; i < n; i++) assert.strictEqual(find(i), find(0), '采用骨架须连通');
  DECIMAL_CASE.pieces.forEach((p, i) => {
    assert.ok(deg[i] >= p.minDeg && deg[i] <= p.maxDeg, `片 ${p.id} 连接数须落在区间内`);
    assert.strictEqual(res.degrees[p.id], deg[i]);
  });
});

test('小数代价：真实总代价差仍优先于序号字典序', () => {
  // #10 代价改为 0.2 后，#2,#3,#7,#10 总代价 0.4 真实高于 0.3，
  // 不得当作并列，须返回真实更廉的 #2,#4,#6,#7（其序号序列字典序更大）
  const candidates = DECIMAL_CASE.candidates.map((c, i) => (i === 9 ? { ...c, cost: 0.2 } : c));
  const res = solver.solve(DECIMAL_CASE.pieces, candidates);
  assert.strictEqual(res.status, 'ok');
  assert.deepStrictEqual(res.adopted, [1, 3, 5, 6]);
  assert.strictEqual(res.totalCost, 0.3);
});

test('小数代价：优先级①最弱等级最高不受十进制求和影响', () => {
  // 弱骨架（等级3，总代价0.4）与强骨架（等级7，总代价3.6）二选一，须取强骨架
  const pieces = [1, 2, 3, 4, 5].map((i) => ({ id: String(i), minDeg: 1, maxDeg: 2 }));
  const candidates = [
    { a: '1', b: '2', grade: 3, cost: 0.1 },
    { a: '2', b: '3', grade: 3, cost: 0.1 },
    { a: '3', b: '4', grade: 3, cost: 0.1 },
    { a: '4', b: '5', grade: 3, cost: 0.1 },
    { a: '1', b: '2', grade: 7, cost: 0.9 },
    { a: '2', b: '3', grade: 7, cost: 0.9 },
    { a: '3', b: '4', grade: 7, cost: 0.9 },
    { a: '4', b: '5', grade: 7, cost: 0.9 },
  ];
  const res = solver.solve(pieces, candidates);
  assert.strictEqual(res.status, 'ok');
  assert.deepStrictEqual(res.adopted, [4, 5, 6, 7]);
  assert.strictEqual(res.minGrade, 7);
  assert.strictEqual(res.totalCost, 3.6);
});

test('小数代价：重复求解结果完全一致（确定性）', () => {
  const a = solver.solve(DECIMAL_CASE.pieces, DECIMAL_CASE.candidates);
  const b = solver.solve(DECIMAL_CASE.pieces, DECIMAL_CASE.candidates);
  assert.deepStrictEqual(a, b);
});

test('度数约束：避开会形成环或超出连接上限的组合', () => {
  // 三角形 1-2-3 全选会成环；样例最优解中片 4 的连接数被上限 2 约束
  const res = solver.solve(SKELETON_SAMPLE.pieces, SKELETON_SAMPLE.candidates);
  assert.ok(res.degrees['4'] <= 2);
  assert.ok(res.degrees['6'] === 1);
});

test('无解·连接范围：可用候选数低于下限，证据按编号排序且首条命中', () => {
  const pieces = [1, 2, 3, 4, 5, 6].map((i) => ({
    id: String(i), minDeg: i === 6 ? 3 : 1, maxDeg: 4,
  }));
  const candidates = [
    { a: '1', b: '2', grade: 5, cost: 1 },
    { a: '2', b: '3', grade: 5, cost: 1 },
    { a: '3', b: '4', grade: 5, cost: 1 },
    { a: '4', b: '5', grade: 5, cost: 1 },
    { a: '5', b: '1', grade: 5, cost: 1 },
    { a: '1', b: '3', grade: 5, cost: 1 },
    { a: '2', b: '4', grade: 5, cost: 1 },
    { a: '5', b: '6', grade: 5, cost: 1 }, // 片 6 唯一候选 < 下限 3
  ];
  const res = solver.solve(pieces, candidates);
  assert.strictEqual(res.status, 'infeasible');
  assert.strictEqual(res.evidence[0].pieceId, '6');
  assert.strictEqual(res.evidence[0].type, 'range');
});

test('无解·连通性：两个连通分量，证据按编号排序（乱序录入仍稳定）', () => {
  const pieces = ['6', '5', '4', '3', '2', '1'].map((id) => ({ id, minDeg: 1, maxDeg: 3 }));
  const candidates = [
    { a: '1', b: '2', grade: 5, cost: 1 },
    { a: '2', b: '3', grade: 5, cost: 1 },
    { a: '1', b: '3', grade: 5, cost: 1 },
    { a: '4', b: '5', grade: 5, cost: 1 },
    { a: '5', b: '6', grade: 5, cost: 1 },
    { a: '4', b: '6', grade: 5, cost: 1 },
    { a: '1', b: '2', grade: 7, cost: 2 },
    { a: '4', b: '5', grade: 7, cost: 2 },
  ];
  const res = solver.solve(pieces, candidates);
  assert.strictEqual(res.status, 'infeasible');
  assert.strictEqual(res.evidence.length, 6);
  assert.strictEqual(res.evidence[0].pieceId, '1');
  assert.strictEqual(res.evidence[0].type, 'connectivity');
  const ids = res.evidence.map((e) => e.pieceId);
  assert.deepStrictEqual(ids, [...ids].sort(solver.compareIds));
});

test('无解·全局范围：下限之和超过骨架可承载的连接总数', () => {
  // 每片可用候选数均 ≥ 下限 3（单片检查通过），但下限之和 15 > 2×(5-1)=8
  const pieces = [1, 2, 3, 4, 5].map((i) => ({ id: String(i), minDeg: 3, maxDeg: 4 }));
  const candidates = [
    { a: '1', b: '3', grade: 5, cost: 1 },
    { a: '1', b: '4', grade: 5, cost: 1 },
    { a: '1', b: '5', grade: 5, cost: 1 },
    { a: '2', b: '3', grade: 5, cost: 1 },
    { a: '2', b: '4', grade: 5, cost: 1 },
    { a: '2', b: '5', grade: 5, cost: 1 },
    { a: '3', b: '5', grade: 5, cost: 1 },
    { a: '4', b: '5', grade: 5, cost: 1 },
  ];
  const res = solver.solve(pieces, candidates);
  assert.strictEqual(res.status, 'infeasible');
  assert.strictEqual(res.evidence[0].type, 'range');
  assert.strictEqual(res.evidence[0].pieceId, '1');
});

test('求解确定性：重复求解结果完全一致', () => {
  const a = solver.solve(SKELETON_SAMPLE.pieces, SKELETON_SAMPLE.candidates);
  const b = solver.solve(SKELETON_SAMPLE.pieces, SKELETON_SAMPLE.candidates);
  assert.deepStrictEqual(a, b);
});

test('录入校验：数量、编号唯一性、端点存在性、区间合法性', () => {
  const ok = SKELETON_SAMPLE;
  assert.deepStrictEqual(solver.validate(ok.pieces, ok.candidates), []);
  assert.ok(solver.validate(ok.pieces.slice(0, 4), ok.candidates).length > 0); // 片数不足
  assert.ok(solver.validate(ok.pieces, ok.candidates.slice(0, 7)).length > 0); // 候选不足
  const dup = ok.pieces.map((p, i) => (i === 1 ? { ...p, id: '1' } : p));
  assert.ok(solver.validate(dup, ok.candidates).some((e) => e.includes('重复')));
  const badEnd = ok.candidates.map((c, i) => (i === 0 ? { ...c, b: '99' } : c));
  assert.ok(solver.validate(ok.pieces, badEnd).some((e) => e.includes('不存在')));
  const badRange = ok.pieces.map((p, i) => (i === 0 ? { ...p, minDeg: 3, maxDeg: 2 } : p));
  assert.ok(solver.validate(badRange, ok.candidates).length > 0);
  const badCost = ok.candidates.map((c, i) => (i === 0 ? { ...c, cost: -1 } : c));
  assert.ok(solver.validate(ok.pieces, badCost).length > 0);
});

console.log(`\n${passed} 通过, ${failed} 失败`);
process.exit(failed ? 1 : 0);

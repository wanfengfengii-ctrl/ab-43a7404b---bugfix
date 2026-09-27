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

/* 小数代价场景：5 片 [1,2]，10 条等级均为 5 的候选（题述回归场景） */
function decimalScenario(cost10) {
  const pieces = [1, 2, 3, 4, 5].map((i) => ({ id: String(i), minDeg: 1, maxDeg: 2 }));
  const ends = [['1', '2'], ['1', '3'], ['1', '4'], ['1', '5'], ['2', '3'],
    ['2', '4'], ['2', '5'], ['3', '4'], ['3', '5'], ['4', '5']];
  const costs = [0.3, 0, 0.2, 0, 0.3, 0.3, 0, 0.3, 0.3, cost10];
  const candidates = ends.map(([a, b], i) => ({ a, b, grade: 5, cost: costs[i] }));
  return { pieces, candidates };
}

/* 并查集核验：采用集无环、全部连通，且各片连接数落在闭区间内 */
function assertValidSkeleton(res, pieces, candidates) {
  const idx = new Map(pieces.map((p, i) => [p.id, i]));
  const parent = pieces.map((_, i) => i);
  const find = (x) => {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  };
  assert.strictEqual(res.adopted.length, pieces.length - 1, '采用条数应为片数-1');
  for (const ci of res.adopted) {
    const ra = find(idx.get(String(candidates[ci].a)));
    const rb = find(idx.get(String(candidates[ci].b)));
    assert.notStrictEqual(ra, rb, '采用铅条不得成环');
    parent[ra] = rb;
  }
  const roots = new Set(pieces.map((_, i) => find(i)));
  assert.strictEqual(roots.size, 1, '全部玻璃片须连通');
  for (const p of pieces) {
    assert.ok(res.degrees[p.id] >= p.minDeg && res.degrees[p.id] <= p.maxDeg,
      `玻璃片 ${p.id} 连接数须落在 [${p.minDeg}, ${p.maxDeg}]`);
  }
}

test('小数代价：十进制总代价并列时可靠进入序号裁决', () => {
  // #2#4#6#7 与 #2#3#7#10 的十进制总代价同为 0.3，但浮点求和 0.2+0.1=0.30000000000000004；
  // 并列须成立，取录入序号序列字典序更小的 #2 #3 #7 #10（0 基 [1,2,6,9]）
  const { pieces, candidates } = decimalScenario(0.1);
  const res = solver.solve(pieces, candidates);
  assert.strictEqual(res.status, 'ok');
  assert.deepStrictEqual(res.adopted, [1, 2, 6, 9]);
  assert.strictEqual(res.minGrade, 5);
  assert.strictEqual(res.totalCost, 0.3);
  assert.deepStrictEqual(res.degrees, { 1: 2, 2: 1, 3: 1, 4: 2, 5: 2 });
  assertValidSkeleton(res, pieces, candidates);
});

test('小数代价：真实存在的总代价差仍优先，不被当作并列', () => {
  // #10 代价 0.1000001：#2#3#7#10 总代价 0.3000001 真实高于 0.3，
  // 第②级须判负，由总代价真正更低的 #2 #4 #6 #7（0 基 [1,3,5,6]）胜出
  const { pieces, candidates } = decimalScenario(0.1000001);
  const res = solver.solve(pieces, candidates);
  assert.strictEqual(res.status, 'ok');
  assert.deepStrictEqual(res.adopted, [1, 3, 5, 6]);
  assert.strictEqual(res.totalCost, 0.3);
  assertValidSkeleton(res, pieces, candidates);
});

test('小数代价：最弱等级最高仍优先于总代价最低', () => {
  // 弱骨架（等级3，总代价 0.4）与强骨架（等级7，总代价 1.2）二选一，须取强骨架
  const pieces = [1, 2, 3, 4, 5].map((i) => ({ id: String(i), minDeg: 1, maxDeg: 2 }));
  const candidates = [
    { a: '1', b: '2', grade: 3, cost: 0.1 },
    { a: '2', b: '3', grade: 3, cost: 0.1 },
    { a: '3', b: '4', grade: 3, cost: 0.1 },
    { a: '4', b: '5', grade: 3, cost: 0.1 },
    { a: '1', b: '2', grade: 7, cost: 0.3 },
    { a: '2', b: '3', grade: 7, cost: 0.3 },
    { a: '3', b: '4', grade: 7, cost: 0.3 },
    { a: '4', b: '5', grade: 7, cost: 0.3 },
  ];
  const res = solver.solve(pieces, candidates);
  assert.strictEqual(res.status, 'ok');
  assert.deepStrictEqual(res.adopted, [4, 5, 6, 7]);
  assert.strictEqual(res.minGrade, 7);
  assert.strictEqual(res.totalCost, 1.2);
  assertValidSkeleton(res, pieces, candidates);
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

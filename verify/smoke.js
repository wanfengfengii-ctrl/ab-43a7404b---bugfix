/*
 * 骨架样例冒烟：对 dist/ 构建产物执行
 *   1. 必需静态文件齐全；
 *   2. 用产物中的求解器求解骨架样例，结果与期望唯一最优解一致；
 *   3. 无解场景的证据输出稳定（按玻璃片编号排序）。
 * 全部通过输出 SMOKE PASS 并以 0 退出，否则非零。
 */
'use strict';

const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const DIST = process.env.SMOKE_DIST || path.join(__dirname, '..', 'dist');

function main() {
  // 1. 构建产物齐全
  for (const f of ['index.html', 'styles.css', 'solver.js', 'sample.js', 'app.js']) {
    assert.ok(fs.existsSync(path.join(DIST, f)), `dist/ 缺少 ${f}（请先运行 node build.js）`);
  }

  // 2. 骨架样例冒烟
  const solver = require(path.join(DIST, 'solver.js'));
  const { SKELETON_SAMPLE } = require(path.join(DIST, 'sample.js'));
  const res = solver.solve(SKELETON_SAMPLE.pieces, SKELETON_SAMPLE.candidates);
  assert.strictEqual(res.status, 'ok', '样例应存在合格骨架');
  assert.deepStrictEqual(res.adopted, SKELETON_SAMPLE.expected.adopted, '采用序号不符');
  assert.strictEqual(res.minGrade, SKELETON_SAMPLE.expected.minGrade, '最弱等级不符');
  assert.strictEqual(res.totalCost, SKELETON_SAMPLE.expected.totalCost, '总代价不符');
  assert.deepStrictEqual(res.degrees, SKELETON_SAMPLE.expected.degrees, '各片连接数不符');
  assert.strictEqual(res.adopted.length, SKELETON_SAMPLE.pieces.length - 1, '采用条数应为片数-1');

  // 3. 无解场景证据稳定
  const pieces = ['3', '1', '2', '4', '5'].map((id) => ({ id, minDeg: 1, maxDeg: 2 }));
  const candidates = [
    { a: '1', b: '2', grade: 5, cost: 1 },
    { a: '2', b: '3', grade: 5, cost: 1 },
    { a: '1', b: '3', grade: 5, cost: 1 },
    { a: '4', b: '5', grade: 5, cost: 1 },
    { a: '4', b: '5', grade: 6, cost: 2 },
    { a: '1', b: '2', grade: 6, cost: 2 },
    { a: '2', b: '3', grade: 6, cost: 2 },
    { a: '1', b: '3', grade: 6, cost: 2 },
  ];
  const bad = solver.solve(pieces, candidates);
  assert.strictEqual(bad.status, 'infeasible');
  assert.strictEqual(bad.evidence[0].pieceId, '1', '首个失败证据应为编号最小的玻璃片');
  assert.strictEqual(bad.evidence[0].type, 'connectivity');
  const again = solver.solve(pieces, candidates);
  assert.deepStrictEqual(bad, again, '证据输出须稳定');

  console.log('SMOKE PASS: 骨架样例最优解 = 采用序号 '
    + res.adopted.map((i) => `#${i + 1}`).join(',')
    + `，最弱等级 ${res.minGrade}，总代价 ${res.totalCost}`);
}

try {
  main();
} catch (err) {
  console.error(`SMOKE FAIL: ${err.message}`);
  process.exit(1);
}

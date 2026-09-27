/*
 * 骨架样例：页面「载入样例」与 verify 冒烟测试共用。
 * expected 为该样例的唯一最优解（人工推导，见 README）：
 *   采用 #2,#3,#7,#8,#10（1 基录入序号），即 0 基 [1,2,6,7,9]，
 *   最弱等级 6，总代价 28。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SkeletonSample = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  const SKELETON_SAMPLE = {
    pieces: [
      { id: '1', minDeg: 1, maxDeg: 2 },
      { id: '2', minDeg: 1, maxDeg: 2 },
      { id: '3', minDeg: 1, maxDeg: 3 },
      { id: '4', minDeg: 1, maxDeg: 2 },
      { id: '5', minDeg: 1, maxDeg: 2 },
      { id: '6', minDeg: 1, maxDeg: 1 },
    ],
    candidates: [
      { a: '1', b: '2', grade: 5, cost: 4 }, // 序号 1
      { a: '1', b: '3', grade: 7, cost: 6 }, // 序号 2
      { a: '2', b: '3', grade: 6, cost: 5 }, // 序号 3
      { a: '2', b: '4', grade: 4, cost: 3 }, // 序号 4
      { a: '3', b: '4', grade: 8, cost: 7 }, // 序号 5
      { a: '3', b: '5', grade: 5, cost: 2 }, // 序号 6
      { a: '4', b: '5', grade: 6, cost: 4 }, // 序号 7
      { a: '4', b: '6', grade: 9, cost: 8 }, // 序号 8
      { a: '5', b: '6', grade: 3, cost: 1 }, // 序号 9
      { a: '2', b: '5', grade: 7, cost: 5 }, // 序号 10
    ],
    expected: {
      adopted: [1, 2, 6, 7, 9], // 0 基录入序号
      minGrade: 6,
      totalCost: 28,
      degrees: { '1': 1, '2': 2, '3': 2, '4': 2, '5': 2, '6': 1 },
    },
  };

  return { SKELETON_SAMPLE };
});

/*
 * 构建：app/ → dist/，并做静态完整性自检：
 *   1. index.html 引用的本地资源必须存在；
 *   2. 构建产物中的求解器可在 Node 下加载并正确求解样例。
 * 失败以非零退出码报告。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const APP = path.join(ROOT, 'app');
const DIST = path.join(ROOT, 'dist');

function fail(msg) {
  console.error(`BUILD FAIL: ${msg}`);
  process.exit(1);
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

const files = fs.readdirSync(APP).filter((f) => /\.(html|css|js)$/.test(f));
if (!files.includes('index.html')) fail('app/ 缺少 index.html');
for (const f of files) {
  fs.copyFileSync(path.join(APP, f), path.join(DIST, f));
}

// 1. 校验 index.html 的本地引用
const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((m) => m[1])
  .filter((u) => !/^(https?:|#|\/)/.test(u));
const missing = refs.filter((r) => !fs.existsSync(path.join(DIST, r)));
if (missing.length) fail(`index.html 引用了缺失资源：${missing.join(', ')}`);

// 2. 构建产物自检：求解器 + 样例
const solver = require(path.join(DIST, 'solver.js'));
const { SKELETON_SAMPLE } = require(path.join(DIST, 'sample.js'));
const res = solver.solve(SKELETON_SAMPLE.pieces, SKELETON_SAMPLE.candidates);
if (res.status !== 'ok') fail('构建产物样例求解失败');
if (res.adopted.length !== SKELETON_SAMPLE.pieces.length - 1) {
  fail('采用铅条数不等于玻璃片数 - 1');
}

console.log(`BUILD OK: ${files.length} 个文件 → dist/（${files.join(', ')}）`);

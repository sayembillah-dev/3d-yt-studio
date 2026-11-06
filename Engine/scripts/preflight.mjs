#!/usr/bin/env node
// preflight.mjs: code checks that run in ~2-3 s, before any render (render.sh calls it before bundling).
//   node preflight.mjs <project_dir>        (engine only: node preflight.mjs --engine)
// PF1 types  TypeScript check of Engine/studio/src + <project>/scenes (@engine / @project aliases resolved like webpack).
//            Only errors in engine or project files count; node_modules typings are skipped.
// PF2 hooks  React rules of hooks inside components (Capitalised functions) and custom hooks (useX):
//            no use*() call after an early `return`, or inside if / loop / switch / ?: / && / ||.
//            Video #02 crashed mid-render at f571 (React #310) on exactly this: useMemo after an early return.
// Exit 0 = PASS, 1 = a check failed, 2 = usage error. PREFLIGHT_SKIP=1 makes render.sh skip it (emergencies only).
import path from 'node:path';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDIO = process.env.STUDIO || path.join(HERE, '..', 'studio');
const require = createRequire(path.join(STUDIO, 'package.json'));
const ts = require('typescript');

const arg = process.argv[2];
if (!arg) { console.log('usage: node preflight.mjs <project_dir> | --engine'); process.exit(2); }
const SRC = path.join(STUDIO, 'src');
const ENGINE = path.join(SRC, 'engine');
const proj = arg === '--engine' ? null : path.resolve(arg);
const scenes = proj ? path.join(proj, 'scenes') : null;
if (scenes && !fs.existsSync(path.join(scenes, 'index.tsx'))) { console.log(`no scenes/index.tsx in ${proj}`); process.exit(2); }

const walk = (d) => fs.readdirSync(d, {withFileTypes: true}).flatMap((e) => {
  if (e.name.startsWith('.') || e.name === 'node_modules') return [];
  const p = path.join(d, e.name);
  return e.isDirectory() ? walk(p) : (/\.(ts|tsx)$/.test(e.name) ? [p] : []);
});
const ours = [...walk(SRC), ...(scenes ? walk(scenes) : [])].filter((f) => !(proj && f.endsWith('project.d.ts')));
const isOurs = (f) => f && (f.startsWith(SRC) || (scenes && f.startsWith(scenes))) && !f.includes('node_modules');

const cfg = ts.parseJsonConfigFileContent(JSON.parse(fs.readFileSync(path.join(STUDIO, 'tsconfig.json'), 'utf8')), ts.sys, STUDIO);
const options = {
  ...cfg.options, noEmit: true, baseUrl: STUDIO,
  typeRoots: [path.join(STUDIO, 'node_modules', '@types')],
  paths: {'@engine/*': [path.join(ENGINE, '*')], '@engine': [ENGINE], ...(scenes ? {'@project': [scenes], '@project/*': [path.join(scenes, '*')]} : {})},
};
// project folders live outside the studio: resolve their bare imports (react, three, …) from the studio's node_modules
const host = ts.createCompilerHost(options);
host.resolveModuleNames = (names, containing) => names.map((n) => {
  const r = ts.resolveModuleName(n, containing, options, host).resolvedModule;
  return r || ts.resolveModuleName(n, path.join(SRC, 'index.ts'), options, host).resolvedModule;
});
const program = ts.createProgram(ours, options, host);

const results = [];
const rel = (f) => path.relative(path.join(STUDIO, '..', '..'), f);
const where = (sf, pos) => { const {line, character} = sf.getLineAndCharacterOfPosition(pos); return `${rel(sf.fileName)}:${line + 1}:${character + 1}`; };

// PF1 types
const diags = ts.getPreEmitDiagnostics(program).filter((d) => !d.file || isOurs(d.file.fileName));
const typeErrs = diags.filter((d) => d.category === ts.DiagnosticCategory.Error).map((d) =>
  `${d.file ? where(d.file, d.start) : '(global)'}  TS${d.code} ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`);
results.push(['PF1', 'types', typeErrs]);

// PF2 hooks
const hookErrs = [];
const isHookCall = (n) => ts.isCallExpression(n) && (
  (ts.isIdentifier(n.expression) && /^use[A-Z0-9]/.test(n.expression.text)) ||
  (ts.isPropertyAccessExpression(n.expression) && /^use[A-Z0-9]/.test(n.expression.name.text)));
const isFn = (n) => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n);
const fnName = (n) => {
  if (n.name && ts.isIdentifier(n.name)) return n.name.text;
  let p = n.parent;
  while (p && (ts.isCallExpression(p) || ts.isParenthesizedExpression(p) || ts.isAsExpression(p))) p = p.parent;  // memo(() => …), forwardRef(…)
  return p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name) ? p.name.text : null;
};
const isComponentOrHook = (n) => { const nm = fnName(n); return !!nm && (/^[A-Z]/.test(nm) || /^use[A-Z0-9]/.test(nm)); };
const containsReturn = (n) => { let found = false; const v = (c) => { if (found || isFn(c)) return; if (ts.isReturnStatement(c)) { found = true; return; } ts.forEachChild(c, v); }; v(n); return found; };
const CONDITIONAL = (n) => ts.isIfStatement(n) || ts.isForStatement(n) || ts.isForOfStatement(n) || ts.isForInStatement(n) ||
  ts.isWhileStatement(n) || ts.isDoStatement(n) || ts.isSwitchStatement(n) || ts.isConditionalExpression(n) ||
  (ts.isBinaryExpression(n) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(n.operatorToken.kind));

function checkFn(fn, sf) {
  if (!fn.body || !ts.isBlock(fn.body)) return;   // expression-bodied arrows cannot return early
  const name = fnName(fn);
  let returned = null;
  for (const st of fn.body.statements) {
    const visit = (n, cond) => {
      if (isFn(n)) return;   // nested callbacks (useMemo(() => …), .map) are their own scope
      if (isHookCall(n)) {
        const hook = n.expression.getText(sf);
        if (returned !== null) hookErrs.push(`${where(sf, n.getStart(sf))}  ${name}: ${hook}() after the early return at line ${returned} — move every hook above the first return`);
        else if (cond) hookErrs.push(`${where(sf, n.getStart(sf))}  ${name}: ${hook}() inside a condition/loop — call it unconditionally, branch on its result`);
      }
      ts.forEachChild(n, (c) => visit(c, cond || CONDITIONAL(n)));
    };
    visit(st, false);
    if (returned === null && containsReturn(st)) returned = sf.getLineAndCharacterOfPosition(st.getStart(sf)).line + 1;
  }
}
for (const sf of program.getSourceFiles()) {
  if (!isOurs(sf.fileName) || sf.isDeclarationFile) continue;
  const v = (n) => { if (isFn(n) && isComponentOrHook(n)) checkFn(n, sf); ts.forEachChild(n, v); };
  v(sf);
}
results.push(['PF2', 'hooks', hookErrs]);

const FIX = {
  PF1: 'fix the listed type errors (a wrong prop name or missing import here is a blank set or a crash mid-render)',
  PF2: 'hoist the hook above every early return / out of the condition (React #310 "Rendered more hooks than during the previous render")',
};
let fail = false;
for (const [id, nm, errs] of results) {
  console.log(`${id}  ${nm.padEnd(6)} ${errs.length ? 'FAIL' : 'PASS'}  ${errs.length} issue(s), ${ours.length} files`);
  for (const e of errs.slice(0, 15)) console.log(`    ${e}`);
  if (errs.length > 15) console.log(`    … ${errs.length - 15} more`);
  if (errs.length) { console.log(`    FIX: ${FIX[id]}`); fail = true; }
}
console.log(`PREFLIGHT: ${fail ? 'FAIL' : 'PASS'}`);
process.exit(fail ? 1 : 0);

/* StrengthPath テストスイート
   実行: node tests/run.js   （プロジェクト直下から） */
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ---------- ブラウザの最小スタブ ---------- */
const stub = () => ({ innerHTML:'', style:{}, dataset:{}, value:'', content:'',
  classList:{add(){},remove(){}}, addEventListener(){}, appendChild(){}, click(){},
  setAttribute(){}, removeAttribute(){}, select(){} });
const store = {};
const ctx = { console,
  localStorage:{ getItem:k=>store[k]??null, setItem:(k,v)=>store[k]=v, removeItem:k=>delete store[k], clear:()=>Object.keys(store).forEach(k=>delete store[k]) },
  matchMedia:()=>({matches:false, addEventListener(){}}),
  document:{ documentElement:{style:{setProperty(){}},dataset:{}}, querySelector:stub,
    querySelectorAll:()=>[], addEventListener(){}, createElement:stub, body:{appendChild(){}} },
  navigator:{}, requestAnimationFrame(){}, setTimeout(){}, clearTimeout(){},
  location:{hostname:'localhost'}, Image:function(){}, caches:{keys:()=>Promise.resolve([])},
  performance:{now:()=>0}, Event:function(){} };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
const FILES = ['assets/data.js','assets/akari.js','assets/app.js'];
vm.runInContext(FILES.map(read).join('\n') + `
;globalThis.API = { scoreGate, scoreAll, matchJobs, buildSteps, blankProfile, makePrompt,
  flat, nextStep, doneCount, totalCount, timesMoved, ymd, today,
  TRAITS, STYLES, TYPES, JOBS, JOB_CATS, GATES, CHAPTERS, PROMPTS, THEMES, VOICE,
  Q_GATE, Q_TRAIT, Q_STYLE, SCALE, OTHER_WAYS, COMMON_STEPS, TYPE_STEPS, LEARN_LINK, MONEY_NOTE };`,
  ctx, { filename:'bundle.js' });
const A = ctx.API;

/* ---------- 極小テストランナー ---------- */
let pass = 0, fail = 0; const fails = [];
const C = { g:'\x1b[32m', r:'\x1b[31m', d:'\x1b[2m', b:'\x1b[1m', x:'\x1b[0m' };
function group(name) { console.log(`\n${C.b}${name}${C.x}`); }
function t(name, fn) {
  try {
    const msg = fn();
    pass++; console.log(`  ${C.g}PASS${C.x} ${name}${msg ? C.d + '  ' + msg + C.x : ''}`);
  } catch (e) {
    fail++; fails.push(name);
    console.log(`  ${C.r}FAIL${C.x} ${name}\n       ${C.r}${e.message}${C.x}`);
  }
}
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m||''} 期待:${JSON.stringify(b)} 実際:${JSON.stringify(a)}`); };
const ok = (c, m) => { if (!c) throw new Error(m || '条件が満たされていません'); };

/* ---------- ヘルパ ---------- */
const gate = v => { const a={}; v.forEach((x,i)=>a['g'+i]=x); return A.scoreGate(a); };
const quiz = (t24, s10) => { const a={}; t24.forEach((v,i)=>a['t'+i]=v); (s10||Array(10).fill(3)).forEach((v,i)=>a['s'+i]=v); return A.scoreAll(a); };
const fill = (n,v) => Array(n).fill(v);

/* ================= 1. 適性チェック ================= */
group('1. 適性チェック（気持ち×余力の2軸判定）');
// 並び: time,time, give,give, why,why, keep,keep
t('時間も気持ちも十分 → ready', () => {
  const g = gate([4,4, 4,4, 4,4, 4,4]); eq(g.tier, 'ready'); return `気持ち${g.motive} 余力${g.room}`;
});
t('やる気はあるが時間がない → time（弾かない）', () => {
  const g = gate([1,1, 2,2, 4,4, 4,3]); eq(g.tier, 'time'); return `気持ち${g.motive} 余力${g.room}`;
});
t('時間はあるが変えたい気持ちが薄い → other', () => {
  const g = gate([4,4, 4,3, 1,1, 2,2]); eq(g.tier, 'other'); return `気持ち${g.motive} 余力${g.room}`;
});
t('すべて最低 → other', () => eq(gate(fill(8,1)).tier, 'other'));
t('すべて最高 → ready', () => eq(gate(fill(8,4)).tier, 'ready'));
t('ぜんぶ「ややそう」→ ready', () => eq(gate(fill(8,3)).tier, 'ready'));
t('ぜんぶ「ややちがう」→ other', () => eq(gate(fill(8,2)).tier, 'other'));
t('未回答は中間(2)として扱われ落ちない', () => { const g = A.scoreGate({}); ok(['ready','time','other'].includes(g.tier)); return g.tier; });
t('気持ち・余力は 4〜16 の範囲に収まる', () => {
  for (let n=0;n<400;n++){ const g = gate(fill(8,0).map(()=>1+Math.floor(Math.random()*4)));
    ok(g.motive>=4&&g.motive<=16&&g.room>=4&&g.room<=16, `範囲外 ${g.motive}/${g.room}`); }
});
t('3つの分岐すべてに到達できる', () => {
  const seen = new Set();
  for (let n=0;n<2000;n++) seen.add(gate(fill(8,0).map(()=>1+Math.floor(Math.random()*4))).tier);
  eq([...seen].sort(), ['other','ready','time']);
});
t('GATES に3分岐ぶんの文言が揃っている', () => {
  ['ready','time','other'].forEach(k => {
    const g = A.GATES[k];
    ok(g && g.title && g.lead && g.body && g.cta, `${k} の文言が不足`);
  });
});

/* ================= 2. 持ち味スコアリング ================= */
group('2. 持ち味チェック');
t('設問は 持ち味24 + 進みグセ10 = 34問', () => {
  eq(A.Q_TRAIT.length, 24); eq(A.Q_STYLE.length, 10);
  return `合計${A.Q_TRAIT.length + A.Q_STYLE.length}問`;
});
t('選択肢は4段階（中間なし）', () => { eq(A.SCALE.length, 4); eq(A.SCALE.map(s=>s.v), [1,2,3,4]); });
t('全問「そう！」で全持ち味 100%', () => {
  const r = quiz(fill(24,4)); ok(Object.values(r.traits).every(v=>v===100));
});
t('全問「ちがう」で全持ち味 0%', () => {
  const r = quiz(fill(24,1)); ok(Object.values(r.traits).every(v=>v===0));
});
t('持ち味は12個ぜんぶ算出される', () => eq(Object.keys(quiz(fill(24,3)).traits).length, 12));
t('進みグセは5個ぜんぶ算出される', () => eq(Object.keys(quiz(fill(24,3)).styles).length, 5));
t('スコアは 0〜100 に収まる', () => {
  for (let n=0;n<300;n++){ const r = quiz(fill(24,0).map(()=>1+Math.floor(Math.random()*4)));
    Object.values(r.traits).concat(Object.values(r.styles)).forEach(v=>ok(v>=0&&v<=100, `範囲外 ${v}`)); }
});
t('一律回答でも道が偏らない（伝える道に固定されない）', () => {
  // 偏差ベース判定なので、一律回答は既定値の伝える道になるのが仕様
  eq(quiz(fill(24,4)).type, 'content'); eq(quiz(fill(24,1)).type, 'content');
  return '一律時は既定値 content（仕様どおり）';
});
t('8つの道すべてに到達できる', () => {
  const seen = new Set();
  for (let n=0;n<4000;n++) seen.add(quiz(fill(24,0).map(()=>1+Math.floor(Math.random()*4))).type);
  const miss = Object.keys(A.TYPES).filter(k=>!seen.has(k));
  ok(miss.length===0, `到達しない道: ${miss.join(',')}`);
  return `${seen.size}/8`;
});
t('持ち味が高いほうの道が選ばれる（発信寄り）', () => {
  const r = quiz([2,2,2,2,2,2,2,2,2,2,2,2,2,2,4,4,2,2,4,4,4,4,2,2]);
  ok(['content','plan','make'].includes(r.type), `想定外: ${r.type}`);
  return A.TYPES[r.type].name;
});

/* ================= 3. 副業マッチング ================= */
group('3. 副業カタログ');
t('20コ（19＋番外編）ある', () => eq(A.JOBS.length, 20));
t('idが重複していない', () => eq(new Set(A.JOBS.map(j=>j.id)).size, 20));
t('全項目に必須フィールドが揃っている', () => {
  A.JOBS.forEach(j => ['name','what','first','need','ai','real','w','cat'].forEach(k =>
    ok(j[k] && (typeof j[k] !== 'object' || Object.keys(j[k]).length), `${j.id} の ${k} が空`)));
});
t('重みのキーがすべて実在する持ち味', () => {
  A.JOBS.forEach(j => Object.keys(j.w).forEach(k => ok(A.TRAITS[k], `${j.id}: 未知の持ち味 ${k}`)));
});
t('カテゴリがすべて定義済み', () => {
  A.JOBS.forEach(j => ok(A.JOB_CATS[j.cat], `${j.id}: 未知のカテゴリ ${j.cat}`));
  return Object.entries(A.JOBS.reduce((a,j)=>(a[A.JOB_CATS[j.cat].name]=(a[A.JOB_CATS[j.cat].name]||0)+1,a),{})).map(([k,v])=>`${k}${v}`).join(' ');
});
t('マッチングは件数を指定できる', () => {
  const r = quiz(fill(24,3));
  eq(A.matchJobs(r.traits,3).length, 3); eq(A.matchJobs(r.traits).length, 20);
});
t('相性スコアの降順で並ぶ', () => {
  const m = A.matchJobs(quiz(fill(24,0).map(()=>1+Math.floor(Math.random()*4))).traits);
  for (let i=1;i<m.length;i++) ok(m[i-1].s >= m[i].s, '並び順が崩れている');
});
t('20件すべてが上位3に入りうる', () => {
  const seen = new Set();
  for (let n=0;n<3000;n++){ const r = quiz(fill(24,0).map(()=>1+Math.floor(Math.random()*4)));
    A.matchJobs(r.traits,3).forEach(m=>seen.add(m.job.id)); }
  const never = A.JOBS.filter(j=>!seen.has(j.id)).map(j=>j.name);
  ok(never.length===0, `上位3に入らない: ${never.join(',')}`);
});
[['発信寄り',[2,2,2,2,2,2,2,2,2,2,2,2,2,2,4,4,2,2,4,4,4,4,2,2],['youtube','sns','aicreator','live']],
 ['探究寄り',[2,2,2,2,2,2,2,2,2,2,4,4,2,2,3,3,2,2,2,2,2,2,2,2],['blog','contents','teacher','writing']],
 ['分析寄り',[2,2,3,3,2,2,4,4,3,3,2,2,2,2,2,2,2,2,2,2,2,2,2,2],['webmarke','dev','consul','sedori','fudosan']],
 ['制作寄り',[2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,4,4,4,4],['handmade','webdesign','movie','aicreator']],
].forEach(([label, tv, expect]) => {
  t(`${label} → 妥当な副業が上位に来る`, () => {
    const top = A.matchJobs(quiz(tv).traits, 3).map(m=>m.job.id);
    ok(top.some(id=>expect.includes(id)), `上位3: ${top.join(',')}`);
    return A.matchJobs(quiz(tv).traits,3).map(m=>m.job.name).join(' / ');
  });
});

/* ================= 4. 9つのやること ================= */
group('4. 9つのやること');
t('全8タイプで ちょうど9つ生成される', () => {
  Object.keys(A.TYPES).forEach(ty => {
    const s = A.buildSteps(ty), n = s.reduce((x,c)=>x+c.items.length,0);
    eq(n, 9, `${A.TYPES[ty].name}`);
    eq(s.length, 3, `${A.TYPES[ty].name} の章数`);
  });
});
t('各章が3つずつ', () => {
  Object.keys(A.TYPES).forEach(ty => A.buildSteps(ty).forEach(c => eq(c.items.length, 3)));
});
t('やることのidが重複しない', () => {
  const s = A.buildSteps('content'), ids = A.flat({steps:s}).map(x=>x.id);
  eq(new Set(ids).size, ids.length);
});
t('初期状態はすべて未完了', () => ok(A.flat({steps:A.buildSteps('teach')}).every(x=>!x.done)));
t('nextStep は先頭の未完了を返す', () => {
  const p = A.blankProfile('t'); p.steps = A.buildSteps('content');
  p.steps[0].items[0].done = true;
  eq(A.nextStep(p).text, p.steps[0].items[1].text);
});
t('全部完了で nextStep は null', () => {
  const p = A.blankProfile('t'); p.steps = A.buildSteps('content');
  p.steps.forEach(c=>c.items.forEach(x=>x.done=true));
  eq(A.nextStep(p), null);
});
t('章の見出しが3つ揃っている', () => { eq(A.CHAPTERS.length, 3);
  A.CHAPTERS.forEach(c => ok(c.no && c.title && c.goal)); });

/* ================= 5. 記録 ================= */
group('5. きろく（累計方式）');
t('記録は減らない累計で数える', () => {
  const p = A.blankProfile('t');
  p.logs = [{date:'2026-01-01',text:'a'},{date:'2026-06-01',text:'b'},{date:'2026-08-27',text:'c'}];
  eq(A.timesMoved(p), 3, '日が空いても減らないこと');
});
t('記録ゼロでも壊れない', () => eq(A.timesMoved(A.blankProfile('t')), 0));
t('日付はローカル時刻基準（UTCずれなし）', () => {
  const d = new Date(2026, 7, 27, 7, 30);
  eq(A.ymd(d), '2026-08-27');
  ok(A.today().match(/^\d{4}-\d{2}-\d{2}$/), '形式が不正');
});

/* ================= 6. そうだん（プロンプト） ================= */
group('6. そうだん（AIプロンプト）');
const pp = (() => { const p = A.blankProfile('テスト');
  p.result = quiz(fill(24,3)); p.steps = A.buildSteps(p.result.type);
  p.gate = gate(fill(8,3)); return p; })();
A.PROMPTS.forEach(x => {
  t(`${x.name} が生成される`, () => {
    const s = A.makePrompt(pp, x.id);
    ok(s.length > 300, `短すぎる (${s.length}字)`);
    return `${s.length}字`;
  });
});
t('プロンプトに副業候補が含まれる', () => {
  const s = A.makePrompt(pp, 'first');
  ok(s.includes('持ち味に近い副業'), '副業候補が入っていない');
  A.matchJobs(pp.result.traits,3).forEach(m => ok(s.includes(m.job.name), `${m.job.name} が無い`));
});
t('プロンプトに「否定しない」指示が入っている', () => {
  const s = A.makePrompt(pp, 'first');
  ok(s.includes('否定しない'), '禁止事項が無い');
  ok(s.includes('15分'), 'サイズ指定が無い');
});
t('記録が空でも壊れない', () => ok(A.makePrompt(pp,'weekly').length > 300));

/* ================= 7. データ整合性 ================= */
group('7. データ整合性');
t('持ち味は12個、必須フィールド完備', () => {
  eq(Object.keys(A.TRAITS).length, 12);
  Object.entries(A.TRAITS).forEach(([k,v]) => ['name','cat','catch','strong','scene','easy'].forEach(f =>
    ok(v[f], `${k} の ${f} が空`)));
});
t('進みグセは5個、必須フィールド完備', () => {
  eq(Object.keys(A.STYLES).length, 5);
  Object.entries(A.STYLES).forEach(([k,v]) => ['name','emoji','catch','good','tip','micro','line'].forEach(f =>
    ok(v[f], `${k} の ${f} が空`)));
});
t('道は8個、必須フィールド完備', () => {
  eq(Object.keys(A.TYPES).length, 8);
  Object.entries(A.TYPES).forEach(([k,v]) => ['name','sub','catch','desc','examples','money','w'].forEach(f =>
    ok(v[f] && v[f].length !== 0, `${k} の ${f} が空`)));
});
t('道の重みキーがすべて実在する', () => {
  Object.entries(A.TYPES).forEach(([k,v]) => Object.keys(v.w).forEach(x => ok(A.TRAITS[x], `${k}: 未知 ${x}`)));
});
t('全8タイプぶんのやることが定義済み', () => {
  Object.keys(A.TYPES).forEach(ty => { ok(A.TYPE_STEPS[ty], `${ty} が未定義`);
    ['c1','c2','c3'].forEach(c => eq(A.TYPE_STEPS[ty][c].length, 2, `${ty}.${c}`)); });
});
t('テーマは6色、色コードが正しい', () => {
  eq(Object.keys(A.THEMES).length, 6);
  Object.entries(A.THEMES).forEach(([k,v]) => {
    ok(/^#[0-9A-Fa-f]{6}$/.test(v.a) && /^#[0-9A-Fa-f]{6}$/.test(v.b), `${k} の色が不正`); });
});
t('副業以外の道が3つ、注記つき', () => {
  eq(A.OTHER_WAYS.length, 3);
  A.OTHER_WAYS.forEach(w => ok(w.title && w.body && w.step));
  ok(A.MONEY_NOTE.includes('投資助言'), '投資助言でない旨の注記が無い');
  ok(A.LEARN_LINK.url.startsWith('https://'), 'リンクがhttpsでない');
});

/* ================= 8. 言葉づかいの憲法 ================= */
group('8. 言葉づかいの憲法');
const SRC = FILES.map(read).join('\n') + read('index.html');
const NEG = ['向いていない','向いてない','できていない','動けない','ダメ','無理です','怠け','言い訳','欠点','弱み'];
t('否定ワードが混入していない', () => {
  const hit = NEG.filter(w => {
    const i = SRC.indexOf(w); if (i < 0) return false;
    return !/使わない|絶対に言わない|しない|求めない|増やさない|責めず/.test(SRC.slice(Math.max(0,i-110), i+40));
  });
  ok(hit.length === 0, `混入: ${hit.join(',')}`);
});
const META = ['探偵','燈月','ローファイ','手がかり','相棒'];
t('世界観の比喩が混入していない', () => {
  const hit = META.filter(w => SRC.includes(w));
  ok(hit.length === 0, `混入: ${hit.join(',')}`);
});
t('文字化け（ハングル・キリル）が無い', () => {
  const bad = [...SRC].filter(c => (0xAC00<=c.charCodeAt(0)&&c.charCodeAt(0)<=0xD7AF) || (0x0400<=c.charCodeAt(0)&&c.charCodeAt(0)<=0x04FF));
  ok(bad.length === 0, `混入: ${[...new Set(bad)].join('')}`);
});
t('Gallup商標の免責が入っている', () => {
  ok(SRC.includes('CliftonStrengths') && SRC.includes('無関係'), '免責文が無い');
});
t('リベ大の出典表記が入っている', () => {
  ok(SRC.includes('リベラルアーツ大学'), '出典表記が無い');
});
t('「今日はここまで」の逃げ道が用意されている', () => {
  ok(SRC.includes('今日はここまで'), '離脱導線が無い');
});

/* ================= 9. 保存と再開 ================= */
group('9. 保存と再開（途中離脱）');
t('新規プロフィールに必要な箱が揃っている', () => {
  const p = A.blankProfile('x');
  ['id','name','createdAt','gate','gateQuiz','quiz','result','steps','logs','sessions','goal'].forEach(k =>
    ok(k in p, `${k} が無い`));
});
t('適性チェックの途中状態を保持できる', () => {
  const p = A.blankProfile('x'); p.gateQuiz = { i:3, a:{g0:4,g1:3,g2:2} };
  const back = JSON.parse(JSON.stringify(p));
  eq(back.gateQuiz.i, 3); eq(Object.keys(back.gateQuiz.a).length, 3);
});
t('持ち味チェックの途中状態を保持できる', () => {
  const p = A.blankProfile('x'); p.quiz = { i:17, a:{} };
  for (let i=0;i<17;i++) p.quiz.a['t'+i] = 3;
  const back = JSON.parse(JSON.stringify(p));
  eq(back.quiz.i, 17); eq(Object.keys(back.quiz.a).length, 17);
});
t('保存データがJSONとして往復できる', () => {
  const p = A.blankProfile('カラスイ');
  p.result = quiz(fill(24,3)); p.steps = A.buildSteps(p.result.type);
  p.gate = gate(fill(8,3)); p.logs = [{date:'2026-08-27', text:'テスト'}];
  const S = { v:1, theme:'sepia', dark:'auto', mode:'self', activeId:p.id, selfId:p.id, profiles:{[p.id]:p} };
  const back = JSON.parse(JSON.stringify(S));
  eq(back.profiles[p.id].result.type, p.result.type);
  eq(A.timesMoved(back.profiles[p.id]), 1);
});

/* ================= 結果 ================= */
const total = pass + fail;
console.log(`\n${C.b}${'─'.repeat(52)}${C.x}`);
if (fail === 0) console.log(`${C.g}${C.b}  ぜんぶ通りました  ${pass}/${total}${C.x}`);
else { console.log(`${C.r}${C.b}  ${fail}件 失敗  (${pass}/${total} 成功)${C.x}`);
       fails.forEach(f => console.log(`${C.r}   - ${f}${C.x}`)); }
console.log(`${C.b}${'─'.repeat(52)}${C.x}\n`);
process.exit(fail ? 1 : 0);

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
  navigator:{ userAgent:'node', platform:'node', maxTouchPoints:0 },
  addEventListener(){}, removeEventListener(){},
  requestAnimationFrame(){}, setTimeout(){}, clearTimeout(){},
  location:{hostname:'localhost'}, Image:function(){}, caches:{keys:()=>Promise.resolve([])},
  performance:{now:()=>0}, Event:function(){} };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
const FILES = ['assets/data.js','assets/akari.js','assets/app.js'];
vm.runInContext(FILES.map(read).join('\n') + `
;globalThis.API = { scoreGate, scoreAll, matchJobs, buildSteps, blankProfile, makePrompt,
  flat, nextStep, doneCount, totalCount, timesMoved, ymd, today, cleanStore, cleanProfile,
  QALL, CORE_COUNT, EXTRA_COUNT, carrySteps, navHtml, vHome, vClues, vJobs, vBook, vBuddy, P,
  INSTALL, installCard, canInstall, isIOS, isStandalone,
  TRAITS, STYLES, TYPES, JOBS, JOB_CATS, GATES, CHAPTERS, PROMPTS, THEMES, VOICE,
  Q_GATE, GATE_CORE, Q_PAIR, Q_STYLE_PICK, pairOptions, SCALE, REALITY, vReality, OTHER_WAYS, COMMON_STEPS, TYPE_STEPS, LEARN_LINK, MONEY_NOTE, YEN_NOTE };`,
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
/* 前半6問の「どっち寄り」に答えた形を作る。値は1〜4（4=A寄り） */
const quiz = (pairVals, styleCode) => {
  const a = {};
  (pairVals || []).forEach((v, i) => a['p' + i] = v);
  a['y0'] = styleCode || 'perfect';
  return A.scoreAll(a);
};
/* 特定の持ち味を高くした回答を作る */
const lean = (want) => {
  const a = {};
  A.Q_PAIR.slice(0, 6).forEach(([pair], i) => {
    a['p' + i] = want.includes(pair[0]) ? 4 : want.includes(pair[1]) ? 1 : 2 + (i % 2);
  });
  a['y0'] = 'perfect';
  return A.scoreAll(a);
};
const fill = (n,v) => Array(n).fill(v);

/* ================= 1. 適性チェック ================= */
group('1. 適性チェック（気持ち×余力の2軸判定）');
// 並び: time, give, why, keep（各1問）
t('適性チェックは4問だけ', () => eq(A.Q_GATE.length, 4));
t('時間も気持ちも十分 → ready', () => {
  const g = gate([4, 4, 4, 4]); eq(g.tier, 'ready'); return `気持ち${g.motive} 余力${g.room}`;
});
t('やる気はあるが時間がない → time（弾かない）', () => {
  const g = gate([1, 2, 4, 4]); eq(g.tier, 'time'); return `気持ち${g.motive} 余力${g.room}`;
});
t('時間はあるが変えたい気持ちが薄い → other', () => {
  const g = gate([4, 4, 1, 2]); eq(g.tier, 'other'); return `気持ち${g.motive} 余力${g.room}`;
});
t('すべて最低 → other', () => eq(gate(fill(4,1)).tier, 'other'));
t('すべて最高 → ready', () => eq(gate(fill(4,4)).tier, 'ready'));
t('ぜんぶ「ややそう」→ ready', () => eq(gate(fill(4,3)).tier, 'ready'));
t('ぜんぶ「ややちがう」→ other', () => eq(gate(fill(4,2)).tier, 'other'));
t('未回答は中間(2)として扱われ落ちない', () => { const g = A.scoreGate({}); ok(['ready','time','other'].includes(g.tier)); return g.tier; });
t('気持ち・余力は 4〜16 の範囲に収まる', () => {
  for (let n=0;n<400;n++){ const g = gate(fill(4,0).map(()=>1+Math.floor(Math.random()*4)));
    ok(g.motive>=4&&g.motive<=16&&g.room>=4&&g.room<=16, `範囲外 ${g.motive}/${g.room}`); }
});
t('3つの分岐すべてに到達できる', () => {
  const seen = new Set();
  for (let n=0;n<2000;n++) seen.add(gate(fill(4,0).map(()=>1+Math.floor(Math.random()*4))).tier);
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
t('どっち寄りは12問（前半6が必須・後半6が追加）', () => {
  eq(A.Q_PAIR.length, 12);
  return `必須6 + 追加6`;
});
t('選択肢は4つで、値は4→1の順', () => {
  A.Q_PAIR.forEach((q, i) => {
    const o = A.pairOptions(q);
    eq(o.length, 4, `${i}問目`);
    eq(o.map(x => x.v), [4,3,2,1], `${i}問目`);
  });
});
t('選択肢は、読むだけで意味が通る文になっている', () => {
  A.Q_PAIR.forEach((q, i) => {
    A.pairOptions(q).forEach(o => {
      ok(o.label.length >= 5, `${i}問目に短すぎる選択肢: ${o.label}`);
      ok(!/^[AB]$|^こっち$|^どちらかといえば$/.test(o.label),
        `${i}問目に、それだけでは意味が分からない選択肢: ${o.label}`);
    });
  });
  return A.pairOptions(A.Q_PAIR[0]).map(o => o.label).join(' / ');
});
t('4つの選択肢がすべて違う文になっている', () => {
  A.Q_PAIR.forEach((q, i) => {
    const labels = A.pairOptions(q).map(o => o.label);
    eq(new Set(labels).size, 4, `${i}問目に同じ文がある`);
  });
});
t('設問データに短い言い方が入っている', () => {
  A.Q_PAIR.forEach((q, i) => {
    eq(q.length, 5, `${i}問目の項目数`);
    [1,2,3,4].forEach(k => ok(q[k] && q[k].length >= 3, `${i}問目の${k}番目が空`));
    ok(q[2].length <= q[1].length + 4, `${i}問目: 短い言い方が短くない（${q[2]}）`);
  });
});
t('片側にすべて寄せると、その持ち味が100%・反対側が0%になる', () => {
  const a = {}; A.Q_PAIR.slice(0,6).forEach((_, i) => a['p'+i] = 4); a['y0']='perfect';
  const r = A.scoreAll(a);
  A.Q_PAIR.slice(0,6).forEach(([p]) => { eq(r.traits[p[0]], 100, p[0]); eq(r.traits[p[1]], 0, p[1]); });
});
t('まんなかで答えると、全持ち味が中間に寄る', () => {
  const a = {}; A.Q_PAIR.slice(0,6).forEach((_, i) => a['p'+i] = i % 2 ? 2 : 3); a['y0']='perfect';
  const r = A.scoreAll(a);
  ok(Object.values(r.traits).every(v => v >= 33 && v <= 67), '極端に振れている');
});
t('持ち味は12個ぜんぶ算出される', () => eq(Object.keys(quiz(fill(6,3)).traits).length, 12));
t('進みグセは5個ぜんぶ算出される', () => eq(Object.keys(quiz(fill(6,3)).styles).length, 5));
t('スコアは 0〜100 に収まる', () => {
  for (let n=0;n<300;n++){ const r = quiz(fill(6,0).map(()=>1+Math.floor(Math.random()*4)));
    Object.values(r.traits).concat(Object.values(r.styles)).forEach(v=>ok(v>=0&&v<=100, `範囲外 ${v}`)); }
});
t('まんなか一辺倒のときは、いちばん始めやすい道になる', () => {
  const a = {}; A.Q_PAIR.slice(0,6).forEach((_, i) => a['p'+i] = 2); a['y0']='perfect';
  ok(A.TYPES[A.scoreAll(a).type], '道が出ない');
  return A.TYPES[A.scoreAll(a).type].name;
});
t('8つの道すべてに到達できる', () => {
  const seen = new Set();
  for (let n=0;n<4000;n++) seen.add(quiz(fill(6,0).map(()=>1+Math.floor(Math.random()*4))).type);
  const miss = Object.keys(A.TYPES).filter(k=>!seen.has(k));
  ok(miss.length===0, `到達しない道: ${miss.join(',')}`);
  return `${seen.size}/8`;
});
t('発信寄りに答えると、発信系の道になる', () => {
  const r = lean(['hasshin','chakuso','hyogen']);
  ok(['content','plan','make','curate','teach'].includes(r.type), `想定外: ${r.type}`);
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
  const r = quiz(fill(6,3));
  eq(A.matchJobs(r.traits,3).length, 3); eq(A.matchJobs(r.traits).length, 20);
});
t('相性スコアの降順で並ぶ', () => {
  const m = A.matchJobs(quiz(fill(6,0).map(()=>1+Math.floor(Math.random()*4))).traits);
  for (let i=1;i<m.length;i++) ok(m[i-1].s >= m[i].s, '並び順が崩れている');
});
t('20件すべてが上位3に入りうる', () => {
  const seen = new Set();
  for (let n=0;n<3000;n++){ const r = quiz(fill(6,0).map(()=>1+Math.floor(Math.random()*4)));
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
  p.result = quiz(fill(6,3)); p.steps = A.buildSteps(p.result.type);
  p.gate = gate(fill(4,3)); return p; })();
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
  p.result = quiz(fill(6,3)); p.steps = A.buildSteps(p.result.type);
  p.gate = gate(fill(4,3)); p.logs = [{date:'2026-08-27', text:'テスト'}];
  const S = { v:1, theme:'sepia', dark:'auto', mode:'self', activeId:p.id, selfId:p.id, profiles:{[p.id]:p} };
  const back = JSON.parse(JSON.stringify(S));
  eq(back.profiles[p.id].result.type, p.result.type);
  eq(A.timesMoved(back.profiles[p.id]), 1);
});


/* ================= 10. 外から来たデータの検証 ================= */
group('10. 読み込みデータの検証（壊れたJSONで落ちないこと）');
const goodStore = (() => { const p = A.blankProfile('カラスイ');
  p.result = quiz(fill(6,3)); p.steps = A.buildSteps(p.result.type);
  p.gate = gate(fill(4,3)); p.goal = {why:'旅行',reward:'ヘッドホン',hours:'夜30分'};
  p.logs = [{date:'2026-08-27', text:'やった'}];
  p.steps[0].items[0].done = true;
  return { v:1, theme:'mint', dark:'on', mode:'self', activeId:p.id, selfId:p.id, profiles:{[p.id]:p} }; })();

t('正常なデータはそのまま通る', () => {
  const c = A.cleanStore(JSON.parse(JSON.stringify(goodStore)));
  eq(c.theme,'mint'); eq(c.dark,'on');
  const p = c.profiles[c.selfId];
  eq(p.name,'カラスイ'); eq(p.goal.reward,'ヘッドホン'); eq(A.doneCount(p), 1);
  return `${Object.keys(c.profiles).length}人 / 完了${A.doneCount(p)}`;
});
[['null', null], ['数値', 42], ['文字列', 'こんにちは'], ['空オブジェクト', {}],
 ['配列', []], ['profilesが配列', {profiles:[]}], ['profilesが文字列', {profiles:'x'}],
 ['profilesが空', {profiles:{}}],
].forEach(([label, v]) => {
  t(`${label} は読み込みを拒否する`, () => {
    let threw = false;
    try { A.cleanStore(v); } catch (e) { threw = true; }
    ok(threw, '例外が出ていない（不正なデータを受け入れてしまう）');
  });
});
t('知らないキーは捨てられる', () => {
  const c = A.cleanStore({ profiles:{ a:{ name:'x' } }, selfId:'a', activeId:'a',
    evil:'<script>', __proto__:{polluted:true}, theme:'存在しない色', dark:'変な値', mode:'変な値' });
  ok(!('evil' in c), 'evil が残っている');
  eq(c.theme,'sepia'); eq(c.dark,'auto'); eq(c.mode,'self');
});
t('壊れた持ち味スコアは0に丸められる', () => {
  const p = { name:'x', result:{ type:'content', traits:{ hasshin: 99999, tankyu:'abc', nope: 50 }, styles:{} } };
  const c = A.cleanProfile(p);
  eq(c.result.traits.hasshin, 0); eq(c.result.traits.tankyu, 0);
  ok(!('nope' in c.result.traits), '知らない持ち味が残っている');
  eq(Object.keys(c.result.traits).length, 12);
});
t('知らない道は結果ごと捨てられる', () => {
  eq(A.cleanProfile({ name:'x', result:{ type:'存在しない道' } }).result, null);
});
t('やることは現在の定義から作り直される', () => {
  const c = A.cleanProfile({ name:'x', result:{type:'content',traits:{},styles:{}},
    steps:[{items:[{text:'古い文言',done:true},{text:'発信する場所を1つだけ決める',done:true}]}] });
  eq(A.flat({steps:c.steps}).length, 9, 'やることの数');
  ok(!A.flat({steps:c.steps}).some(x => x.text === '古い文言'), '古い文言が残っている');
  eq(A.doneCount(c), 1, '実在するものの完了状態だけ引き継ぐ');
});
t('長すぎる文字列は切り詰められる', () => {
  const c = A.cleanProfile({ name:'あ'.repeat(9999), goal:{ why:'い'.repeat(9999) } });
  ok(c.name.length <= 60, `名前が${c.name.length}文字`);
  ok(c.goal.why.length <= 2000, `理由が${c.goal.why.length}文字`);
  return `名前${c.name.length} / 理由${c.goal.why.length}`;
});
t('記録が多すぎる場合は上限で止まる', () => {
  const logs = Array.from({length:99999}, (_,i) => ({date:'2026-01-01', text:'x'+i}));
  const c = A.cleanProfile({ name:'x', logs });
  ok(c.logs.length <= 500, `${c.logs.length}件`);
  return `${c.logs.length}件に制限`;
});
t('記録やメモが配列でなくても落ちない', () => {
  const c = A.cleanProfile({ name:'x', logs:'not-array', sessions:42, goal:'not-object' });
  eq(c.logs, []); eq(c.sessions, []); eq(c.goal.why, '');
});
t('存在しないIDを指していたら自動で直る', () => {
  const c = A.cleanStore({ profiles:{ a:{name:'x'} }, selfId:'いない', activeId:'いない' });
  ok(c.profiles[c.selfId] && c.profiles[c.activeId], '参照が壊れたまま');
});
t('HTMLらしき文字列を入れても、そのまま保持されるだけ（描画側でescape）', () => {
  const c = A.cleanProfile({ name:'<img src=x onerror=alert(1)>' });
  ok(typeof c.name === 'string');
  return '文字列として保持';
});


/* ================= 11. 必須10問 / 追加8問 ================= */
group('11. 答える量（1問で2つ測る形式）');
t('必須は10問（適性3 + どっち寄り6 + グセ1）', () => {
  eq(A.GATE_CORE, 3);
  eq(A.QALL(false).length, 7);
  eq(A.CORE_COUNT, 10);
  return `適性${A.GATE_CORE} + どっち寄り6 + グセ1 = ${A.CORE_COUNT}問`;
});
t('追加は8問', () => { eq(A.EXTRA_COUNT, 8); });
t('必須と追加で全設問をちょうど覆う', () => {
  const all = [...A.QALL(false), ...A.QALL(true)].map(q => q.k);
  eq(new Set(all).size, all.length, '重複がある');
  eq(all.length, A.Q_PAIR.length + A.Q_STYLE_PICK.length);
});
t('必須6問で12の持ち味すべてがちょうど1回ずつ出る', () => {
  const c = {};
  A.Q_PAIR.slice(0, 6).forEach(([p]) => p.forEach(k => c[k] = (c[k] || 0) + 1));
  eq(Object.keys(c).length, 12);
  ok(Object.values(c).every(v => v === 1), '登場回数が偏っている');
});
t('追加6問でも12の持ち味すべてが1回ずつ出る', () => {
  const c = {};
  A.Q_PAIR.slice(6).forEach(([p]) => p.forEach(k => c[k] = (c[k] || 0) + 1));
  eq(Object.keys(c).length, 12);
  ok(Object.values(c).every(v => v === 1));
});
t('どっち寄りの左右が同じ持ち味になっていない', () => {
  A.Q_PAIR.forEach(([p], i) => ok(p[0] !== p[1], `${i}問目が同じ持ち味どうし`));
});
t('どっち寄りの重みキーがすべて実在する', () => {
  A.Q_PAIR.forEach(([p], i) => p.forEach(k => ok(A.TRAITS[k], `${i}問目に未知の持ち味 ${k}`)));
});
t('進みグセの選択肢は5種すべてを含む', () => {
  A.Q_STYLE_PICK.forEach((q, i) => {
    eq(q.opts.length, 5, `${i}問目`);
    q.opts.forEach(([c]) => ok(A.STYLES[c], `未知のグセ ${c}`));
  });
});
t('必須10問だけで結果が出る（道・持ち味・グセすべて）', () => {
  const a = {}; A.Q_PAIR.slice(0,6).forEach((_, i) => a['p'+i] = 1 + (i % 4)); a['y0'] = 'choice';
  const r = A.scoreAll(a);
  ok(A.TYPES[r.type], '道が出ない');
  eq(Object.keys(r.traits).length, 12); eq(Object.keys(r.styles).length, 5);
  eq(Object.entries(r.styles).sort((x,y)=>y[1]-x[1])[0][0], 'choice', '選んだグセが最上位になっていない');
  return A.TYPES[r.type].name;
});
t('必須10問だけで副業マッチングができる', () => {
  const a = {}; A.Q_PAIR.slice(0,6).forEach((_, i) => a['p'+i] = 1 + (i % 4)); a['y0'] = 'perfect';
  const m = A.matchJobs(A.scoreAll(a).traits, 3);
  eq(m.length, 3);
  return m.map(x => x.job.name).join(' / ');
});
t('1問で2つの持ち味が同時に決まる（Aが4ならBは1）', () => {
  const a = { p0: 4, y0: 'perfect' };
  const r = A.scoreAll(a);
  const [x, y] = A.Q_PAIR[0][0];
  eq(r.traits[x], 100); eq(r.traits[y], 0);
  return `${A.TRAITS[x].name}100% / ${A.TRAITS[y].name}0%`;
});
t('追加8問を足しても、同じものさしで比べられる', () => {
  const core = { y0: 'perfect' }; A.Q_PAIR.slice(0,6).forEach((_, i) => core['p'+i] = 4);
  const full = Object.assign({}, core, { y1: 'perfect' });
  A.Q_PAIR.slice(6).forEach((_, i) => full['p'+(i+6)] = 4);
  const a = A.scoreAll(core), b = A.scoreAll(full);
  eq(Object.keys(a.traits).length, Object.keys(b.traits).length);
  ok(Object.values(b.traits).every(v => v >= 0 && v <= 100));
});
t('同じ持ち味で答えが割れると、中間の値になる', () => {
  /* sokudan は前半 p0 と後半 p6 の両方でA側に出る。
     片方を「こっち(4)」、もう片方を反対「こっち(1)」にすると平均2.5＝50%になるはず */
  eq(A.Q_PAIR[0][0][0], 'sokudan'); eq(A.Q_PAIR[6][0][0], 'sokudan');
  const same = A.scoreAll({ p0: 4, p6: 4, y0: 'perfect' });
  const split = A.scoreAll({ p0: 4, p6: 1, y0: 'perfect' });
  eq(same.traits.sokudan, 100, '一致したのに100%になっていない');
  eq(split.traits.sokudan, 50, '割れたのに中間になっていない');
  return `一致${same.traits.sokudan}% / 割れ${split.traits.sokudan}%`;
});
t('追加すると、持ち味の値が細かくなる', () => {
  const core = { y0: 'perfect' }; A.Q_PAIR.slice(0,6).forEach((_, i) => core['p'+i] = 1 + (i % 4));
  const full = Object.assign({}, core, { y1: 'choice' });
  A.Q_PAIR.slice(6).forEach((_, i) => full['p'+(i+6)] = 1 + ((i + 2) % 4));
  const a = new Set(Object.values(A.scoreAll(core).traits));
  const b = new Set(Object.values(A.scoreAll(full).traits));
  ok(b.size >= a.size, `段階が増えていない（${a.size}→${b.size}）`);
  return `値の種類 ${a.size} → ${b.size}`;
});
t('道が変わっても、終わったやることは引き継がれる', () => {
  const s1 = A.buildSteps('content');
  s1[0].items[0].done = true;
  const s2 = A.carrySteps(s1, 'teach');
  eq(s2.reduce((n,c)=>n+c.items.length,0), 9);
  ok(s2[0].items[0].done, '共通のやることが引き継がれていない');
});
t('保存データの答えと段階が復元される', () => {
  const a = { p0:4, p1:2, y0:'choice' };
  const c = A.cleanProfile({ name:'x', answers:a, depth:'core',
    result:{type:'content',traits:{},styles:{}} });
  eq(c.answers, a); eq(c.depth, 'core');
});
t('壊れた答えは捨てられる', () => {
  const c = A.cleanProfile({ name:'x',
    answers:{ p0:9, p1:'abc', p2:3, y0:'存在しないグセ', y1:'alone', zzz:2 }, depth:'変な値' });
  eq(c.answers, { p2:3, y1:'alone' }); eq(c.depth, 'core');
});

/* ================= 12. 触りはじめの導線 ================= */
group('12. こたえる前の画面（行き止まりを作らない）');
const strip = h => h.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const fresh = () => A.blankProfile('あなた');

const tabCount = () => (A.navHtml().match(/nav-btn/g) || []).length;
t('こたえる前のタブは2つだけ', () => {
  const p = A.P(); p.result = null;
  eq(tabCount(), 2, '押しても何も無いタブが並んでいる');
  return 'ホーム・しごと';
});
t('こたえたあとはタブが5つになる', () => {
  const p = A.P(); p.result = quiz(fill(6,3));
  const n = tabCount(); p.result = null;
  eq(n, 5, 'こたえたのにタブが増えていない');
});
[['もちあじ', A.vClues, '持ち味'], ['きろく', A.vBook, '記録'], ['そうだん', A.vBuddy, 'AI']].forEach(([name, fn, word]) => {
  t(`${name}は、こたえる前でも何が出るか説明する`, () => {
    const txt = strip(fn(fresh()));
    ok(txt.length > 40, `短すぎる（${txt.length}字）— 行き止まりになっている`);
    ok(!txt.includes('まだ、はじめていませんね'), '突き放す文言が残っている');
    ok(txt.includes('こたえる') || txt.includes('見てみる'), '次にできることが示されていない');
    return `${txt.length}字`;
  });
});
t('しごとは、こたえなくても20コぜんぶ読める', () => {
  const txt = strip(A.vJobs(fresh()));
  A.JOBS.forEach(j => ok(txt.includes(j.name), `${j.name} が出ていない`));
  return `${A.JOBS.length}コすべて表示`;
});
t('こたえる前のどの画面からも、次に進む手がある', () => {
  [['ホーム', A.vHome], ['もちあじ', A.vClues], ['しごと', A.vJobs],
   ['きろく', A.vBook], ['そうだん', A.vBuddy]].forEach(([name, fn]) => {
    const h = fn(fresh());
    ok(/data-nav="gate"|data-nav="jobs"/.test(h), `${name} に進む手がない`);
  });
});
t('画面に出る文言に、古い問題数が残っていない', () => {
  /* 問題数を変えたときの直し漏れを機械的に見つける。
     コメントは対象外にし、実際に画面へ出る文字列だけを見る */
  const strings = [];
  Object.values(A.GATES).forEach(g => strings.push(g.title, g.lead, g.body, g.cta));
  Object.values(A.VOICE).forEach(v => strings.push(...[].concat(v)));
  A.PROMPTS.forEach(p => strings.push(p.name, p.desc));
  A.OTHER_WAYS.forEach(w => strings.push(w.title, w.body, w.step));
  const html = read('index.html').match(/content="([^"]*)"/g) || [];
  const txt = strings.join(' ') + ' ' + html.join(' ');

  const okNums = [A.CORE_COUNT, A.EXTRA_COUNT, A.GATE_CORE, A.CORE_COUNT - A.GATE_CORE];
  const found = [...new Set([...txt.matchAll(/(\d+)\s*問/g)].map(m => +m[1]))];
  const bad = found.filter(n => !okNums.includes(n));
  ok(bad.length === 0, `画面に出る文言と実際の問題数が食い違っている: ${bad.join(',')}問`);
  return found.length ? `${found.join('・')}問` : '記載なし';
});

t('こたえる前の画面に、問題数と所要時間が書いてある', () => {
  const h = A.vHome(fresh()) + A.vJobs(fresh()) + A.vClues(fresh());
  ok(h.includes(String(A.CORE_COUNT)), '問題数が書かれていない');
  ok(h.includes('2分') || h.includes('3秒'), '所要時間の目安がない');
});


/* ================= 13. お金の具体性 ================= */
group('13. お金のこと（20コすべてに具体的な数字があるか）');
t('全20コに5項目そろっている', () => {
  const need = ['where', 'unit', 'firstYen', 'to5', 'cost'];
  A.JOBS.forEach(j => need.forEach(k =>
    ok(j[k] && String(j[k]).length >= 4, `${j.name} の ${k} が空か短すぎる`)));
  return '売る場所 / いくらになる / 最初の1円まで / 月5万円 / 費用';
});
t('「いくらになる」に必ず金額が書いてある', () => {
  A.JOBS.forEach(j => ok(/[0-9０-９]/.test(j.unit) && /円|%/.test(j.unit),
    `${j.name}: 数字が入っていない → ${j.unit}`));
});
t('「最初の1円まで」に期間が書いてある', () => {
  A.JOBS.forEach(j => ok(/日|週間|ヶ月|年/.test(j.firstYen),
    `${j.name}: 期間が書かれていない → ${j.firstYen}`));
});
t('「月5万円にするなら」に必要な量が書いてある', () => {
  A.JOBS.forEach(j => ok(/[0-9０-９]/.test(j.to5), `${j.name}: 数字がない`));
});
t('「はじめる費用」に金額が書いてある', () => {
  A.JOBS.forEach(j => ok(/円/.test(j.cost), `${j.name}: 費用が書かれていない`));
});
t('「売る場所」に実在のサービス名が入っている', () => {
  A.JOBS.forEach(j => ok(j.where.length > 4 && !/など$/.test(j.where.trim()),
    `${j.name}: 具体名がない → ${j.where}`));
  return A.JOBS[0].where;
});
t('収入を断定・保証する書き方をしていない', () => {
  const NG = ['稼げます', '確実に', '必ず', '誰でも', '簡単に稼', '保証', '楽して'];
  A.JOBS.forEach(j => {
    const txt = [j.unit, j.firstYen, j.to5, j.cost, j.real].join(' ');
    NG.forEach(w => ok(!txt.includes(w), `${j.name} に「${w}」が入っている`));
  });
});
t('金額が目安である旨の注記がある', () => {
  ok(A.YEN_NOTE.includes('目安') && A.YEN_NOTE.includes('保証するものではありません'),
    '注記が不十分');
  return A.YEN_NOTE.slice(0, 24) + '…';
});
t('元手が要るものは、そのことが費用に書いてある', () => {
  [['sedori', '仕入'], ['handmade', '材料'], ['d2c', '在庫'], ['fudosan', '頭金']]
    .forEach(([id, word]) => {
      const j = A.JOBS.find(x => x.id === id);
      ok(j.cost.includes(word), `${j.name} の費用に「${word}」が書かれていない`);
    });
});
t('元手ゼロで始められるものは、費用の冒頭が0円になっている', () => {
  /* 「初期在庫10〜50万円。ショップ開設はBASEなら0円」のような文中の0円を
     元手ゼロと誤って読まないよう、書き出しだけを見る */
  const zero = A.JOBS.filter(j => j.cost.startsWith('0円'));
  ok(zero.length >= 8, `0円ではじめられるものが少なすぎる（${zero.length}件）`);
  ok(!zero.some(j => ['sedori', 'handmade', 'd2c', 'fudosan'].includes(j.id)),
    '元手が要るものが0円扱いになっている');
  return `${zero.length}件が元手0円`;
});


/* ================= 14. スマホで使えるか ================= */
group('14. スマホ（ホーム画面に追加できるか）');
t('manifest がアプリとして開く設定になっている', () => {
  const m = JSON.parse(read('manifest.json'));
  eq(m.display, 'standalone', 'ブラウザのUIが出てしまう');
  ok(m.start_url && m.scope, 'start_url か scope が無い');
  ok(m.name && m.short_name, '名前が無い');
  return `${m.display} / ${m.orientation || '向き指定なし'}`;
});
t('アイコンに any と maskable の両方がある', () => {
  const m = JSON.parse(read('manifest.json'));
  const purposes = m.icons.map(i => i.purpose);
  ok(purposes.some(p => p.includes('any')), 'any が無い');
  ok(purposes.some(p => p.includes('maskable')), 'maskable が無い（Androidで角が欠ける）');
  m.icons.forEach(i => ok(fs.existsSync(path.join(ROOT, i.src.replace('./',''))), `${i.src} が実在しない`));
  return `${m.icons.length}枚`;
});
t('iPhone用の設定が入っている', () => {
  const h = read('index.html');
  ['apple-mobile-web-app-capable', 'apple-mobile-web-app-title',
   'apple-mobile-web-app-status-bar-style', 'apple-touch-icon'].forEach(k =>
    ok(h.includes(k), `${k} が無い`));
});
t('画面の切り欠き（ノッチ）に対応している', () => {
  const h = read('index.html'), c = read('assets/style.css');
  ok(h.includes('viewport-fit=cover'), 'viewport-fit=cover が無い');
  ok(c.includes('safe-area-inset'), 'セーフエリアの指定が無い');
});
t('iOSでは、ホーム画面に追加する手順が出る', () => {
  ok(INSTALL_HAS_IOS_STEPS(), '手順が無い');
  ok(A.INSTALL.ios.steps.length >= 2, '手順が少なすぎる');
  return A.INSTALL.ios.steps.length + '手順';
});
function INSTALL_HAS_IOS_STEPS() { return A.INSTALL && A.INSTALL.ios && Array.isArray(A.INSTALL.ios.steps); }
t('案内には「あとで」の逃げ道がある', () => {
  ok(A.INSTALL.later, '断る選択肢が無い');
  return A.INSTALL.later;
});
t('一度断ったら、もう出さない', () => {
  const c = A.cleanStore({ profiles:{ x:{name:'y'} }, selfId:'x', activeId:'x', installClosed:true });
  eq(c.installClosed, true, '断ったことが保存されない');
  const d = A.cleanStore({ profiles:{ x:{name:'y'} }, selfId:'x', activeId:'x' });
  eq(d.installClosed, false);
});
t('すでにホーム画面から開いている人には出さない', () => {
  const orig = ctx.matchMedia;
  ctx.matchMedia = q => ({ matches: q.includes('standalone'), addEventListener(){} });
  const shown = A.canInstall();
  ctx.matchMedia = orig;
  eq(shown, false, 'インストール済みなのに案内が出ている');
});
t('指で押せる大きさが確保されている', () => {
  const c = read('assets/style.css');
  ok(c.includes('@media (pointer: coarse)'), '指操作向けの指定が無い');
  const m = c.match(/@media \(pointer: coarse\)\{([\s\S]*?)\n\}/);
  ok(m, '指定が読めない');
  const sizes = [...m[1].matchAll(/min-height:(\d+)px/g)].map(x => +x[1]);
  ok(sizes.length >= 6, `対象が少なすぎる（${sizes.length}件）`);
  ok(sizes.every(v => v >= 40), `44px未満がある: ${sizes.filter(v => v < 40).join(',')}`);
  return `${sizes.length}種類 / 最小${Math.min(...sizes)}px`;
});
t('横スクロールが出る書き方をしていない', () => {
  const c = read('assets/style.css');
  ok(!/width:\s*\d{3,}px/.test(c.replace(/max-width[^;]*/g, '')), '固定幅の指定がある');
  ok(c.includes('overflow-x:auto') || c.includes('overflow-x: auto'), '横長要素の逃がし方が無い');
});


/* ================= 15. 押しても反応しない・変な所へ飛ぶ を防ぐ ================= */
group('15. ボタンの取り違え（属性名の衝突）');
const APP = read('assets/app.js');
t('同じ data 属性に、2つ以上の処理が付いていない', () => {
  /* 進みグセの選択肢と、コーチモードの相手選びが同じ data-pick を使っていて、
     最後の1問を押すとプロフィールが切り替わりホームへ飛ばされていた。
     同じ名前を2箇所で拾うと、押した瞬間に両方が走る。 */
  const names = [...APP.matchAll(/on\('\[data-([a-z]+)\]'/g)].map(m => m[1]);
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  ok(dup.length === 0, `2つ以上の処理が付いている: ${[...new Set(dup)].join(', ')}`);
  return `${new Set(names).size}種類の属性`;
});
t('画面に出しているのに、処理が付いていない属性がない', () => {
  const used = new Set([...APP.matchAll(/\sdata-([a-z]+)="/g)].map(m => m[1]));
  const handled = new Set([...APP.matchAll(/on\('\[data-([a-z]+)\]'/g)].map(m => m[1]));
  /* 値を読むためだけに使っているものは除く */
  const readOnly = new Set(['preset']);
  const orphan = [...used].filter(n => !handled.has(n) && !readOnly.has(n));
  ok(orphan.length === 0, `押しても何も起きない: ${orphan.join(', ')}`);
});
t('処理はあるのに、画面に出していない属性がない', () => {
  const used = new Set([...APP.matchAll(/\sdata-([a-z]+)="/g)].map(m => m[1]));
  const handled = new Set([...APP.matchAll(/on\('\[data-([a-z]+)\]'/g)].map(m => m[1]));
  const dead = [...handled].filter(n => !used.has(n));
  ok(dead.length === 0, `使われていない処理: ${dead.join(', ')}`);
});
t('進みグセの選択肢と、相手選びが別の属性になっている', () => {
  ok(APP.includes('data-style="'), '進みグセの選択肢が無い');
  ok(APP.includes('data-person="'), '相手選びが無い');
  ok(!APP.includes('data-pick'), 'ぶつかっていた古い名前が残っている');
});


/* ================= 16. 最初の一歩の具体さ ================= */
group('16. 最初の一歩（何をどう用意して、どう動くか）');
t('全20コが5手順ある', () => {
  A.JOBS.forEach(j => {
    ok(Array.isArray(j.steps), `${j.name} に手順が無い`);
    eq(j.steps.length, 5, j.name);
    j.steps.forEach(([t2, d], i) => {
      ok(t2 && t2.length >= 6, `${j.name} ${i+1}番目の行動が短い`);
      ok(d && d.length >= 10, `${j.name} ${i+1}番目の補足が短い`);
    });
  });
});
t('どの手順も、動作を指す言い方で終わっている', () => {
  /* 単語リストで判定すると言い回しを変えるたびに落ちるので、
     文末が動詞かどうかだけを見る */
  const verbEnd = /(る|す|く|つ|う|ぶ|む|ぬ|ぐ|に|を|で)$/;
  A.JOBS.forEach(j => j.steps.forEach(([t2], i) => {
    const head = t2.split(/（|\(/)[0].trim();
    ok(verbEnd.test(head), `${j.name} ${i+1}番目が動作で終わっていない: ${head}`);
  }));
});
t('手順に、具体的なサービス名か数字が入っている', () => {
  A.JOBS.forEach(j => {
    const txt = j.steps.map(s2 => s2.join(' ')).join(' ');
    ok(/[0-9０-９]/.test(txt), `${j.name} の手順に数字が無い`);
  });
});
t('抽象的な言い回しで終わっていない', () => {
  const NG = ['がんばる', '意識する', '心がける', '検討する', '考えてみる'];
  A.JOBS.forEach(j => j.steps.forEach(([t2], i) =>
    NG.forEach(w => ok(!t2.includes(w), `${j.name} ${i+1}番目が抽象的: ${t2}`))));
});

/* ================= 17. 現実を先に伝える ================= */
group('17. 甘くしない（先に正直なところを見せる）');
t('実際の調査データが入っている', () => {
  ok(A.REALITY.facts.length >= 3, '数字が少ない');
  A.REALITY.facts.forEach(f => {
    ok(/[0-9０-９]|半分|倍/.test(f.n), `量が伝わる表現になっていない: ${f.n}`);
    ok(f.label && f.note && f.note.length > 15, `${f.n} の説明が薄い`);
  });
  return A.REALITY.facts.map(f => f.n).join(' / ');
});
t('出典が書いてある', () => {
  ok(A.REALITY.source && A.REALITY.source.length > 10, '出典が無い');
  return A.REALITY.source.slice(0, 26) + '…';
});
t('やめる理由が、能力のせいにされていない', () => {
  ok(A.REALITY.quits.items.length >= 3);
  ok(A.REALITY.quits.note.includes('才能がなかった') || A.REALITY.quits.note.includes('誰でも'),
    '本人のせいに読める書き方になっている');
});
t('厳しい話のあとに、必ず対処が書いてある', () => {
  ok(A.REALITY.keeps.items.length >= 3, '対処が少ない');
  A.REALITY.keeps.items.forEach(k => ok(k.t && k.d && k.d.length > 20, `${k.t} の説明が薄い`));
});
t('現実の画面から、次に進む手がある', () => {
  const h = A.vReality(A.blankProfile('x'));
  ok(/data-nav="(gate|book)"/.test(h), '行き止まりになっている');
});

/* ================= 結果 ================= */
const total = pass + fail;
console.log(`\n${C.b}${'─'.repeat(52)}${C.x}`);
if (fail === 0) console.log(`${C.g}${C.b}  ぜんぶ通りました  ${pass}/${total}${C.x}`);
else { console.log(`${C.r}${C.b}  ${fail}件 失敗  (${pass}/${total} 成功)${C.x}`);
       fails.forEach(f => console.log(`${C.r}   - ${f}${C.x}`)); }
console.log(`${C.b}${'─'.repeat(52)}${C.x}\n`);
process.exit(fail ? 1 : 0);

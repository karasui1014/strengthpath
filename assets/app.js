/* StrengthPath - アプリ本体 */
'use strict';

const KEY = 'strengthpath-v1';
const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => ymd(new Date());
const fmtDate = d => d ? d.slice(5).replace('-', '/') : '';
const pick = a => a[Math.floor(Math.random() * a.length)];

/* ========== ストア ========== */
let S = load();

function blankProfile(name) {
  return { id: uid(), name: name || 'あなた', createdAt: today(),
    gate: null, gateQuiz: null, quiz: null, answers: null, depth: null,
    result: null, steps: null, logs: [], sessions: [],
    goal: { why: '', reward: '', hours: '' } };
}
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (d && d.profiles) return cleanStore(d);
  } catch (e) { console.warn('保存データを読み直せなかったので、新しく始めます'); }
  const p = blankProfile('あなた');
  return { v: 1, theme: 'sepia', dark: 'auto', mode: 'self',
           activeId: p.id, selfId: p.id, profiles: { [p.id]: p } };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

/* ===== 読み込んだデータの検証 =====
   外から来たJSONをそのまま信用すると、壊れた形のままアプリが動かなくなる。
   知っているキーだけを拾い、型と長さを揃えてから使う。 */
const LIM = { text: 2000, name: 60, list: 500 };
const str = (v, max) => (typeof v === 'string' ? v : '').slice(0, max || LIM.text);
const num = (v, lo, hi, d) => (typeof v === 'number' && isFinite(v) && v >= lo && v <= hi) ? v : d;
const pick1 = (v, allowed, d) => allowed.includes(v) ? v : d;

function cleanProfile(raw) {
  const p = blankProfile(str(raw && raw.name, LIM.name) || 'あなた');
  if (!raw || typeof raw !== 'object') return p;
  if (typeof raw.id === 'string' && raw.id) p.id = raw.id.slice(0, 40);
  p.createdAt = /^\d{4}-\d{2}-\d{2}$/.test(raw.createdAt) ? raw.createdAt : today();
  p.goal = { why: str(raw.goal && raw.goal.why), reward: str(raw.goal && raw.goal.reward),
             hours: str(raw.goal && raw.goal.hours) };

  const pctMap = (o, keys) => { const r = {}; keys.forEach(k => r[k] = num(o && o[k], 0, 100, 0)); return r; };
  if (raw.result && TYPES[raw.result.type]) {
    p.result = { type: raw.result.type,
      traits: pctMap(raw.result.traits, Object.keys(TRAITS)),
      styles: pctMap(raw.result.styles, Object.keys(STYLES)),
      date: str(raw.result.date, 10) };
  }
  if (raw.gate) {
    p.gate = { motive: num(raw.gate.motive, 4, 16, 8), room: num(raw.gate.room, 4, 16, 8),
      tier: pick1(raw.gate.tier, ['ready', 'time', 'other'], 'ready'), date: str(raw.gate.date, 10) };
  }
  /* やることは、いまの定義から作り直したうえで完了状態だけ引き継ぐ。
     保存されたテキストを信じると、古い版や壊れた文言がそのまま残ってしまう。 */
  if (p.result) {
    p.steps = buildSteps(p.result.type);
    const doneTexts = new Set();
    (Array.isArray(raw.steps) ? raw.steps : []).forEach(c =>
      (c && Array.isArray(c.items) ? c.items : []).forEach(x => { if (x && x.done) doneTexts.add(str(x.text)); }));
    p.steps.forEach(c => c.items.forEach(x => { if (doneTexts.has(x.text)) { x.done = true; x.at = null; } }));
  }
  if (raw.answers && typeof raw.answers === 'object') {
    const ok = {};
    Q_PAIR.forEach((_, i) => { const v = num(raw.answers['p' + i], 1, 4, null); if (v) ok['p' + i] = v; });
    Q_STYLE_PICK.forEach((_, i) => { const v = raw.answers['y' + i]; if (STYLES[v]) ok['y' + i] = v; });
    if (Object.keys(ok).length) p.answers = ok;
  }
  p.depth = pick1(raw.depth, ['core', 'full'], p.answers ? 'core' : null);
  p.logs = (Array.isArray(raw.logs) ? raw.logs : []).slice(-LIM.list)
    .map(l => ({ date: str(l && l.date, 10), text: str(l && l.text),
                 kind: REPORT_KINDS.some(k => k.id === (l && l.kind)) ? l.kind : 'did' }))
    .filter(l => l.date && l.text);
  p.sessions = (Array.isArray(raw.sessions) ? raw.sessions : []).slice(-LIM.list)
    .map(s => ({ date: str(s && s.date, 10), note: str(s && s.note), next: str(s && s.next) }))
    .filter(s => s.date && s.note);
  return p;
}

function cleanStore(raw) {
  if (!raw || typeof raw !== 'object' || !raw.profiles || typeof raw.profiles !== 'object')
    throw new Error('形式がちがいます');
  const profiles = {};
  Object.values(raw.profiles).slice(0, 50).forEach(r => { const p = cleanProfile(r); profiles[p.id] = p; });
  const ids = Object.keys(profiles);
  if (!ids.length) throw new Error('中身が空です');
  const selfId = profiles[raw.selfId] ? raw.selfId : ids[0];
  return { v: 1,
    theme: pick1(raw.theme, Object.keys(THEMES), 'sepia'),
    dark: pick1(raw.dark, ['auto', 'on', 'off'], 'auto'),
    mode: pick1(raw.mode, ['self', 'coach'], 'self'),
    activeId: profiles[raw.activeId] ? raw.activeId : selfId,
    installClosed: raw.installClosed === true,
    selfId, profiles };
}
const P = () => S.profiles[S.activeId] || S.profiles[S.selfId];

/* ========== テーマ ========== */
function applyTheme() {
  const t = THEMES[S.theme] || THEMES.sepia;
  const r = document.documentElement;
  r.style.setProperty('--acc', t.a);
  r.style.setProperty('--acc2', t.b);
  r.dataset.dark = S.dark;
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = isDark() ? '#1B1A18' : '#F4EFE6';
}
const isDark = () => S.dark === 'on' ||
  (S.dark === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);

/* ========== 採点（4段階 → 0〜100%） =====
   答えた問題の平均で出す。必須10問だけでも、追加8問まで答えても、
   同じものさしで比べられるようにするため。 */
function avgBy(list, prefix, ans) {
  const acc = {};
  list.forEach(([c], i) => {
    const v = ans[prefix + i];
    if (typeof v === 'number') { acc[c] = acc[c] || { s: 0, n: 0 }; acc[c].s += v; acc[c].n++; }
  });
  return acc;
}
function toPct(acc, keys) {
  const r = {};
  keys.forEach(k => {
    const v = acc[k] ? acc[k].s / acc[k].n : 2.5;   // 未回答はまんなか
    r[k] = Math.round((v - 1) / 3 * 100);
  });
  return r;
}
function scoreAll(a) {
  /* どっち寄りの回答から、両側の持ち味に点をつける。
     Aを4で選べばBは1。つまり1問で2種ぶんの答えになる。 */
  const acc = {};
  Q_PAIR.forEach(([pair], i) => {
    const v = a['p' + i];
    if (typeof v !== 'number') return;
    const put = (k, val) => { acc[k] = acc[k] || { s: 0, n: 0 }; acc[k].s += val; acc[k].n++; };
    put(pair[0], v); put(pair[1], 5 - v);
  });
  const tp = toPct(acc, Object.keys(TRAITS));

  /* 進みグセは「選ばれた回数」。使うのはいちばん近い1つだけ */
  const hit = {};
  Q_STYLE_PICK.forEach((q, i) => { const c = a['y' + i]; if (c && STYLES[c]) hit[c] = (hit[c] || 0) + 1; });
  const max = Math.max(1, ...Object.values(hit));
  const sp = {};
  Object.keys(STYLES).forEach(k => { sp[k] = Math.round((hit[k] || 0) / max * 100); });

  /* 絶対値で比べると「全部そう」と答えた人が毎回同じ道になってしまうので、
     本人の平均からの差（＝その人の中での相対的な高さ）で判定する */
  const vals = Object.values(tp);
  const mean = vals.reduce((x, y) => x + y, 0) / vals.length;
  const scored = Object.keys(TYPES).map(code => {
    const w = TYPES[code].w; let s = 0, tot = 0;
    for (const k in w) { s += ((tp[k] || 0) - mean) * w[k]; tot += w[k]; }
    return { code, s: s / tot };
  }).sort((x, y) => y.s - x.s);
  /* ほぼ同点のときは、その人のいちばん高い持ち味を使う道を選ぶ */
  const top1 = Object.entries(tp).sort((x, y) => y[1] - x[1])[0][0];
  const near = scored.filter(x => scored[0].s - x.s < 0.5);
  /* ほぼ全部同じ回答だった場合は判定材料がないので、いちばん始めやすい「伝える道」にする */
  const flat = scored[0].s < 0.5;
  const best = flat ? 'content' : (near.find(x => TYPES[x.code].w[top1]) || scored[0]).code;
  return { traits: tp, styles: sp, type: best, date: today() };
}
const rank = o => Object.entries(o).sort((x, y) => y[1] - x[1]);

/* ===== 適性チェックの判定 =====
   気持ち（why + keep）と 余力（time + give）を別々に見る。
   合計点ひとつで切ると「やる気はあるが時間がない人」を弾いてしまうため。 */
function scoreGate(a) {
  const acc = avgBy(Q_GATE, 'g', a);
  const ax = k => (acc[k] ? acc[k].s / acc[k].n : 2.5) * 2;   // 各軸 2〜8
  const motive = ax('why') + ax('keep');           // 4〜16
  const room   = ax('time') + ax('give');          // 4〜16
  let tier = 'other';
  if (motive >= 11 && room >= 11) tier = 'ready';
  else if (motive >= 11) tier = 'time';
  return { motive: Math.round(motive), room: Math.round(room), tier, date: today() };
}

/* ===== 副業カタログとのマッチング =====
   持ち味の絶対値ではなく、本人の平均からの差で重みづけする */
function matchJobs(traits, n) {
  const vals = Object.values(traits);
  const mean = vals.reduce((x, y) => x + y, 0) / vals.length;
  return JOBS.map(j => {
    let s = 0, tot = 0;
    for (const k in j.w) { s += ((traits[k] || 0) - mean) * j.w[k]; tot += j.w[k]; }
    return { job: j, s: s / tot };
  }).sort((x, y) => y.s - x.s).slice(0, n || JOBS.length);
}

/* ========== やること（9つ） ========== */
function buildSteps(type) {
  const ts = TYPE_STEPS[type] || {};
  return CHAPTERS.map(ch => ({ id: ch.id,
    items: [COMMON_STEPS[ch.id], ...(ts[ch.id] || [])]
      .map(x => ({ id: uid(), text: x, done: false, at: null })) }));
}
/* 道が変わったときに、終わったやることだけ引き継いで作り直す */
function carrySteps(oldSteps, type) {
  const next = buildSteps(type);
  if (!oldSteps) return next;
  const done = new Set();
  oldSteps.forEach(c => c.items.forEach(x => { if (x.done) done.add(x.text); }));
  next.forEach(c => c.items.forEach(x => { if (done.has(x.text)) { x.done = true; x.at = today(); } }));
  return next;
}

function flat(p) {
  if (!p.steps) return [];
  const o = []; p.steps.forEach((c, i) => c.items.forEach(x => o.push({ ...x, ci: i })));
  return o;
}
const nextStep = p => flat(p).find(x => !x.done) || null;
const doneCount = p => flat(p).filter(x => x.done).length;
const totalCount = p => flat(p).length;
/* ※「連続」は休むと0に戻って気が重いので、減らない累計だけを見せる */
const timesMoved = p => p.logs.length;

/* ========== ルーティング ========== */
let view = 'home', quizMood = 'normal', showAll = false, aiSel = 'first';

function go(v) { view = v; showAll = false; window.scrollTo(0, 0); render(); }

function render() {
  applyTheme();
  const p = P();
  const map = { home: vHome, gate: vGate, gateResult: vGateResult, other: vOther, reality: vReality, report: vReport,
                quiz: vQuiz, clues: vClues, jobs: vJobs, book: vBook,
                buddy: vBuddy, settings: vSettings, people: vPeople };
  $('#view').innerHTML = (map[view] || vHome)(p);
  $('#nav').innerHTML = navHtml();
  $('#topbar').innerHTML = topHtml(p);
  bind(p); save();
}

function topHtml(p) {
  return `<button class="brand" data-nav="home">
      <span class="bmark">${catSVG(30)}</span>
      <span class="btxt">StrengthPath<em>${S.mode === 'coach' ? esc(p.name) : '持ち味から、次の1つを'}</em></span>
    </button>
    <button class="icobtn" data-nav="settings" aria-label="設定">⚙</button>`;
}
function navHtml() {
  /* 結果が出るまでは、中身のあるタブだけ出す。
     押しても何も無いタブが並んでいると、選ぶ手間だけが増えるため。 */
  const items = P().result
    ? [['home', '🏠', 'ホーム'], ['clues', '✨', 'もちあじ'],
       ['jobs', '🧰', 'しごと'], ['book', '📓', 'きろく'], ['buddy', '💬', 'そうだん']]
    : [['home', '🏠', 'ホーム'], ['jobs', '🧰', 'しごと']];
  if (S.mode === 'coach') items.push(['people', '👥', 'みんな']);
  return items.map(([v, i, l]) =>
    `<button class="nav-btn${view === v ? ' on' : ''}" data-nav="${v}"><span>${i}</span>${l}</button>`).join('');
}

/* ふきだし */
function say(text, mood, size) {
  return `<div class="says">${akariTag(mood || 'normal', size || 62)}
    <div class="bubble">${esc(text)}</div></div>`;
}

/* ========== ホーム ========== */
function vHome(p) {
  if (!p.result) return vWelcome(p);
  const ns = nextStep(p), ch = ns ? CHAPTERS[ns.ci] : null;
  const t = TYPES[p.result.type];
  const style = STYLES[rank(p.result.styles)[0][0]];
  const didToday = p.logs.some(l => l.date === today());

  return `${say(didToday ? '今日はもう動きましたね。ゆっくりしてください。' : pick(VOICE.greetBack), didToday ? 'happy' : 'normal')}
    ${ns ? `<div class="big-card">
        <div class="mini">${esc(ch.no)}・${esc(ch.title)}　${doneCount(p) + 1}/${totalCount(p)}</div>
        <h2 class="stepline">${esc(ns.text)}</h2>
        <button class="btn xl" data-fin="${ns.id}">やった！</button>
        <button class="btn link" data-tiny="1">気が乗らない日は、こっち</button>
      </div>`
      : `<div class="big-card">${akariTag('surprised', 84)}<h2 class="stepline">${esc(VOICE.noStep)}</h2>
        <button class="btn xl" data-again="1">つぎの9つをつくる</button></div>`}

    <div class="grid2">
      <button class="tile" data-nav="clues"><em>${t.emoji}</em><b>${esc(t.name)}</b><span>あなたに向いてる道</span></button>
      <button class="tile" data-nav="report"><em>📣</em><b>報告する</b><span>できたことを送る</span></button>
      <button class="tile" data-nav="jobs"><em>🧰</em><b>${esc(matchJobs(p.result.traits, 1)[0].job.name)}</b><span>相性のいい副業</span></button>
    </div>
    <div class="soft">
      <div class="mini">${style.emoji} ${esc(style.name)}のあなたへ</div>
      <p>${esc(style.line)}</p>
    </div>`;
}

function vWelcome() {
  return `<div class="welcome">
      ${akariTag('normal', 128)}
      <div class="hi">${esc(VOICE.greetFirst)}</div>
      <h1>集めるのが好きなあなたへ。<br><b>もう、材料はそろっています。</b></h1>
      <p>本もセミナーも、集めてきたものは全部むだになりません。
      あとは<b>どこから手をつけるか</b>だけ。
      まず<b>いまの状況を${GATE_CORE}問</b>だけ聞いて、そのうえで持ち味を見ていきます。</p>
      <button class="btn xl" data-nav="gate">はじめる</button>
      <button class="btn link" data-nav="jobs">こたえずに、副業20コだけ見てみる</button>
      <ul class="easy">
        <li>ぜんぶで${CORE_COUNT}問。1問3秒、指1本でOK</li>
        <li>途中でやめても、続きから始められます</li>
        <li>結果はこの端末の中だけ。登録もいりません</li>
      </ul>
    </div>`;
}

/* ========== しつもん ==========
   必須10問（適性3 + どっち寄り6 + 進みグセ1）で結果が出る。
   追加8問は「もっと正確にする」を選んだ人だけ。 */
const QALL = (extra) => {
  const half = Q_PAIR.length / 2;
  const pr = extra ? Q_PAIR.slice(half).map((_, i) => i + half) : Q_PAIR.map((_, i) => i).slice(0, half);
  const st = extra ? [1] : [0];
  return [
    ...pr.map(i => ({ type: 'pair', k: 'p' + i, q: Q_PAIR[i] })),
    ...st.filter(i => Q_STYLE_PICK[i]).map(i => ({ type: 'pick', k: 'y' + i, q: Q_STYLE_PICK[i] }))
  ];
};
const gateList = (extra) => (extra ? Q_GATE.slice(GATE_CORE).map((_, i) => i + GATE_CORE)
                                   : Q_GATE.map((_, i) => i).slice(0, GATE_CORE));
const CORE_COUNT = QALL(false).length + GATE_CORE;      // 10
const EXTRA_COUNT = QALL(true).length + (Q_GATE.length - GATE_CORE);  // 8

function vQuiz(p) {
  if (!p.quiz) p.quiz = { i: 0, a: {}, extra: false };
  const extra = !!p.quiz.extra;
  const qs = QALL(extra), item = qs[p.quiz.i];
  if (p.quiz.i >= qs.length) {
    p.answers = Object.assign({}, p.answers || {}, p.quiz.a);
    const before = p.result && p.result.type;
    p.result = scoreAll(p.answers);
    p.depth = extra ? 'full' : 'core';
    if (!p.steps || before !== p.result.type) p.steps = carrySteps(p.steps, p.result.type);
    p.quiz = null; save();
    setTimeout(() => go('clues'), 420);
    return `<div class="welcome">${akariTag('happy', 128)}<div class="hi">${esc(extra ? '……はっきりしました。' : VOICE.quizEnd)}</div></div>`;
  }
  /* 適性チェックのぶんを足して、通しの進み具合として見せる */
  const done = (extra ? 0 : GATE_CORE) + p.quiz.i;
  const total = extra ? EXTRA_COUNT : CORE_COUNT;
  const left = total - done;

  const body = item.type === 'pair' ? pairBody(item) : pickBody(item);
  return `<div class="quiz">
      <div class="qtop">
        <div class="bar"><i style="width:${done / total * 100}%"></i></div>
        <span class="mini">あと${left}問</span>
      </div>
      ${p.quiz.i === 0 ? say(extra ? 'もう少しだけ。同じことを、別の言い方で聞きます。' : VOICE.quizStart, 'normal', 48) : ''}
      ${body}
      <div class="qfoot">
        ${p.quiz.i > 0 ? '<button class="btn link" data-back="1">← ひとつ戻る</button>' : '<span></span>'}
        <button class="btn link" data-pause="1">今日はここまで</button>
      </div>
    </div>`;
}

/* どっちが近い？ A/Bのラベルを使わず、選択肢そのものを文にして縦に並べる。
   読んで押すだけで済み、上下どちらの文の話かを覚えておく必要がない。 */
function pairBody(item) {
  return `<h2 class="qtext">近いのは、どっちですか</h2>
    <div class="scale">
      ${pairOptions(item.q).map(o =>
        `<button class="sc" data-pair="${o.v}">${esc(o.label)}</button>`).join('')}
    </div>`;
}

/* 5つから近いものを1つ選ぶ */
function pickBody(item) {
  return `<h2 class="qtext">${esc(item.q.ask)}</h2>
    <div class="scale">
      ${item.q.opts.map(([code, label]) =>
        `<button class="sc" data-style="${code}">${esc(label)}</button>`).join('')}
    </div>`;
}

/* ========== もちあじ（結果） ========== */
function vClues(p) {
  if (!p.result) return notyet('こたえると、ここにあなたの持ち味が出ます。');
  const r = p.result, t = TYPES[r.type];
  const top = rank(r.traits).slice(0, 5);
  const style = STYLES[rank(r.styles)[0][0]];
  return `${say(VOICE.resultTop, 'happy')}
    <div class="big-card way">
      <div class="mini">向いてる道</div>
      <h2><span class="wemoji">${t.emoji}</span>${esc(t.name)}<em>${esc(t.sub)}</em></h2>
      <p class="catch">${esc(t.catch)}</p>
      <p>${esc(t.desc)}</p>
      <div class="chips">${t.examples.map(x => `<span class="chip">${esc(x)}</span>`).join('')}</div>
      <div class="rx"><b>はじめの1円</b>${esc(t.money)}</div>
    </div>

    <h3 class="sec">あなたの持ち味 5つ</h3>
    ${top.map(([c, v], i) => {
      const tr = TRAITS[c];
      return `<details class="trait"${i === 0 ? ' open' : ''}>
        <summary><span class="rk">${i + 1}</span>
          <span class="tname">${esc(tr.name)}<em>${esc(tr.catch)}</em></span>
          <span class="meter"><i style="width:${v}%"></i></span></summary>
        <div class="tbody">
          <p>${esc(tr.strong)}</p>
          <p class="scene">効くところ：${esc(tr.scene)}</p>
          <p class="lev">💡 ${esc(tr.easy)}</p>
        </div></details>`;
    }).join('')}

    <h3 class="sec">あなたの進みグセ</h3>
    <div class="big-card style">
      <h2><span class="wemoji">${style.emoji}</span>${esc(style.name)}<em>${esc(style.catch)}</em></h2>
      <p>${esc(style.good)}</p>
      <div class="rx"><b>ラクに進むコツ</b>${esc(style.tip)}</div>
    </div>

    <h3 class="sec">あなたに近い副業</h3>
    ${matchJobs(r.traits, 3).map(({ job }) => `<button class="jobmini" data-nav="jobs">
      <span class="jc">${JOB_CATS[job.cat].emoji}</span>
      <span class="jn"><b>${esc(job.name)}</b><em>${esc(job.what)}</em></span></button>`).join('')}
    <button class="btn ghost wide" data-nav="jobs">20コぜんぶ見る</button>

    <button class="btn xl" data-nav="book">やることを見る</button>
    <button class="btn link wide" data-nav="reality">先に、正直なところを読んでおく</button>
    ${installCard()}
    ${p.depth === 'full' ? '' : `<div class="soft deepen">
      <div class="mini">もっと正確にしたい人だけ</div>
      <p>いまの結果は${CORE_COUNT}問ぶんです。あと${EXTRA_COUNT}問（1分）答えると、
      持ち味の順番と合う副業がはっきりします。<b>やらなくても、このまま進めます。</b></p>
      <button class="btn ghost" data-deepen="1">あと${EXTRA_COUNT}問だけ答える</button>
    </div>`}
    <button class="btn link wide" data-retake="1">もう一度やってみる</button>
    <button class="btn link wide" data-regate="1">いまの状況を聞き直す</button>`;
}
const notyet = (what) => `<div class="welcome">${akariTag('normal', 110)}
    <div class="hi">${esc(what || 'ここには、あなたに合わせた内容が出ます。')}</div>
    <button class="btn xl" data-nav="gate">${CORE_COUNT}問こたえる（1分）</button>
    <button class="btn link" data-nav="jobs">先に、副業だけ見てみる</button></div>`;


/* ========== 適性チェック ========== */
function vGate(p) {
  if (!p.gateQuiz) p.gateQuiz = { i: 0, a: {} };
  const list = gateList(false);
  const q = Q_GATE[list[p.gateQuiz.i]];
  if (p.gateQuiz.i >= list.length) {
    p.gate = scoreGate(p.gateQuiz.a);
    p.gateQuiz = null; save();
    setTimeout(() => go('gateResult'), 380);
    return `<div class="welcome">${akariTag('think', 120)}<div class="hi">……なるほど。</div></div>`;
  }
  const left = CORE_COUNT - p.gateQuiz.i;
  return `<div class="quiz">
      <div class="qtop">
        <div class="bar"><i style="width:${p.gateQuiz.i / CORE_COUNT * 100}%"></i></div>
        <span class="mini">あと${left}問</span>
      </div>
      ${p.gateQuiz.i === 0 ? say('まず、いまの状況だけ教えてください。正直なところで大丈夫です。', 'normal', 48) : ''}
      <h2 class="qtext">${esc(q[1])}</h2>
      <div class="scale">
        ${SCALE.map(s => `<button class="sc" data-gans="${s.v}">${esc(s.label)}</button>`).join('')}
      </div>
      <div class="qfoot">
        ${p.gateQuiz.i > 0 ? '<button class="btn link" data-gback="1">← ひとつ戻る</button>' : '<span></span>'}
        <button class="btn link" data-nav="home">今日はここまで</button>
      </div>
    </div>`;
}

/* ========== 適性チェックの結果 ========== */
function vGateResult(p) {
  if (!p.gate) return notyet();
  const g = GATES[p.gate.tier];
  return `<div class="big-card gate">
      ${akariTag(g.mood, 96)}
      <div class="mini">いまの状況</div>
      <h2>${esc(g.title)}</h2>
      <p class="catch">${esc(g.lead)}</p>
      <p>${esc(g.body)}</p>
      ${g.tips ? `<ul class="tips">${g.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      <div class="gauge">
        <div><span>気持ち</span><b class="track"><i style="width:${Math.round((p.gate.motive - 4) / 12 * 100)}%"></i></b></div>
        <div><span>いまの余力</span><b class="track"><i style="width:${Math.round((p.gate.room - 4) / 12 * 100)}%"></i></b></div>
      </div>
      ${p.gate.tier === 'other'
        ? `<button class="btn xl" data-nav="other">時間を使わない方法を見る</button>
           <button class="btn link" data-nav="quiz">${esc(g.cta)}</button>`
        : `<button class="btn xl" data-nav="quiz">${esc(g.cta)}</button>
           <button class="btn link" data-nav="other">先に、時間を使わない方法も見ておく</button>`}
    </div>`;
}

/* ========== 副業以外の道 ========== */
function vOther(p) {
  return `${say('急がなくて大丈夫です。増やし方は、ひとつではありません。', 'normal')}
    <div class="big-card">
      <div class="mini">時間をほとんど使わない方法</div>
      <h2>いまの生活を削らずに、できること</h2>
      <p>副業は時間を使います。先にこちらを片づけたほうが、結果が早いことは珍しくありません。</p>
    </div>
    ${OTHER_WAYS.map(w => `<div class="soft way-card">
      <h3><span class="wemoji">${w.emoji}</span>${esc(w.title)}</h3>
      <p>${esc(w.body)}</p>
      <div class="rx"><b>今日15分でできること</b>${esc(w.step)}</div>
    </div>`).join('')}
    <div class="soft">
      <div class="mini">くわしく知るなら</div>
      <p>${esc(LEARN_LINK.note)}</p>
      <button class="btn ghost" data-ext="${esc(LEARN_LINK.url)}">${esc(LEARN_LINK.label)} を開く</button>
      <p class="fine">${esc(MONEY_NOTE)}</p>
    </div>
    <div class="soft">
      <p class="dim">気が変わったら、いつでも戻ってきてください。副業のほうも、いつでも見られます。</p>
      <button class="btn" data-nav="${p.result ? 'clues' : 'quiz'}">${p.result ? 'もちあじを見る' : '持ち味を見てみる'}</button>
    </div>`;
}

/* ========== 先に、正直なところを ==========
   甘い期待のまま始めると、思っていたのと違うところで折れる。
   数字を見せて目盛りを合わせ、そのうえで「だからこうする」まで必ず言う。 */
function vReality(p) {
  const R = REALITY;
  return `${say('先に、しんどいところも見ておきましょう。知っておくと折れにくいです。', 'normal')}
    <div class="big-card">
      <div class="mini">${esc(R.title)}</div>
      <h2>副業は、思ったほど早くは伸びません</h2>
      <p>${esc(R.lead)}</p>
    </div>

    <div class="facts">
      ${R.facts.map(f => `<div class="fact">
        <b>${esc(f.n)}</b><span class="fl">${esc(f.label)}</span>
        <p>${esc(f.note)}</p></div>`).join('')}
    </div>

    <div class="soft">
      <div class="mini">${esc(R.quits.title)}</div>
      <ul class="quits">${R.quits.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <p class="dim">${esc(R.quits.note)}</p>
    </div>

    <h3 class="sec">${esc(R.keeps.title)}</h3>
    ${R.keeps.items.map(k => `<div class="soft keep">
      <h3>${esc(k.t)}</h3><p>${esc(k.d)}</p></div>`).join('')}

    <p class="fine">出典：${esc(R.source)}</p>
    <button class="btn xl" data-nav="${p.result ? 'book' : 'gate'}">${p.result ? 'やることに戻る' : 'はじめる'}</button>`;
}

/* ========== しごと（副業カタログ） ========== */
let jobCat = 'all', jobOpen = null;
function vJobs(p) {
  const matched = p.result ? matchJobs(p.result.traits) : null;
  const list = (matched ? matched.map(m => m.job) : JOBS)
    .filter(j => jobCat === 'all' || j.cat === jobCat);
  const topIds = matched ? matched.slice(0, 3).map(m => m.job.id) : [];
  return `${p.result
      ? say('あなたの持ち味に近い順に並べました。上の3つは特に相性がいいです。', 'happy')
      : say('20コあります。気になるものを開いて読むだけでも大丈夫です。', 'normal')}
    ${p.result ? '' : `<div class="soft nudge">
      <p>${CORE_COUNT}問こたえると、<b>この20コがあなたに近い順に並びかえられます。</b>
      合う3つには印がつきます。</p>
      <button class="btn ghost" data-nav="gate">${CORE_COUNT}問こたえる（1分）</button>
    </div>`}
    <div class="cats">
      <button class="cat${jobCat === 'all' ? ' on' : ''}" data-jcat="all">ぜんぶ</button>
      ${Object.entries(JOB_CATS).map(([k, c]) =>
        `<button class="cat${jobCat === k ? ' on' : ''}" data-jcat="${k}">${c.emoji} ${esc(c.name)}</button>`).join('')}
    </div>
    ${list.map(j => {
      const open = jobOpen === j.id;
      const hit = topIds.includes(j.id);
      return `<div class="job${hit ? ' hit' : ''}${open ? ' open' : ''}">
        <button class="job-h" data-job="${j.id}">
          ${hit ? '<span class="badge">相性◎</span>' : ''}
          <span class="jc">${JOB_CATS[j.cat].emoji}</span>
          <span class="jn"><b>${esc(j.name)}</b><em>${esc(j.what)}</em></span>
          <span class="jx">${open ? '−' : '＋'}</span>
        </button>
        ${open ? `<div class="job-b">
          <div class="howto">
            <div class="howto-h">最初の一歩</div>
            <ol>${j.steps.map(([t, d]) => `<li><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
          </div>

          <div class="yen">
            <div class="yen-h">お金のこと</div>
            <dl>
              <dt>いくらになる</dt><dd>${esc(j.unit)}</dd>
              <dt>最初の1円まで</dt><dd>${esc(j.firstYen)}</dd>
              <dt>月5万円にするなら</dt><dd>${esc(j.to5)}</dd>
              <dt>はじめる費用</dt><dd>${esc(j.cost)}</dd>
              <dt>売る場所</dt><dd>${esc(j.where)}</dd>
            </dl>
          </div>

          <p class="jrow"><b>いるもの</b>${esc(j.need)}</p>
          <p class="jrow"><b>AIの使いどころ</b>${esc(j.ai)}</p>
          <p class="jrow real"><b>正直なところ</b>${esc(j.real)}</p>
          <p class="jrow"><b>効く持ち味</b>${Object.keys(j.w).map(k => TRAITS[k].name).join('・')}</p>
        </div>` : ''}
      </div>`;
    }).join('')}
    <p class="fine">${esc(YEN_NOTE)}<br>
    分類の枠組みはリベラルアーツ大学「おすすめの副業19選」を参考にしています。解説文と持ち味との対応づけは本ツールの独自作成です。</p>`;
}

/* ========== 手帳 ========== */
function vBook(p) {
  if (!p.result) return notyet('動いた記録が、ここに増えていきます。');
  const ns = nextStep(p), ch = ns ? CHAPTERS[ns.ci] : null;
  return `<div class="big-card">
      <div class="mini">${ns ? esc(ch.no) + '・' + esc(ch.title) : 'ぜんぶ終わりました'}　${doneCount(p)}/${totalCount(p)}</div>
      ${ns ? `<h2 class="stepline">${esc(ns.text)}</h2>
        <button class="btn xl" data-fin="${ns.id}">やった！</button>
        <button class="btn link" data-tiny="1">気が乗らない日は、こっち</button>`
        : `<h2 class="stepline">${esc(VOICE.noStep)}</h2>
           <button class="btn xl" data-again="1">つぎの9つをつくる</button>`}
    </div>

    <button class="btn link wide" data-all="1">${showAll ? '閉じる' : 'ぜんぶ見る'}</button>
    <button class="btn link wide" data-nav="reality">思ったより進まないと感じたら</button>
    ${showAll ? p.steps.map((c, i) => {
      const ci = CHAPTERS[i];
      return `<div class="soft">
        <div class="mini">${esc(ci.no)}・${esc(ci.title)} — ${esc(ci.goal)}</div>
        <ul class="steps">${c.items.map(x => `<li class="${x.done ? 'done' : ''}">
          <label><input type="checkbox" data-step="${x.id}"${x.done ? ' checked' : ''}><span>${esc(x.text)}</span></label>
          ${x.at ? `<em>${fmtDate(x.at)}</em>` : ''}</li>`).join('')}</ul>
      </div>`;
    }).join('') : ''}

    ${p.goal.reward ? `<div class="soft reward">
      <div class="mini">ごほうび</div>
      <p><b>${esc(p.goal.reward)}</b></p>
      <p class="dim">${totalCount(p) - doneCount(p) > 0
        ? `あと${totalCount(p) - doneCount(p)}つで、ここまで来ます。`
        : 'ぜんぶ終わりました。受け取ってください。'}</p>
    </div>` : ''}

    <button class="btn ghost wide" data-nav="report">できたことを報告する</button>

    <h3 class="sec">これまで ${timesMoved(p)}回</h3>
    <div class="soft">
      ${p.logs.length ? `<ul class="loglist">${p.logs.slice().reverse().slice(0, 40).map(l =>
        `<li><span class="ld">${fmtDate(l.date)}</span><span class="lt">${l.kind ? (REPORT_KINDS.find(k => k.id === l.kind) || {}).emoji + ' ' : ''}${esc(l.text)}</span></li>`).join('')}</ul>`
        : '<p class="dim">まだ真っ白です。1つ動いたら、ここに増えていきます。</p>'}
    </div>`;
}

/* ========== 報告する ==========
   ひとりで続けるのがいちばん折れやすい。
   できたことを人に見せられる形にして、外で応援をもらえるようにする。 */
let reportKind = 'did';
function vReport(p) {
  if (!p.result) return notyet('動いた記録が、ここに増えていきます。');
  const recent = p.logs.slice().reverse().slice(0, 5);
  return `${say('できたことを、そのまま出しちゃいましょう。小さくて大丈夫です。', 'happy')}
    <div class="big-card">
      <div class="mini">今日はどれでしたか</div>
      <div class="kinds">
        ${REPORT_KINDS.map(k => `<button class="kind${reportKind === k.id ? ' on' : ''}" data-kind="${k.id}">
          <em>${k.emoji}</em><b>${esc(k.label)}</b><span>${esc(k.hint)}</span></button>`).join('')}
      </div>
      <textarea id="rtext" rows="3" maxlength="200"
        placeholder="${esc((REPORT_KINDS.find(k => k.id === reportKind) || {}).hint || '')}"></textarea>
      <button class="btn xl" data-report="1">記録して、カードを作る</button>
      <p class="note">記録はこの端末に残ります。カードは送ったときだけ相手に見えます。</p>
    </div>
    ${recent.length ? `<div class="soft">
      <div class="mini">最近の報告</div>
      <ul class="loglist">${recent.map(l => `<li>
        <span class="ld">${fmtDate(l.date)}</span>
        <span class="lt">${l.kind ? (REPORT_KINDS.find(k => k.id === l.kind) || {}).emoji + ' ' : ''}${esc(l.text)}</span>
        <button class="reshare" data-reshare="${esc(l.date)}|${esc(l.text)}|${esc(l.kind || 'did')}">送る</button>
      </li>`).join('')}</ul>
    </div>` : ''}`;
}

/* 送れるカードの文面を組み立てる。画像ではなく文字にして、どのアプリにも貼れるようにする */
function shareText(p, kind, text) {
  const k = REPORT_KINDS.find(x => x.id === kind) || REPORT_KINDS[0];
  const w = pick(REPORT_WORDS[kind] || REPORT_WORDS.did);
  const t = p.result ? TYPES[p.result.type] : null;
  const done = p.steps ? `${doneCount(p)}/${totalCount(p)}` : '';
  return [
    `${k.emoji} ${k.label}`,
    text ? `「${text}」` : '',
    '',
    w,
    '',
    t ? `わたしの道：${t.name}（${t.sub}）` : '',
    done ? `やること：${done}　これまで動いた回数：${timesMoved(p)}回` : '',
    '',
    '— StrengthPath'
  ].filter(x => x !== null).join('\n').replace(/\n{3,}/g, '\n\n');
}

function openShare(p, kind, text) {
  const body = shareText(p, kind, text);
  const el = document.createElement('div');
  el.className = 'sheet-wrap'; el.id = 'sheet';
  el.innerHTML = `<div class="sheet share">
    ${akariTag('happy', 64)}
    <div class="mini">送れるカードができました</div>
    <pre class="card">${esc(body)}</pre>
    <button class="btn xl" id="share-send">送る</button>
    <button class="btn ghost" id="share-copy">文字をコピー</button>
    <p class="note">${esc(SHARE_NOTE)}</p>
    <button class="btn link" id="sheet-no">閉じる</button>
  </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  $('#share-send').onclick = async () => {
    if (navigator.share) {
      try { await navigator.share({ text: body }); } catch (_) {}
    } else {
      await copyText(body);
      toast('コピーしました。貼って送ってください。', 'wink');
    }
  };
  $('#share-copy').onclick = async e => {
    await copyText(body);
    e.currentTarget.textContent = '✅ コピーしました';
    setTimeout(() => { e.currentTarget.textContent = '文字をコピー'; }, 1600);
  };
  $('#sheet-no').onclick = closeSheet;
  el.onclick = e => { if (e.target === el) closeSheet(); };
}

async function copyText(s) {
  try { await navigator.clipboard.writeText(s); }
  catch (_) {
    const ta = document.createElement('textarea');
    ta.value = s; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
  }
}

/* ========== そうだん（AI） ========== */
function vBuddy(p) {
  if (!p.result) return notyet('結果が出ると、AIに相談する文章をここで作れます。');
  const list = PROMPTS.filter(x => S.mode === 'coach' || x.id !== 'coach');
  return `${say('話してみましょうか。私の見立ても、そのまま渡しますね。', 'normal')}
    <div class="soft">
      <p class="dim">選ぶと、あなたの結果と進み具合を全部入れた文章ができます。
      コピーして ChatGPT や Claude に貼るだけです。</p>
      <div class="prompts">
        ${list.map(x => `<button class="pbtn${aiSel === x.id ? ' on' : ''}" data-ai="${x.id}">
          <em>${x.emoji}</em><b>${esc(x.name)}</b><span>${esc(x.desc)}</span></button>`).join('')}
      </div>
    </div>
    <div class="soft">
      <textarea id="ptext" rows="12" readonly>${esc(makePrompt(p, aiSel))}</textarea>
      <button class="btn xl" data-copy="1">📋 コピーする</button>
      <div class="row">
        <button class="btn ghost" data-open="claude">Claudeを開く</button>
        <button class="btn ghost" data-open="gpt">ChatGPTを開く</button>
      </div>
    </div>`;
}

function ctx(p) {
  const r = p.result, t = TYPES[r.type];
  const top = rank(r.traits).slice(0, 5).map(([c, v]) => `${TRAITS[c].name}(${v}%)`).join('、');
  const st = STYLES[rank(r.styles)[0][0]];
  const ns = nextStep(p);
  const recent = p.logs.slice(-6).map(l => `- ${l.date} ${l.text}`).join('\n') || '- まだなし';
  return `【この人のこと】
・呼び名：${p.name}
・向いてる道：${t.name}（${t.sub}）＝ ${t.catch}
・持ち味 上位5：${top}
・進みグセ：${st.name}（${st.catch}）→ ${st.tip}
・進み具合：9つ中 ${doneCount(p)}つ／これまで${timesMoved(p)}回動いた
・やる理由：${p.goal.why || '未記入'}
・ごほうび：${p.goal.reward || '未記入'}
・使える時間：${p.goal.hours || '未記入'}

【持ち味に近い副業（上位3つ）】
${matchJobs(r.traits, 3).map(m => '・' + m.job.name + '：' + m.job.what).join('\n')}

【いま目の前にあること】
${ns ? ns.text : '（ぜんぶ完了）'}

【最近の動き】
${recent}`;
}

function makePrompt(p, id) {
  const rule = `【あなたの役割】
あなたは、副業をはじめたい人の相談相手です。次のことを必ず守ってください。

1. 相手を絶対に否定しない。「できていない」「動けていない」「原因」といった言葉は使わない。
2. 新しいノウハウを増やさない。この人はもう十分に知っています。必要なのは、どれをやるか決めることだけです。
3. 一度に出す提案は1つだけ。しかも15分で終わるサイズまで小さくする。
4. まず質問して、相手に話させてから提案する。いきなり答えを並べない。
5. 持ち味を使うやり方で提案する。苦手なことを克服させようとしない。
6. 相手が「気が乗らない」と言ったら、責めずに、3分でできるサイズまで小さくして出し直す。
7. 落ち着いた、静かなトーンで話す。テンションを上げて煽らない。`;
  const base = `${rule}\n\n${ctx(p)}`;

  if (id === 'first') return `${base}

【今回してほしいこと】
はじめての相談です。1つずつ、私の返事を待ってから進めてください。
① 上の情報を読んで、私の持ち味がいちばん活きそうな形を1つ挙げて、それでいいか質問で確かめる
② 私の答えを聞いて、3ヶ月後にこうなっていたい姿を一文にまとめる
③ 今週やることを1つだけ、15分で終わるサイズにして提案する
④ それをやったと報告する場所を一緒に決める`;

  if (id === 'weekly') return `${base}

【今回してほしいこと】
一週間のふりかえりです。
① 最近の動きを見て、進んだところを具体的に1つ以上見つけて言葉にする
② できなかったことは責めず、「サイズが大きすぎただけ」という前提で一緒に見直す
③ 来週やることを1つ決める。先週やれなかったなら、半分の大きさにして出す
④ 最後に、来週の私に向けた短い一言を書く`;

  if (id === 'stuck') {
    const st = STYLES[rank(p.result.styles)[0][0]];
    return `${base}

【今の気分】
なんとなく気が乗りません。ちなみに私は「${st.name}（${st.catch}）」タイプだそうです。

【今回してほしいこと】
① 気が乗らないのは自然なことだと、まず一言だけ添えてください（長い励ましはいりません）
② 目の前のやることを、3分で終わるサイズまで小さくしてください
   ※調べる・考える・計画するのは無しで。「書く」「送る」「押す」など、手が動くものにしてください
③ それすら重い日のために、30秒でできる代わりの動きも1つ用意してください
④ どちらかをやったら、なんと報告すればいいか一文で書いてください`;
  }

  if (id === 'money') return `${base}

【今回してほしいこと】
はじめてお金を受け取るための準備です。
① 私の持ち味から、いちばん早く形になりそうな小さな商品を1つ提案する
② 値段は相場ではなく「私が気まずくない額」から決めたいので、質問しながら一緒に決める
③ 最初に声をかける相手を、私の身近な人から一緒に探す
④ その人に送る文面を、売り込みっぽくならない形で下書きする
⑤ いつ送るか、日付だけ決めさせる`;

  if (id === 'coach') return `あなたはコーチの補佐役です。次の相手との面談準備を手伝ってください。

${ctx(p)}

【これまでの面談】
${p.sessions.length ? p.sessions.map(s => `- ${s.date}：${s.note}${s.next ? '（次回：' + s.next + '）' : ''}`).join('\n') : '- 今回が初回'}

【作ってほしいもの】
① この人の見立てを3行で（持ち味・進みグセ・いま立っている場所）
② 今回の面談のゴール案を2つ
③ 60分の流れ（時間配分つき）
④ 最初に使う質問3つ／深掘りの質問5つ（すべて持ち味を引き出す方向で）
⑤ 最後に渡す宿題の候補を2つ（どちらも15分以内）
⑥ 話すときに気をつけたい点`;

  return base;
}

/* ========== みんな（コーチ） ========== */
function vPeople() {
  const list = Object.values(S.profiles);
  const p = P();
  return `<div class="soft">
      <div class="mini">伴走している人</div>
      <div class="people">
        ${list.map(x => `<div class="person${x.id === S.activeId ? ' on' : ''}" data-person="${x.id}">
          <span class="pav">${akariTag('normal', 38)}</span>
          <span class="pinfo"><b>${esc(x.name)}</b>
            <em>${x.result ? TYPES[x.result.type].name + '・' + doneCount(x) + '/' + totalCount(x) + '手' : 'まだ調べていません'}${x.id === S.selfId ? '・自分' : ''}</em></span>
          ${x.id === S.selfId ? '' : `<button class="del" data-del="${x.id}">消す</button>`}
        </div>`).join('')}
      </div>
      <div class="row"><input id="newname" maxlength="60" placeholder="名前"><button class="btn" data-addp="1">追加</button></div>
    </div>
    ${p.result ? `<div class="soft">
      <div class="mini">${esc(p.name)} の面談メモ</div>
      <ul class="loglist">${p.sessions.length ? p.sessions.slice().reverse().map(s =>
        `<li><span class="ld">${fmtDate(s.date)}</span><span class="lt">${esc(s.note)}${s.next ? `<em class="nx">→ ${esc(s.next)}</em>` : ''}</span></li>`).join('')
        : '<li class="dim">まだありません</li>'}</ul>
      <textarea id="snote" rows="3" maxlength="2000" placeholder="今回のメモ"></textarea>
      <input id="snext" maxlength="500" placeholder="次回までにやること">
      <button class="btn" data-addses="1">記録する</button>
    </div>` : ''}`;
}

/* ========== 設定 ========== */
function vSettings(p) {
  return `${installCard()}
    <h3 class="sec">いろ</h3>
    <div class="themes">
      ${Object.entries(THEMES).map(([k, t]) => `<button class="th${S.theme === k ? ' on' : ''}" data-theme="${k}">
        <span class="sw" style="background:linear-gradient(135deg,${t.a},${t.b})"></span>
        <b>${esc(t.name)}</b><em>${esc(t.hint)}</em></button>`).join('')}
    </div>
    <div class="segs">
      ${[['auto', '自動'], ['off', 'あかるい'], ['on', 'くらい']].map(([k, l]) =>
        `<button class="seg${S.dark === k ? ' on' : ''}" data-dark="${k}">${l}</button>`).join('')}
    </div>

    <h3 class="sec">あなたのこと</h3>
    <div class="soft">
      <label class="fl">呼び名<input id="gname" maxlength="60" value="${esc(p.name)}"></label>
      <label class="fl">やる理由（あとで思い出せるように）
        <textarea id="gwhy" rows="2" maxlength="500" placeholder="例：月5万あれば、家族と旅行に行ける">${esc(p.goal.why)}</textarea></label>
      <label class="fl">ごほうび<input id="greward" maxlength="200" value="${esc(p.goal.reward)}" placeholder="例：ぜんぶ終わったら好きなヘッドホンを買う"></label>
      <label class="fl">使えそうな時間<input id="ghours" maxlength="200" value="${esc(p.goal.hours)}" placeholder="例：夜に30分くらい"></label>
      <button class="btn" data-savegoal="1">しまう</button>
    </div>

    <h3 class="sec">つかいかた</h3>
    <div class="segs">
      ${[['self', 'ひとりで'], ['coach', '人を伴走する']].map(([k, l]) =>
        `<button class="seg${S.mode === k ? ' on' : ''}" data-mode="${k}">${l}</button>`).join('')}
    </div>

    <h3 class="sec">データ</h3>
    <div class="soft">
      <div class="row">
        <button class="btn ghost" data-export="1">書き出す</button>
        <button class="btn ghost" data-import="1">読み込む</button>
      </div>
      <p class="dim">この端末の中だけに保存されています。たまに書き出しておくと安心です。</p>
      <button class="btn link danger" data-reset="1">${esc(p.name)}のデータを消す</button>
    </div>
    <p class="fine">本ツールの持ち味・進みグセ・道の分類は、副業での動きやすさに絞った独自のものです。
    ストレングスファインダー®／CliftonStrengths®（Gallup社の登録商標）とは無関係で、同社の資質名・解説文は使用していません。</p>`;
}

/* ========== イベント ========== */
function bind(p) {
  const on = (s, e, f) => $$(s).forEach(el => el.addEventListener(e, f));

  on('[data-nav]', 'click', e => go(e.currentTarget.dataset.nav));

  on('[data-gans]', 'click', e => {
    p.gateQuiz.a['g' + gateList(false)[p.gateQuiz.i]] = +e.currentTarget.dataset.gans;
    p.gateQuiz.i++; save(); render();
  });
  on('[data-gback]', 'click', () => { p.gateQuiz.i = Math.max(0, p.gateQuiz.i - 1); render(); });
  on('[data-jcat]', 'click', e => { jobCat = e.currentTarget.dataset.jcat; jobOpen = null; render(); });
  on('[data-job]', 'click', e => {
    const id = e.currentTarget.dataset.job;
    jobOpen = jobOpen === id ? null : id; render();
  });
  on('[data-ext]', 'click', e => window.open(e.currentTarget.dataset.ext, '_blank', 'noopener'));
  on('[data-kind]', 'click', e => { reportKind = e.currentTarget.dataset.kind; render(); });
  on('[data-report]', 'click', () => {
    const txt = (($('#rtext') || {}).value || '').trim();
    p.logs.push({ date: today(), text: txt || (REPORT_KINDS.find(k => k.id === reportKind) || {}).label, kind: reportKind });
    save(); render();
    openShare(p, reportKind, txt);
  });
  on('[data-reshare]', 'click', e => {
    const [, text, kind] = e.currentTarget.dataset.reshare.split('|');
    openShare(p, kind, text);
  });
  on('[data-install]', 'click', async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const r = await installPrompt.userChoice.catch(() => null);
    installPrompt = null;
    if (r && r.outcome === 'accepted') toast(INSTALL.done, 'happy');
    render();
  });
  on('[data-noinstall]', 'click', () => { S.installClosed = true; render(); });

  const answerQuiz = val => {
    p.quiz.a[QALL(p.quiz.extra)[p.quiz.i].k] = val;
    p.quiz.i++; save(); render();
  };
  on('[data-pair]', 'click', e => answerQuiz(+e.currentTarget.dataset.pair));
  on('[data-style]', 'click', e => answerQuiz(e.currentTarget.dataset.style));
  on('[data-back]', 'click', () => { p.quiz.i = Math.max(0, p.quiz.i - 1); render(); });
  on('[data-pause]', 'click', () => { save(); go('home'); });
  on('[data-retake]', 'click', () => {
    if (!confirm('もう一度やってみますか？（記録はそのまま残ります）')) return;
    p.answers = null; p.depth = null; p.quiz = { i: 0, a: {}, extra: false }; go('quiz');
  });
  on('[data-deepen]', 'click', () => {
    p.answers = p.answers || {};
    p.quiz = { i: 0, a: {}, extra: true }; go('quiz');
  });
  on('[data-regate]', 'click', () => {
    if (!confirm('いまの状況を、もう一度聞きますか？')) return;
    p.gateQuiz = { i: 0, a: {} }; go('gate');
  });

  on('[data-fin]', 'click', e => {
    const id = e.currentTarget.dataset.fin;
    let txt = '';
    p.steps.forEach(c => c.items.forEach(x => {
      if (x.id === id) { x.done = true; x.at = today(); txt = x.text; }
    }));
    p.logs.push({ date: today(), text: txt, kind: 'did' });
    toast(pick(VOICE.doneStep), pick(['happy', 'wink']));
    render();
    openShare(p, 'did', txt);
  });
  on('[data-step]', 'change', e => {
    const id = e.currentTarget.dataset.step, ck = e.currentTarget.checked;
    p.steps.forEach(c => c.items.forEach(x => {
      if (x.id === id) { x.done = ck; x.at = ck ? today() : null;
        if (ck) p.logs.push({ date: today(), text: x.text }); }
    }));
    render();
  });
  on('[data-all]', 'click', () => { showAll = !showAll; render(); });
  on('[data-again]', 'click', () => {
    if (!confirm('つぎの9つをつくりますか？')) return;
    p.steps = buildSteps(p.result.type); go('book');
  });

  on('[data-tiny]', 'click', () => {
    const st = STYLES[rank(p.result.styles)[0][0]];
    openSheet(`${st.emoji} ${st.name}のあなたへ`, st.micro,
      'これならできそう', () => {
        p.logs.push({ date: today(), text: st.micro });
        closeSheet(); toast('ちゃんと動きました。', 'wink'); render();
      }, p.goal.why);
  });

  on('[data-ai]', 'click', e => { aiSel = e.currentTarget.dataset.ai; render(); });
  on('[data-copy]', 'click', async e => {
    const ta = $('#ptext');
    try { await navigator.clipboard.writeText(ta.value); }
    catch (_) { ta.removeAttribute('readonly'); ta.select(); document.execCommand('copy'); ta.setAttribute('readonly', ''); }
    e.currentTarget.textContent = '✅ コピーしました';
    setTimeout(() => { e.currentTarget.textContent = '📋 コピーする'; }, 1500);
  });
  on('[data-open]', 'click', e =>
    window.open(e.currentTarget.dataset.open === 'claude' ? 'https://claude.ai/new' : 'https://chatgpt.com/', '_blank', 'noopener'));

  on('[data-theme]', 'click', e => { S.theme = e.currentTarget.dataset.theme; render(); });
  on('[data-dark]', 'click', e => { S.dark = e.currentTarget.dataset.dark; render(); });
  on('[data-mode]', 'click', e => { S.mode = e.currentTarget.dataset.mode; render(); });

  on('[data-person]', 'click', e => { if (e.target.dataset.del) return; S.activeId = e.currentTarget.dataset.person; go('home'); });
  on('[data-del]', 'click', e => {
    e.stopPropagation(); const id = e.currentTarget.dataset.del;
    if (!confirm(`${S.profiles[id].name} のデータを消します。よろしいですか？`)) return;
    delete S.profiles[id]; if (S.activeId === id) S.activeId = S.selfId; render();
  });
  on('[data-addp]', 'click', () => {
    const n = ($('#newname').value || '').trim(); if (!n) return;
    const np = blankProfile(n); S.profiles[np.id] = np; S.activeId = np.id; go('home');
  });
  on('[data-addses]', 'click', () => {
    const note = ($('#snote').value || '').trim(); if (!note) return;
    p.sessions.push({ date: today(), note, next: ($('#snext').value || '').trim() }); render();
  });

  on('[data-savegoal]', 'click', () => {
    p.name = ($('#gname').value || 'あなた').trim();
    p.goal = { why: $('#gwhy').value, reward: $('#greward').value, hours: $('#ghours').value };
    save(); toast('しまいました。', 'happy'); render();
  });

  on('[data-export]', 'click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }));
    a.download = `StrengthPath_${today()}.json`; a.click(); URL.revokeObjectURL(a.href);
  });
  on('[data-import]', 'click', () => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'application/json';
    i.onchange = () => { const f = i.files[0]; if (!f) return; const r = new FileReader();
      r.onload = () => {
        let next;
        try { next = cleanStore(JSON.parse(r.result)); }
        catch (_) { alert('このファイルは読み込めませんでした。書き出したJSONを選んでください。'); return; }
        const n = Object.keys(next.profiles).length;
        if (!confirm(`${n}人分のデータで、いまの内容を置きかえます。よろしいですか？`)) return;
        S = next; save(); go('home'); toast('読み込みました。', 'happy');
      };
      r.readAsText(f); };
    i.click();
  });
  on('[data-reset]', 'click', () => {
    if (!confirm(`${p.name}の結果と記録をぜんぶ消します。よろしいですか？`)) return;
    const f = blankProfile(p.name); f.id = p.id; S.profiles[p.id] = f; go('home');
  });
}

/* ========== トースト / シート ========== */
function toast(text, mood) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `${akariTag(mood || 'happy', 40)}<span>${esc(text)}</span>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, 2200);
}
function openSheet(title, body, btn, fn, why) {
  const el = document.createElement('div');
  el.className = 'sheet-wrap'; el.id = 'sheet';
  el.innerHTML = `<div class="sheet">
    ${akariTag('idea', 72)}
    <div class="mini">${esc(title)}</div>
    <p class="sheet-body">${esc(body)}</p>
    ${why ? `<p class="sheet-why">はじめた理由：${esc(why)}</p>` : ''}
    <button class="btn xl" id="sheet-ok">${esc(btn)}</button>
    <button class="btn link" id="sheet-no">${esc(VOICE.skipDay)}</button>
  </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  $('#sheet-ok').onclick = fn;
  $('#sheet-no').onclick = closeSheet;
  el.onclick = e => { if (e.target === el) closeSheet(); };
}
function closeSheet() { const s = $('#sheet'); if (s) { s.classList.remove('in'); setTimeout(() => s.remove(), 250); } }

/* ========== ホーム画面に追加 ========== */
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let installPrompt = null;   /* Androidなどで拾える、OS側の追加ダイアログ */

/* 追加できる状態か。すでに入れている人と、断った人には出さない */
function canInstall() {
  if (isStandalone()) return false;
  if (S.installClosed) return false;
  return !!installPrompt || isIOS();
}

function installCard() {
  if (!canInstall()) return '';
  const ios = isIOS();
  return `<div class="soft install">
    <div class="mini">📱 ${esc(INSTALL.title)}</div>
    <p>${esc(INSTALL.lead)}</p>
    ${ios
      ? `<p class="dim">${esc(INSTALL.ios.lead)}</p>
         <ol class="steps-ios">${INSTALL.ios.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>`
      : `<p class="dim">${esc(INSTALL.other.lead)}</p>
         <button class="btn" data-install="1">${esc(INSTALL.other.cta)}</button>`}
    <button class="btn link" data-noinstall="1">${esc(INSTALL.later)}</button>
  </div>`;
}

/* ========== 起動 ========== */
akariImgProbe();
/* Androidなどが出す「追加しますか」を、こちらのタイミングで出せるよう受け取っておく */
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; render(); });
window.addEventListener('appinstalled', () => { installPrompt = null; render(); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (S.dark === 'auto') applyTheme(); });
render();
/* ローカル開発中はSWを登録しない（古いキャッシュが配信される事故を防ぐため） */
const isLocal = ['localhost', '127.0.0.1', ''].includes(location.hostname);
if ('serviceWorker' in navigator) {
  if (isLocal) {
    navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
    caches.keys().then(ks => ks.forEach(k => caches.delete(k)));
  } else {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

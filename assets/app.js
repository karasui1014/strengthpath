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
    gate: null, gateQuiz: null, quiz: null, result: null, steps: null, logs: [], sessions: [],
    goal: { why: '', reward: '', hours: '' } };
}
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (d && d.profiles) return d;
  } catch (e) {}
  const p = blankProfile('あなた');
  return { v: 1, theme: 'sepia', dark: 'auto', mode: 'self',
           activeId: p.id, selfId: p.id, profiles: { [p.id]: p } };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
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

/* ========== 採点（4段階 → 0〜100%） ========== */
function scoreAll(a) {
  const t = {}, st = {};
  Q_TRAIT.forEach(([c], i) => { t[c] = (t[c] || 0) + (a['t' + i] || 2); });
  Q_STYLE.forEach(([c], i) => { st[c] = (st[c] || 0) + (a['s' + i] || 2); });
  const pct = o => { const r = {}; for (const k in o) r[k] = Math.round((o[k] - 2) / 6 * 100); return r; };
  const tp = pct(t), sp = pct(st);
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
  const g = {};
  Q_GATE.forEach(([c], i) => { g[c] = (g[c] || 0) + (a['g' + i] || 2); });
  const motive = (g.why || 0) + (g.keep || 0);     // 4〜16
  const room   = (g.time || 0) + (g.give || 0);    // 4〜16
  let tier = 'other';
  if (motive >= 11 && room >= 11) tier = 'ready';
  else if (motive >= 11) tier = 'time';
  return { motive, room, tier, date: today() };
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
  const map = { home: vHome, gate: vGate, gateResult: vGateResult, other: vOther,
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
  const items = [['home', '🏠', 'ホーム'], ['clues', '✨', 'もちあじ'],
                 ['jobs', '🧰', 'しごと'], ['book', '📓', 'きろく'], ['buddy', '💬', 'そうだん']];
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
      まず<b>いまの状況を8問</b>だけ聞いて、そのうえで持ち味を見ていきます。</p>
      <button class="btn xl" data-nav="gate">はじめる</button>
      <ul class="easy">
        <li>1問3秒。指1本でOK</li>
        <li>途中でやめても、続きから始められます</li>
        <li>結果はこの端末の中だけ。登録もいりません</li>
      </ul>
    </div>`;
}

/* ========== しつもん ========== */
const QALL = () => [...Q_TRAIT.map((q, i) => ({ k: 't' + i, t: q[1] })),
                    ...Q_STYLE.map((q, i) => ({ k: 's' + i, t: q[1] }))];

function vQuiz(p) {
  if (!p.quiz) p.quiz = { i: 0, a: {} };
  const qs = QALL(), q = qs[p.quiz.i];
  if (p.quiz.i >= qs.length) {
    p.result = scoreAll(p.quiz.a);
    p.steps = buildSteps(p.result.type);
    p.quiz = null; save();
    setTimeout(() => go('clues'), 420);
    return `<div class="welcome">${akariTag('happy', 128)}<div class="hi">${esc(VOICE.quizEnd)}</div></div>`;
  }
  const left = qs.length - p.quiz.i;
  return `<div class="quiz">
      <div class="qtop">
        <div class="bar"><i style="width:${p.quiz.i / qs.length * 100}%"></i></div>
        <span class="mini">あと${left}問</span>
      </div>
      ${p.quiz.i === 0 ? say(VOICE.quizStart, 'normal', 48)
        : (p.quiz.i % 8 === 0 ? say(pick(VOICE.quizMid), 'think', 48) : '')}
      <h2 class="qtext">${esc(q.t)}</h2>
      <div class="scale">
        ${SCALE.map(s => `<button class="sc" data-ans="${s.v}">${esc(s.label)}</button>`).join('')}
      </div>
      <div class="qfoot">
        ${p.quiz.i > 0 ? '<button class="btn link" data-back="1">← ひとつ戻る</button>' : '<span></span>'}
        <button class="btn link" data-pause="1">今日はここまで</button>
      </div>
    </div>`;
}

/* ========== もちあじ（結果） ========== */
function vClues(p) {
  if (!p.result) return notyet();
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
    <button class="btn link wide" data-retake="1">もう一度やってみる</button>
    <button class="btn link wide" data-regate="1">いまの状況を聞き直す</button>`;
}
const notyet = () => `<div class="welcome">${akariTag('think', 110)}
    <div class="hi">まだ、はじめていませんね。</div>
    <button class="btn xl" data-nav="gate">3分ではじめる</button></div>`;


/* ========== 適性チェック（8問） ========== */
function vGate(p) {
  if (!p.gateQuiz) p.gateQuiz = { i: 0, a: {} };
  const q = Q_GATE[p.gateQuiz.i];
  if (p.gateQuiz.i >= Q_GATE.length) {
    p.gate = scoreGate(p.gateQuiz.a);
    p.gateQuiz = null; save();
    setTimeout(() => go('gateResult'), 380);
    return `<div class="welcome">${akariTag('think', 120)}<div class="hi">……なるほど。</div></div>`;
  }
  const left = Q_GATE.length - p.gateQuiz.i;
  return `<div class="quiz">
      <div class="qtop">
        <div class="bar"><i style="width:${p.gateQuiz.i / Q_GATE.length * 100}%"></i></div>
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

/* ========== しごと（副業カタログ） ========== */
let jobCat = 'all', jobOpen = null;
function vJobs(p) {
  const matched = p.result ? matchJobs(p.result.traits) : null;
  const list = (matched ? matched.map(m => m.job) : JOBS)
    .filter(j => jobCat === 'all' || j.cat === jobCat);
  const topIds = matched ? matched.slice(0, 3).map(m => m.job.id) : [];
  return `${p.result
      ? say('あなたの持ち味に近い順に並べました。上の3つは特に相性がいいです。', 'happy')
      : say('20コあります。持ち味を調べると、合う順に並びかえられます。', 'normal')}
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
          <div class="rx"><b>最初の一歩</b>${esc(j.first)}</div>
          <p class="jrow"><b>いるもの</b>${esc(j.need)}</p>
          <p class="jrow"><b>AIの使いどころ</b>${esc(j.ai)}</p>
          <p class="jrow real"><b>正直なところ</b>${esc(j.real)}</p>
          <p class="jrow"><b>効く持ち味</b>${Object.keys(j.w).map(k => TRAITS[k].name).join('・')}</p>
        </div>` : ''}
      </div>`;
    }).join('')}
    <p class="fine">分類の枠組みはリベラルアーツ大学「おすすめの副業19選」を参考にしています。解説文と持ち味との対応づけは本ツールの独自作成です。</p>`;
}

/* ========== 手帳 ========== */
function vBook(p) {
  if (!p.result) return notyet();
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

    <h3 class="sec">これまで ${timesMoved(p)}回</h3>
    <div class="soft">
      ${p.logs.length ? `<ul class="loglist">${p.logs.slice().reverse().slice(0, 40).map(l =>
        `<li><span class="ld">${fmtDate(l.date)}</span><span class="lt">${esc(l.text)}</span></li>`).join('')}</ul>`
        : '<p class="dim">まだ真っ白です。1つ動いたら、ここに増えていきます。</p>'}
    </div>`;
}

/* ========== そうだん（AI） ========== */
function vBuddy(p) {
  if (!p.result) return notyet();
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
        ${list.map(x => `<div class="person${x.id === S.activeId ? ' on' : ''}" data-pick="${x.id}">
          <span class="pav">${akariTag('normal', 38)}</span>
          <span class="pinfo"><b>${esc(x.name)}</b>
            <em>${x.result ? TYPES[x.result.type].name + '・' + doneCount(x) + '/' + totalCount(x) + '手' : 'まだ調べていません'}${x.id === S.selfId ? '・自分' : ''}</em></span>
          ${x.id === S.selfId ? '' : `<button class="del" data-del="${x.id}">消す</button>`}
        </div>`).join('')}
      </div>
      <div class="row"><input id="newname" placeholder="名前"><button class="btn" data-addp="1">追加</button></div>
    </div>
    ${p.result ? `<div class="soft">
      <div class="mini">${esc(p.name)} の面談メモ</div>
      <ul class="loglist">${p.sessions.length ? p.sessions.slice().reverse().map(s =>
        `<li><span class="ld">${fmtDate(s.date)}</span><span class="lt">${esc(s.note)}${s.next ? `<em class="nx">→ ${esc(s.next)}</em>` : ''}</span></li>`).join('')
        : '<li class="dim">まだありません</li>'}</ul>
      <textarea id="snote" rows="3" placeholder="今回のメモ"></textarea>
      <input id="snext" placeholder="次回までにやること">
      <button class="btn" data-addses="1">記録する</button>
    </div>` : ''}`;
}

/* ========== 設定 ========== */
function vSettings(p) {
  return `<h3 class="sec">いろ</h3>
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
      <label class="fl">呼び名<input id="gname" value="${esc(p.name)}"></label>
      <label class="fl">やる理由（あとで思い出せるように）
        <textarea id="gwhy" rows="2" placeholder="例：月5万あれば、家族と旅行に行ける">${esc(p.goal.why)}</textarea></label>
      <label class="fl">ごほうび<input id="greward" value="${esc(p.goal.reward)}" placeholder="例：ぜんぶ終わったら好きなヘッドホンを買う"></label>
      <label class="fl">使えそうな時間<input id="ghours" value="${esc(p.goal.hours)}" placeholder="例：夜に30分くらい"></label>
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
    p.gateQuiz.a['g' + p.gateQuiz.i] = +e.currentTarget.dataset.gans;
    p.gateQuiz.i++; save(); render();
  });
  on('[data-gback]', 'click', () => { p.gateQuiz.i = Math.max(0, p.gateQuiz.i - 1); render(); });
  on('[data-jcat]', 'click', e => { jobCat = e.currentTarget.dataset.jcat; jobOpen = null; render(); });
  on('[data-job]', 'click', e => {
    const id = e.currentTarget.dataset.job;
    jobOpen = jobOpen === id ? null : id; render();
  });
  on('[data-ext]', 'click', e => window.open(e.currentTarget.dataset.ext, '_blank', 'noopener'));

  on('[data-ans]', 'click', e => {
    p.quiz.a[QALL()[p.quiz.i].k] = +e.currentTarget.dataset.ans;
    p.quiz.i++; save(); render();
  });
  on('[data-back]', 'click', () => { p.quiz.i = Math.max(0, p.quiz.i - 1); render(); });
  on('[data-pause]', 'click', () => { save(); go('home'); });
  on('[data-retake]', 'click', () => {
    if (!confirm('もう一度やってみますか？（記録はそのまま残ります）')) return;
    p.quiz = { i: 0, a: {} }; go('quiz');
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
    p.logs.push({ date: today(), text: txt });
    toast(pick(VOICE.doneStep), pick(['happy', 'wink']));
    render();
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

  on('[data-pick]', 'click', e => { if (e.target.dataset.del) return; S.activeId = e.currentTarget.dataset.pick; go('home'); });
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
      r.onload = () => { try { const d = JSON.parse(r.result); if (!d.profiles) throw 0;
        if (!confirm('いまのデータに上書きします。よろしいですか？')) return;
        S = d; save(); go('home'); } catch (_) { alert('読み込めませんでした。'); } };
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

/* ========== 起動 ========== */
akariImgProbe();
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

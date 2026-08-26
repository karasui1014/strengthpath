/* 伴走スタジオ - アプリ本体 */
'use strict';

const KEY = 'bansou-studio-v1';
const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => ymd(new Date());  // ※ toISOString はUTC基準で日本時間の朝が前日になるため使わない
const fmtDate = d => d ? d.replace(/-/g, '/').slice(5) : '';

/* ========== ストア ========== */
let S = load();

function blankProfile(name) {
  return {
    id: uid(), name: name || '名前未設定', createdAt: today(),
    diagnosis: null, goal: { why: '', target: '', hours: '', deadline: '' },
    roadmap: null, logs: [], sessions: []
  };
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const d = JSON.parse(raw); if (d && d.profiles) return d; }
  } catch (e) { console.warn('読み込み失敗', e); }
  const p = blankProfile('自分');
  return { v: 1, mode: 'self', activeId: p.id, selfId: p.id, profiles: { [p.id]: p } };
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { alert('保存に失敗しました。ブラウザの容量設定をご確認ください。'); }
}
const P = () => S.profiles[S.activeId] || S.profiles[S.selfId];

/* ========== 採点 ========== */
function score(answers) {
  const traits = {}, brakes = {};
  Q_TRAIT.forEach(([code], i) => {
    const v = answers['t' + i] || 3;
    traits[code] = (traits[code] || 0) + v;
  });
  Q_BRAKE.forEach(([code], i) => {
    const v = answers['b' + i] || 3;
    brakes[code] = (brakes[code] || 0) + v;
  });
  const pct = o => { const r = {}; for (const k in o) r[k] = Math.round((o[k] - 2) / 8 * 100); return r; };
  const tp = pct(traits), bp = pct(brakes);

  let best = null, bestScore = -1;
  for (const code in TYPES) {
    const w = TYPES[code].w;
    let s = 0, tot = 0;
    for (const t in w) { s += (tp[t] || 0) * w[t]; tot += w[t]; }
    s = s / tot;
    if (s > bestScore) { bestScore = s; best = code; }
  }
  return { answers, traits: tp, brakes: bp, type: best, typeScore: Math.round(bestScore), date: today() };
}
const rank = o => Object.entries(o).sort((a, b) => b[1] - a[1]);

/* ========== ロードマップ生成 ========== */
function buildRoadmap(type) {
  return PHASES.map(ph => ({
    id: ph.id,
    tasks: [...(COMMON_TASKS[ph.id] || []), ...((TYPE_TASKS[type] || {})[ph.id] || [])]
      .map(t => ({ id: uid(), text: t, done: false, doneAt: null }))
  }));
}
function allTasks(p) {
  if (!p.roadmap) return [];
  const out = [];
  p.roadmap.forEach((ph, i) => ph.tasks.forEach(t => out.push({ ...t, phase: i })));
  return out;
}
function nextTask(p) { return allTasks(p).find(t => !t.done) || null; }
function progress(p) {
  const a = allTasks(p);
  return a.length ? Math.round(a.filter(t => t.done).length / a.length * 100) : 0;
}
function streak(p) {
  const days = new Set(p.logs.filter(l => l.done).map(l => l.date));
  let n = 0, d = new Date();
  for (;;) {
    const s = ymd(d);
    if (days.has(s)) { n++; d.setDate(d.getDate() - 1); }
    else if (n === 0 && s === today()) { d.setDate(d.getDate() - 1); }
    else break;
    if (n > 400) break;
  }
  return n;
}

/* ========== 画面ルーティング ========== */
let view = 'home';
let quiz = null;

function go(v) { view = v; window.scrollTo(0, 0); render(); }

function render() {
  const p = P();
  $('#nav').innerHTML = navHtml(p);
  const body = $('#view');
  const map = { home: vHome, quiz: vQuiz, result: vResult, roadmap: vRoadmap, log: vLog, ai: vAi, people: vPeople, settings: vSettings };
  body.innerHTML = (map[view] || vHome)(p);
  bind(p);
  save();
}

function navHtml(p) {
  const items = [['home', '🏠', 'ホーム'], ['result', '🧭', '強み'], ['roadmap', '🗺️', '90日'], ['log', '✅', '記録'], ['ai', '🤖', 'AIコーチ']];
  if (S.mode === 'coach') items.push(['people', '👥', '相手']);
  items.push(['settings', '⚙️', '設定']);
  return items.map(([v, i, l]) =>
    `<button class="nav-btn${view === v ? ' on' : ''}" data-nav="${v}"><span>${i}</span>${l}</button>`).join('');
}

/* ========== ホーム ========== */
function vHome(p) {
  const d = p.diagnosis;
  const isSelf = p.id === S.selfId;
  const who = S.mode === 'coach' ? `<div class="who">対象：<b>${esc(p.name)}</b>${isSelf ? '（自分）' : ''}</div>` : '';

  if (!d) return `
    ${who}
    <div class="hero">
      <div class="hero-badge">STEP 1</div>
      <h1>「知ってるのに動けない」を、<br>ここで終わりにします。</h1>
      <p>ノウハウが足りないのではありません。<b>自分に合った動き方</b>が決まっていないだけです。
      34問の診断で、あなたの<b>12資質</b>・<b>行動を止めているブレーキ</b>・<b>向いている副業の型</b>を出します。所要3〜4分。</p>
      <button class="btn big" data-go="quiz">診断をはじめる</button>
      <div class="note">結果はこの端末の中だけに保存されます。サーバーには一切送信されません。</div>
    </div>
    <div class="cards">
      ${[['🧭', '強みを知る', '12資質から上位5つを特定。「強みの裏側にある落とし穴」までセットで出します。'],
         ['🧊', 'ブレーキを外す', '動けない原因を5タイプで特定し、今日15分でできる処方箋を出します。'],
         ['🗺️', '90日で動かす', '型に合わせた90日ロードマップを自動生成。初収益までの道筋を引きます。']]
        .map(([i, t, x]) => `<div class="card"><div class="ci">${i}</div><h3>${t}</h3><p>${x}</p></div>`).join('')}
    </div>`;

  const t = TYPES[d.type];
  const nt = nextTask(p);
  const topBrake = rank(d.brakes)[0];
  const st = streak(p);
  return `
    ${who}
    <div class="panel accent">
      <div class="label">あなたの型</div>
      <h2>${esc(t.name)}</h2>
      <p class="catch">${esc(t.catch)}</p>
      <div class="stats">
        <div><b>${progress(p)}%</b><span>90日進捗</span></div>
        <div><b>${st}日</b><span>連続実行</span></div>
        <div><b>${p.logs.length}</b><span>記録数</span></div>
      </div>
    </div>

    <div class="panel">
      <div class="label">今週の一歩（これだけでOK）</div>
      ${nt ? `<h3 class="step-text">${esc(nt.text)}</h3>
        <div class="row">
          <button class="btn" data-done="${nt.id}">できた！</button>
          <button class="btn ghost" data-go="ai" data-preset="stuck">動けない…</button>
        </div>` : `<p>ロードマップのタスクは全部完了しています。素晴らしい！次の90日を作りましょう。</p>
        <button class="btn" data-newcycle="1">次の90日を作る</button>`}
    </div>

    <div class="panel warn">
      <div class="label">いま一番強いブレーキ</div>
      <h3>${esc(BRAKES[topBrake[0]].name)} <span class="pct">${topBrake[1]}%</span></h3>
      <p>${esc(BRAKES[topBrake[0]].catch)}</p>
      <div class="rx"><b>今日15分の処方箋</b><br>${esc(BRAKES[topBrake[0]].step)}</div>
    </div>

    <div class="row">
      <button class="btn ghost" data-go="result">診断結果を見る</button>
      <button class="btn ghost" data-go="roadmap">90日ロードマップ</button>
    </div>`;
}

/* ========== 診断 ========== */
const QALL = () => [...Q_TRAIT.map((q, i) => ({ key: 't' + i, text: q[1] })),
                    ...Q_BRAKE.map((q, i) => ({ key: 'b' + i, text: q[1] }))];

function vQuiz(p) {
  if (!quiz) quiz = { i: 0, a: {} };
  const qs = QALL();
  const q = qs[quiz.i];
  const pctDone = Math.round(quiz.i / qs.length * 100);
  if (quiz.i >= qs.length) {
    p.diagnosis = score(quiz.a);
    p.roadmap = buildRoadmap(p.diagnosis.type);
    quiz = null; save();
    setTimeout(() => go('result'), 0);
    return '<div class="panel">診断中…</div>';
  }
  return `
    <div class="quiz">
      <div class="bar"><i style="width:${pctDone}%"></i></div>
      <div class="qnum">${quiz.i + 1} / ${qs.length}</div>
      <h2 class="qtext">${esc(q.text)}</h2>
      <div class="scale">
        ${SCALE.map(s => `<button class="sc" data-ans="${s.v}"><b>${s.v}</b>${esc(s.label)}</button>`).join('')}
      </div>
      ${quiz.i > 0 ? '<button class="btn ghost sm" data-back="1">← 1つ戻る</button>' : ''}
    </div>`;
}

/* ========== 結果 ========== */
function vResult(p) {
  const d = p.diagnosis;
  if (!d) return `<div class="panel"><p>まだ診断していません。</p><button class="btn" data-go="quiz">診断する</button></div>`;
  const t = TYPES[d.type];
  const top5 = rank(d.traits).slice(0, 5);
  const bottom = rank(d.traits).slice(-2);
  const brakes = rank(d.brakes).slice(0, 2);

  return `
    <div class="panel accent">
      <div class="label">向いている副業の型</div>
      <h2>${esc(t.name)}</h2>
      <p class="catch">${esc(t.catch)}</p>
      <p>${esc(t.desc)}</p>
      <div class="chips">${t.examples.map(e => `<span class="chip">${esc(e)}</span>`).join('')}</div>
      <div class="rx"><b>最初の1円の取り方</b><br>${esc(t.money)}</div>
      <div class="rx warn-rx"><b>この型がつまずくポイント</b><br>${esc(t.risk)}</div>
    </div>

    <div class="panel">
      <div class="label">あなたの強み TOP5</div>
      ${top5.map(([c, v], i) => {
        const tr = TRAITS[c], cat = CATS[tr.cat];
        return `<div class="trait" style="--c:${cat.color}">
          <div class="trait-h"><span class="rk">${i + 1}</span>
            <div><b>${esc(tr.name)}</b><span class="cat">${esc(cat.name)}</span>
            <div class="tc">${esc(tr.catch)}</div></div>
            <span class="pct">${v}%</span></div>
          <div class="trait-b">
            <p><b>効くところ：</b>${esc(tr.strong)}</p>
            <p class="dim"><b>空回りするとき：</b>${esc(tr.trap)}</p>
            <p class="lev"><b>活かし方：</b>${esc(tr.lever)}</p>
          </div></div>`;
      }).join('')}
    </div>

    <div class="panel warn">
      <div class="label">行動を止めているブレーキ</div>
      ${brakes.map(([c, v]) => {
        const b = BRAKES[c];
        return `<div class="brake">
          <h3>${esc(b.name)} <span class="pct">${v}%</span></h3>
          <p class="catch">${esc(b.catch)}</p>
          <p><b>出ているサイン：</b>${esc(b.sign)}</p>
          <p class="dim"><b>なぜ起きるか：</b>${esc(b.why)}</p>
          <p><b>外し方：</b>${esc(b.remedy)}</p>
          <div class="rx"><b>今日15分でやること</b><br>${esc(b.step)}</div>
        </div>`;
      }).join('')}
    </div>

    <div class="panel">
      <div class="label">伸ばさなくていいところ</div>
      <p>この2つは、あなたが無理に伸ばす必要はありません。人に頼るか、仕組みで補うのが正解です。</p>
      <div class="chips">${bottom.map(([c, v]) => `<span class="chip dimchip">${esc(TRAITS[c].name)} ${v}%</span>`).join('')}</div>
    </div>

    <div class="row">
      <button class="btn" data-go="roadmap">90日ロードマップへ</button>
      <button class="btn ghost" data-go="ai">AIコーチに相談する</button>
    </div>
    <button class="btn ghost sm" data-retake="1">診断をやり直す</button>`;
}

/* ========== ロードマップ ========== */
function vRoadmap(p) {
  if (!p.roadmap) return `<div class="panel"><p>先に診断してください。</p><button class="btn" data-go="quiz">診断する</button></div>`;
  return `
    <div class="panel">
      <div class="label">90日ロードマップ</div>
      <h2>${progress(p)}% 完了</h2>
      <div class="bar"><i style="width:${progress(p)}%"></i></div>
      <p class="dim">上から順に1つずつでOK。同時に2つ進めないのがコツです。</p>
    </div>
    ${PHASES.map((ph, i) => {
      const tasks = p.roadmap[i].tasks;
      const dn = tasks.filter(t => t.done).length;
      return `<div class="panel phase">
        <div class="ph-h"><span class="ph-n">${ph.range}</span><h3>${esc(ph.title)}</h3><span class="pct">${dn}/${tasks.length}</span></div>
        <p class="dim">ゴール：${esc(ph.goal)}</p>
        <ul class="tasks">
          ${tasks.map(t => `<li class="${t.done ? 'done' : ''}">
            <label><input type="checkbox" data-task="${t.id}" ${t.done ? 'checked' : ''}><span>${esc(t.text)}</span></label>
            ${t.doneAt ? `<em>${fmtDate(t.doneAt)}</em>` : ''}
          </li>`).join('')}
        </ul>
        <button class="btn ghost sm" data-addtask="${i}">＋ 自分でタスクを足す</button>
      </div>`;
    }).join('')}`;
}

/* ========== 記録 ========== */
function vLog(p) {
  const has = p.logs.some(l => l.date === today());
  const recent = p.logs.slice().reverse().slice(0, 30);
  const nt = nextTask(p);
  return `
    <div class="panel">
      <div class="label">今日のチェックイン</div>
      ${nt ? `<p class="step-text">${esc(nt.text)}</p>` : ''}
      ${has ? '<p class="ok">✅ 今日はもう記録済みです。おつかれさまでした！</p>' : `
      <div class="moods">${[1, 2, 3, 4, 5].map(m => `<button class="mood" data-mood="${m}">${['😵', '😟', '😐', '🙂', '🔥'][m - 1]}</button>`).join('')}</div>
      <textarea id="lognote" rows="3" placeholder="やったこと / 詰まったこと（1行でOK）"></textarea>
      <div class="row">
        <button class="btn" data-log="1">できた として記録</button>
        <button class="btn ghost" data-log="0">できなかった を記録</button>
      </div>
      <p class="note">「できなかった」も立派な記録です。原因が見えると次が変わります。</p>`}
    </div>
    <div class="panel">
      <div class="label">これまでの記録（${p.logs.length}件・連続${streak(p)}日）</div>
      ${recent.length ? `<ul class="loglist">${recent.map(l => `
        <li class="${l.done ? '' : 'ng'}">
          <span class="ld">${fmtDate(l.date)}</span>
          <span class="lm">${['😵', '😟', '😐', '🙂', '🔥'][(l.mood || 3) - 1]}</span>
          <span class="lt">${esc(l.note) || (l.done ? '実行した' : '動けなかった')}</span>
        </li>`).join('')}</ul>` : '<p class="dim">まだ記録がありません。</p>'}
    </div>`;
}

/* ========== AIコーチ ========== */
let aiSel = 'first';
function vAi(p) {
  if (!p.diagnosis) return `<div class="panel"><p>先に診断してください。</p><button class="btn" data-go="quiz">診断する</button></div>`;
  const list = PROMPTS.filter(x => S.mode === 'coach' || x.id !== 'coach');
  return `
    <div class="panel">
      <div class="label">AIコーチ</div>
      <p>下から場面を選ぶと、あなたの診断結果・進捗・記録を全部埋め込んだ<b>プロンプト</b>を作ります。
      コピーして Claude や ChatGPT に貼るだけで、あなた専用のコーチングが始まります。</p>
      <div class="prompts">
        ${list.map(x => `<button class="pbtn${aiSel === x.id ? ' on' : ''}" data-ai="${x.id}">
          <span class="pi">${x.icon}</span><b>${esc(x.name)}</b><em>${esc(x.desc)}</em></button>`).join('')}
      </div>
    </div>
    <div class="panel">
      <div class="label">生成されたプロンプト</div>
      <textarea id="ptext" rows="16" readonly>${esc(makePrompt(p, aiSel))}</textarea>
      <div class="row">
        <button class="btn" data-copy="1">📋 コピーする</button>
        <button class="btn ghost" data-open="claude">Claudeを開く</button>
        <button class="btn ghost" data-open="gpt">ChatGPTを開く</button>
      </div>
    </div>`;
}

function ctx(p) {
  const d = p.diagnosis, t = TYPES[d.type];
  const top5 = rank(d.traits).slice(0, 5).map(([c, v]) => `${TRAITS[c].name}(${v}%)`).join('、');
  const brakes = rank(d.brakes).slice(0, 2).map(([c, v]) => `${BRAKES[c].name}(${v}%)`).join('、');
  const nt = nextTask(p);
  const recent = p.logs.slice(-7).map(l => `- ${l.date} ${l.done ? '実行' : '未実行'} 気分${l.mood || 3}/5 ${l.note || ''}`).join('\n') || '- 記録なし';
  const doneList = allTasks(p).filter(x => x.done).map(x => '- ' + x.text).join('\n') || '- まだなし';
  return `【対象者の情報】
・呼び名：${p.name}
・向いている型：${t.name}（${t.catch}）
・強み上位5：${top5}
・行動を止めているブレーキ：${brakes}
・90日進捗：${progress(p)}%（連続実行 ${streak(p)}日 / 記録 ${p.logs.length}件）
・目的（なぜ副業を）：${p.goal.why || '未記入'}
・目標：${p.goal.target || '未記入'}
・使える時間：${p.goal.hours || '未記入'}

【完了済みタスク】
${doneList}

【今取り組むべきタスク】
${nt ? nt.text : '（ロードマップ完了）'}

【直近の記録】
${recent}`;
}

function makePrompt(p, id) {
  const base = ctx(p);
  const d = p.diagnosis;
  const rule = `【あなたの役割】
あなたは「副業をやりたいのに動けない人」専門の伴走コーチです。以下を必ず守ってください。
1. 新しいノウハウを増やさない。相手はすでに知識過多です。情報提供より、決断と実行の支援をしてください。
2. 一度に出す宿題は1つだけ。しかも15分で終わるサイズまで分解すること。
3. まず質問し、相手に答えさせてから提案する。いきなり結論を並べない。
4. 相手の強みを使った方法で提案する。弱点の克服を求めない。
5. 相手を励ますが、甘やかさない。期限と、実行したか確認する方法を必ずセットにする。`;

  if (id === 'first') return `${rule}

${base}

【今回やってほしいこと】
初回セッションです。次の流れで進めてください。1ステップずつ、私の返答を待ってから次に進んでください。
① 上の情報を読んで、私が「動けていない本当の理由」の仮説を1〜2個立て、質問の形で確認する
② 私の答えを聞いて、90日後のゴールを一文に整える
③ その型と強みに合った「今週の1つだけの行動」を、15分サイズまで分解して提案する
④ 実行できたか確認する方法（いつ・どこに報告するか）を一緒に決める`;

  if (id === 'weekly') return `${rule}

${base}

【今回やってほしいこと】
1週間のふりかえりです。次の流れで、1つずつ質問しながら進めてください。
① 直近の記録を見て、できたこと・進んだことを具体的に1つ以上言語化して認める
② できなかった部分について、意志の問題ではなく「仕組みのどこが原因か」を一緒に特定する
③ 来週の1つだけの行動を決める。先週うまくいかなかったなら、サイズを半分にして提案する
④ 最後に、来週の私に向けた短いメッセージを書く`;

  if (id === 'stuck') {
    const b = rank(d.brakes)[0][0];
    return `${rule}

${base}

【今の状態】
手が止まっています。診断上いちばん強いブレーキは「${BRAKES[b].name}」（${BRAKES[b].catch}）です。

【今回やってほしいこと】
① まず「なぜ動けないのか」を私に説明させる質問を1つだけ投げてください
② 私の答えから、止まっている本当のポイント（判断・不安・環境・サイズのどれか）を特定してください
③ 今日これから15分でできる、恥ずかしいほど小さい一歩を1つだけ提案してください
   ※準備・情報収集・計画は禁止です。必ず「外に出る」「形にする」行動にしてください
④ それをやり終えたら何と報告すればいいか、報告文のテンプレを書いてください`;
  }

  if (id === 'money') return `${rule}

${base}

【今回やってほしいこと】
最初の1円を受け取るための設計をします。
① 私の型と強みから、いちばん早く売れる最小の商品（サービス）を1つ提案してください
② 値段を決めます。相場ではなく「私が受け取れると感じる額」から始める前提で、質問しながら決めてください
③ 最初の1人は誰に声をかけるべきか、私の身近な人から一緒に洗い出してください
④ その人に送るメッセージの文面を、売り込みに見えない形で下書きしてください
⑤ いつ送るか、日付を決めさせてください`;

  if (id === 'coach') return `あなたはプロのコーチを補佐するアシスタントです。以下のクライアントとの面談準備を手伝ってください。

${base}

【セッション履歴】
${p.sessions.length ? p.sessions.map(s => `- ${s.date}：${s.note}${s.next ? '（次回宿題：' + s.next + '）' : ''}`).join('\n') : '- 初回面談'}

【作ってほしいもの】
① このクライアントの現状の見立て（強み・ブレーキ・停滞ポイント）を3行で
② 今回の面談のゴール案を2つ
③ 60分の面談の流れ（時間配分つき）
④ 冒頭で使う質問を3つ、深掘り用の質問を5つ。強みを引き出す方向で
⑤ 面談の最後に渡す宿題の候補を2つ（どちらも15分で終わるサイズ）
⑥ 触れるとき注意が必要な点（傷つけやすい話題があれば）`;

  return base;
}

/* ========== 相手（コーチモード） ========== */
function vPeople() {
  const list = Object.values(S.profiles);
  return `
    <div class="panel">
      <div class="label">伴走している相手</div>
      <p class="dim">選ぶと、その人のデータに切り替わります。すべてこの端末内に保存されます。</p>
      <div class="people">
        ${list.map(p => `<div class="person${p.id === S.activeId ? ' on' : ''}" data-pick="${p.id}">
          <div class="pav">${esc((p.name || '?').slice(0, 1))}</div>
          <div class="pinfo"><b>${esc(p.name)}</b>
            <span>${p.diagnosis ? TYPES[p.diagnosis.type].name + ' / 進捗' + progress(p) + '%' : '未診断'}${p.id === S.selfId ? '・自分' : ''}</span></div>
          ${p.id === S.selfId ? '' : `<button class="del" data-del="${p.id}">削除</button>`}
        </div>`).join('')}
      </div>
      <div class="row">
        <input id="newname" placeholder="新しい相手の名前">
        <button class="btn" data-addp="1">追加</button>
      </div>
    </div>
    ${P().diagnosis ? `<div class="panel">
      <div class="label">${esc(P().name)} のセッション記録</div>
      <ul class="loglist">
        ${P().sessions.length ? P().sessions.slice().reverse().map(s => `<li>
          <span class="ld">${fmtDate(s.date)}</span>
          <span class="lt">${esc(s.note)}${s.next ? `<em class="nx">→ ${esc(s.next)}</em>` : ''}</span></li>`).join('')
          : '<li class="dim">まだ記録がありません</li>'}
      </ul>
      <textarea id="snote" rows="3" placeholder="今回の面談メモ"></textarea>
      <input id="snext" placeholder="次回までの宿題（15分サイズで）">
      <button class="btn" data-addsession="1">セッションを記録</button>
    </div>` : ''}`;
}

/* ========== 設定 ========== */
function vSettings(p) {
  return `
    <div class="panel">
      <div class="label">モード</div>
      <div class="row">
        <button class="btn${S.mode === 'self' ? '' : ' ghost'}" data-mode="self">セルフ伴走</button>
        <button class="btn${S.mode === 'coach' ? '' : ' ghost'}" data-mode="coach">コーチ（複数人を伴走）</button>
      </div>
      <p class="note">コーチモードにすると「相手」タブが出て、複数人を切り替えられます。</p>
    </div>
    <div class="panel">
      <div class="label">${esc(p.name)} の基本情報</div>
      <label class="fl">呼び名<input id="gname" value="${esc(p.name)}"></label>
      <label class="fl">なぜ副業をやるのか（その先の状態を具体的に）
        <textarea id="gwhy" rows="2" placeholder="例：月5万円あれば、家族と年2回旅行に行ける">${esc(p.goal.why)}</textarea></label>
      <label class="fl">90日後の目標<input id="gtarget" value="${esc(p.goal.target)}" placeholder="例：初収益1円を取る / 発信30本"></label>
      <label class="fl">週に使える時間<input id="ghours" value="${esc(p.goal.hours)}" placeholder="例：平日30分＋土曜2時間"></label>
      <button class="btn" data-savegoal="1">保存する</button>
    </div>
    <div class="panel">
      <div class="label">データ</div>
      <div class="row">
        <button class="btn ghost" data-export="1">バックアップを書き出す</button>
        <button class="btn ghost" data-import="1">読み込む</button>
      </div>
      <p class="note">データはこの端末のブラウザ内だけに保存されます。機種変更やブラウザのデータ削除で消えるので、たまに書き出しておくと安心です。</p>
      <button class="btn danger sm" data-reset="1">${esc(p.name)} のデータを初期化</button>
    </div>
    <div class="panel">
      <p class="note">※ 本ツールの12資質・5ブレーキ・8つの型は、副業行動に特化した独自分類です。
      ストレングスファインダー®（CliftonStrengths®／Gallup社）とは無関係で、その診断結果や解説文は使用していません。</p>
    </div>`;
}

/* ========== イベント ========== */
function bind(p) {
  const on = (sel, ev, fn) => $$(sel).forEach(el => el.addEventListener(ev, fn));

  on('[data-go]', 'click', e => {
    const v = e.currentTarget.dataset.go;
    if (e.currentTarget.dataset.preset) aiSel = e.currentTarget.dataset.preset;
    if (v === 'quiz') quiz = { i: 0, a: {} };
    go(v);
  });

  on('[data-ans]', 'click', e => {
    quiz.a[QALL()[quiz.i].key] = +e.currentTarget.dataset.ans;
    quiz.i++; render();
  });
  on('[data-back]', 'click', () => { quiz.i = Math.max(0, quiz.i - 1); render(); });
  on('[data-retake]', 'click', () => {
    if (!confirm('診断をやり直しますか？ロードマップも作り直されます（記録は残ります）')) return;
    quiz = { i: 0, a: {} }; go('quiz');
  });

  on('[data-task]', 'change', e => {
    const id = e.currentTarget.dataset.task;
    p.roadmap.forEach(ph => ph.tasks.forEach(t => {
      if (t.id === id) { t.done = e.currentTarget.checked; t.doneAt = t.done ? today() : null; }
    }));
    render();
  });
  on('[data-done]', 'click', e => {
    const id = e.currentTarget.dataset.done;
    p.roadmap.forEach(ph => ph.tasks.forEach(t => { if (t.id === id) { t.done = true; t.doneAt = today(); } }));
    if (!p.logs.some(l => l.date === today())) p.logs.push({ date: today(), done: true, mood: 4, note: '' });
    render();
  });
  on('[data-addtask]', 'click', e => {
    const txt = prompt('追加するタスク（15分で終わるサイズがおすすめです）');
    if (!txt) return;
    p.roadmap[+e.currentTarget.dataset.addtask].tasks.push({ id: uid(), text: txt, done: false, doneAt: null });
    render();
  });
  on('[data-newcycle]', 'click', () => {
    if (!confirm('次の90日ロードマップを作りますか？（今の達成記録はリセットされます）')) return;
    p.roadmap = buildRoadmap(p.diagnosis.type); go('roadmap');
  });

  let mood = 4;
  on('[data-mood]', 'click', e => { mood = +e.currentTarget.dataset.mood; $$('.mood').forEach(m => m.classList.remove('on')); e.currentTarget.classList.add('on'); });
  on('[data-log]', 'click', e => {
    p.logs.push({ date: today(), done: e.currentTarget.dataset.log === '1', mood, note: ($('#lognote') || {}).value || '' });
    render();
  });

  on('[data-ai]', 'click', e => { aiSel = e.currentTarget.dataset.ai; render(); });
  on('[data-copy]', 'click', async e => {
    const ta = $('#ptext');
    try { await navigator.clipboard.writeText(ta.value); }
    catch (_) { ta.removeAttribute('readonly'); ta.select(); document.execCommand('copy'); ta.setAttribute('readonly', ''); }
    e.currentTarget.textContent = '✅ コピーしました';
    setTimeout(() => { e.currentTarget.textContent = '📋 コピーする'; }, 1600);
  });
  on('[data-open]', 'click', e => {
    window.open(e.currentTarget.dataset.open === 'claude' ? 'https://claude.ai/new' : 'https://chatgpt.com/', '_blank', 'noopener');
  });

  on('[data-mode]', 'click', e => { S.mode = e.currentTarget.dataset.mode; render(); });
  on('[data-pick]', 'click', e => {
    if (e.target.dataset.del) return;
    S.activeId = e.currentTarget.dataset.pick; go('home');
  });
  on('[data-del]', 'click', e => {
    e.stopPropagation();
    const id = e.currentTarget.dataset.del;
    if (!confirm(`${S.profiles[id].name} のデータを削除します。元に戻せません。よろしいですか？`)) return;
    delete S.profiles[id];
    if (S.activeId === id) S.activeId = S.selfId;
    render();
  });
  on('[data-addp]', 'click', () => {
    const n = ($('#newname') || {}).value.trim();
    if (!n) return alert('名前を入力してください');
    const np = blankProfile(n); S.profiles[np.id] = np; S.activeId = np.id; go('home');
  });
  on('[data-addsession]', 'click', () => {
    const note = ($('#snote') || {}).value.trim();
    if (!note) return alert('面談メモを入力してください');
    p.sessions.push({ date: today(), note, next: ($('#snext') || {}).value.trim() });
    render();
  });

  on('[data-savegoal]', 'click', () => {
    p.name = ($('#gname').value || '名前未設定').trim();
    p.goal = { why: $('#gwhy').value, target: $('#gtarget').value, hours: $('#ghours').value, deadline: p.goal.deadline };
    save(); alert('保存しました！');
    render();
  });

  on('[data-export]', 'click', () => {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `伴走スタジオ_${today()}.json`;
    a.click(); URL.revokeObjectURL(a.href);
  });
  on('[data-import]', 'click', () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'application/json';
    inp.onchange = () => {
      const f = inp.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const d = JSON.parse(r.result);
          if (!d.profiles) throw 0;
          if (!confirm('現在のデータを上書きします。よろしいですか？')) return;
          S = d; save(); go('home');
        } catch (_) { alert('このファイルは読み込めませんでした。'); }
      };
      r.readAsText(f);
    };
    inp.click();
  });
  on('[data-reset]', 'click', () => {
    if (!confirm(`${p.name} の診断・ロードマップ・記録をすべて消します。元に戻せません。よろしいですか？`)) return;
    const fresh = blankProfile(p.name); fresh.id = p.id;
    S.profiles[p.id] = fresh; go('home');
  });

}

document.addEventListener('click', e => {
  const b = e.target.closest('.nav-btn');
  if (b) { view = b.dataset.nav; window.scrollTo(0, 0); render(); }
});

render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});

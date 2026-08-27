#!/usr/bin/env python3
"""アプリの全文言を1枚のHTMLに書き出す（校正・内容確認用）。
   data.js から直接読むので、文言を直したら作り直せば常に最新になる。
   実行: python3 tools/review.py  →  dist/review.html"""
import json, html, pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
D = json.loads(pathlib.Path('/tmp/sp_data.json').read_text(encoding='utf-8'))
P = json.loads(pathlib.Path('/tmp/sp_prompts.json').read_text(encoding='utf-8'))
e = lambda s: html.escape(str(s if s is not None else ''))
n = lambda s: f'<span class="len">{len(str(s))}</span>'

SECTIONS = []
def sec(sid, num, title, lead, body):
    SECTIONS.append((sid, num, title))
    return f'''<section id="{sid}">
<h2><span class="num">{num}</span>{e(title)}</h2>
<p class="lead">{lead}</p>
{body}
</section>'''

def rows(pairs):
    return '<dl class="rows">' + ''.join(
        f'<dt>{e(k)}</dt><dd>{e(v)}{n(v)}</dd>' for k, v in pairs if v) + '</dl>'

# ---------- 1. 適性チェック ----------
gq = '<ol class="qs">' + ''.join(
    f'<li><span class="tag t-{c}">{e({"time":"時間","give":"手放す","why":"気持ち","keep":"続ける"}[c])}</span>{e(t)}</li>'
    for c, t in D['Q_GATE']) + '</ol>'
scale = '<p class="scale">選択肢：' + ' ／ '.join(e(s['label']) for s in D['SCALE']) + '</p>'
gates = ''.join(f'''<div class="card gate-{k}">
<h3>{e(g['title'])}</h3>
<p class="catch">{e(g['lead'])}</p>
<p>{e(g['body'])}</p>
{'<ul class="tips">' + ''.join(f'<li>{e(x)}</li>' for x in g['tips']) + '</ul>' if g.get('tips') else ''}
<p class="cta">ボタン：{e(g['cta'])}</p></div>''' for k, g in D['GATES'].items())
S1 = sec('gate', '①', f'適性チェック（必須{D["GATE_CORE"]}問）',
    '最初に聞く3問（必須）と、追加1問。<b>気持ち</b>（変えたい・続けられる）と<b>余力</b>（時間・手放せる）を別々に測り、3つに分かれます。合計点ひとつで切ると「やる気はあるが時間がない人」を弾いてしまうため、2軸にしています。',
    gq + scale + '<h3 class="sub">判定の3パターン</h3>' + gates)

# ---------- 2. 副業以外の道 ----------
ways = ''.join(f'''<div class="card">
<h3>{e(w['emoji'])} {e(w['title'])}</h3>
<p>{e(w['body'])}{n(w['body'])}</p>
<p class="rx"><b>今日15分でできること</b>{e(w['step'])}</p></div>''' for w in D['OTHER_WAYS'])
S2 = sec('other', '②', '副業以外の道',
    '「いまは、副業より効くことがあります」と出た人に見せる画面。<b>否定はせず</b>、時間を使わない方法を先に紹介します。',
    ways + f'''<div class="card quiet">
<h3>案内するリンク</h3><p>{e(D['LEARN_LINK']['label'])} — {e(D['LEARN_LINK']['note'])}</p>
<p class="url">{e(D['LEARN_LINK']['url'])}</p>
<p class="note">{e(D['MONEY_NOTE'])}</p></div>''')

# ---------- 3. 持ち味チェック ----------
half = len(D['Q_PAIR']) // 2
def pair_rows(items, base):
    out = '<ol class="qs pairs" start="%d">' % (base + 1)
    for (pair, ta, tb) in items:
        out += ('<li><span class="pa">%s</span><span class="pv">か</span><span class="pb">%s</span>'
                '<span class="pw">%s ↔ %s</span></li>') % (
            e(ta), e(tb), e(D['TRAITS'][pair[0]]['name']), e(D['TRAITS'][pair[1]]['name']))
    return out + '</ol>'
picks = ''
for i, q in enumerate(D['Q_STYLE_PICK']):
    picks += '<h4 class="pickq">%s%s</h4><ul class="picks">' % (
        e(q['ask']), '（必須）' if i == 0 else '（追加）')
    picks += ''.join('<li><span class="tag t-style">%s</span>%s</li>' % (
        e(D['STYLES'][c]['name']), e(t)) for c, t in q['opts'])
    picks += '</ul>'
S3 = sec('quiz', '③', '設問（必須10問）',
    '<b>1問で2つの持ち味を同時に測ります。</b>「まず試してみる／まず調べてみる」のように、'
    'どちらを選んでも否定にならない対で聞くので、12種を6問で測れます。'
    'Aを「こっち」で選べばBは反対の値になり、1タップが2種ぶんの答えになります。',
    '<h3 class="sub">どっち寄り？　前半6問<span class="goal">必須。12種すべてが1回ずつ出る</span></h3>'
    + pair_rows(D['Q_PAIR'][:half], 0)
    + '<p class="scale">選び方：' + ' ／ '.join(e(x['label']) + '(' + x['side'].upper() + ')' for x in D['PAIR_SCALE']) + '</p>'
    + '<h3 class="sub">どっち寄り？　後半6問<span class="goal">追加。同じ12種を別の組み合わせで</span></h3>'
    + pair_rows(D['Q_PAIR'][half:], half)
    + '<h3 class="sub">進みグセ<span class="goal">5つから1つ選ぶだけ</span></h3>' + picks)

# ---------- 4. 12の持ち味 ----------
traits = ''.join(f'''<div class="card">
<h3>{e(v['name'])}<span class="cat">{e(D['CATS'][v['cat']]['icon'])} {e(D['CATS'][v['cat']]['name'])}</span></h3>
<p class="catch">{e(v['catch'])}</p>
{rows([('強み', v['strong']), ('効くところ', v['scene']), ('ラクに進む方法', v['easy'])])}
</div>''' for v in D['TRAITS'].values())
S4 = sec('traits', '④', '12の持ち味',
    '上位5つを結果画面に出します。<b>弱点は一切書きません</b>。「効くところ」と「そのままラクに進む方法」だけです。',
    f'<div class="grid">{traits}</div>')

# ---------- 5. 進みグセ ----------
styles = ''.join(f'''<div class="card">
<h3>{e(v['emoji'])} {e(v['name'])}</h3>
<p class="catch">{e(v['catch'])}</p>
{rows([('いいところ', v['good']), ('ラクに進むコツ', v['tip']),
       ('気が乗らない日の3分', v['micro']), ('ホームで出る一言', v['line'])])}
</div>''' for v in D['STYLES'].values())
S5 = sec('styles', '⑤', '5つの進みグセ',
    'もともと「ブレーキ」だったものを、<b>すべて肯定形に言い換えた</b>ものです。完璧主義→こだわり型、選択肢過多→目移り型、というように。',
    f'<div class="grid">{styles}</div>')

# ---------- 6. 向いてる道 ----------
types = ''.join(f'''<div class="card">
<h3>{e(v['emoji'])} {e(v['name'])}<span class="cat">{e(v['sub'])}</span></h3>
<p class="catch">{e(v['catch'])}</p>
<p>{e(v['desc'])}</p>
<p class="chips">{''.join(f'<span>{e(x)}</span>' for x in v['examples'])}</p>
<p class="rx"><b>はじめの1円</b>{e(v['money'])}</p>
<p class="w">効く持ち味：{e('・'.join(D['TRAITS'][k]['name'] + '×' + str(w) for k, w in v['w'].items()))}</p>
</div>''' for v in D['TYPES'].values())
S6 = sec('types', '⑥', '8つの向いてる道',
    '持ち味の組み合わせから1つを選んで提示します。ここから9つのやることが決まります。',
    f'<div class="grid">{types}</div>')

# ---------- 7. 副業カタログ ----------
jobs = ''
for ck, cv in D['JOB_CATS'].items():
    js = [j for j in D['JOBS'] if j['cat'] == ck]
    jobs += f'<h3 class="sub">{e(cv["emoji"])} {e(cv["name"])}<span class="count">{len(js)}</span></h3><div class="grid">'
    for j in js:
        jobs += f'''<div class="card">
<h3>{e(j['name'])}</h3>
<p class="catch">{e(j['what'])}</p>
{rows([('最初の一歩', j['first']), ('いるもの', j['need']),
       ('AIの使いどころ', j['ai']), ('正直なところ', j['real'])])}
<p class="w">効く持ち味：{e('・'.join(D['TRAITS'][k]['name'] + '×' + str(w) for k, w in j['w'].items()))}</p>
</div>'''
    jobs += '</div>'
S7 = sec('jobs', '⑦', f'副業カタログ（{len(D["JOBS"])}コ）',
    '分類の枠組みはリベラルアーツ大学「おすすめの副業19選＋番外編」を参考に、<b>解説文と持ち味との対応づけは独自に作成</b>したものです。「正直なところ」には都合の悪い面も書いています。',
    jobs)

# ---------- 8. 9つのやること ----------
steps = ''
for i, ch in enumerate(D['CHAPTERS']):
    steps += f'<h3 class="sub">{e(ch["no"])}・{e(ch["title"])}<span class="goal">{e(ch["goal"])}</span></h3>'
    steps += f'<p class="common"><b>全タイプ共通</b>{e(D["COMMON_STEPS"][ch["id"]])}</p><div class="grid">'
    for tk, tv in D['TYPES'].items():
        items = D['TYPE_STEPS'][tk][ch['id']]
        steps += f'<div class="card small"><h3>{e(tv["name"])}</h3><ul>' + \
                 ''.join(f'<li>{e(x)}</li>' for x in items) + '</ul></div>'
    steps += '</div>'
S8 = sec('steps', '⑧', '9つのやること',
    '3章 × 3つ。各章は「全タイプ共通1つ ＋ 道ごとに2つ」で構成しています。ホームには常に<b>次の1つだけ</b>出ます。',
    steps)

# ---------- 9. ひとこと ----------
voice = ''.join(
    f'<dt>{e(k)}</dt><dd>' + (('<br>'.join(e(x) for x in v)) if isinstance(v, list) else e(v)) + '</dd>'
    for k, v in D['VOICE'].items())
S9 = sec('voice', '⑨', 'キャラクターのひとこと',
    '設定や名前は画面に出しません。落ち着いた丁寧語で、急かさないことだけを守っています。',
    f'<dl class="rows voice">{voice}</dl>')

# ---------- 10. AIプロンプト ----------
prompts = ''.join(f'''<div class="card">
<h3>{e(v['emoji'])} {e(v['name'])}<span class="cat">{e(v['desc'])}</span></h3>
<pre>{e(v['text'])}</pre>
<p class="w">{len(v['text'])}文字</p></div>''' for v in P.values())
S10 = sec('prompts', '⑩', 'AIに渡す文章（5種）',
    'ChatGPT や Claude にコピペする文章です。<b>「相手を絶対に否定しない」「新しいノウハウを増やさない」「一度に出す提案は1つだけ」</b>をAI側にも守らせています。（下の例では、人によって変わる部分を括弧で示しています）',
    prompts)

toc = ''.join(f'<a href="#{sid}"><span>{num}</span>{e(t)}</a>' for sid, num, t in SECTIONS)

HTML = f'''<meta charset="UTF-8">
<title>StrengthPath 文言集</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zen+Old+Mincho:wght@600;700&family=Noto+Sans+JP:wght@400;500;700&display=swap">
<style>
:root{{
  --paper:#FBF8F2; --card:#FFFFFF; --quiet:#F4EFE5; --ink:#2A2622; --dim:#867C6E;
  --line:#E5DCCC; --acc:#8A7358; --acc2:#5E9E9E; --shadow:0 1px 3px rgba(90,70,40,.06);
}}
@media (prefers-color-scheme:dark){{
  :root:not([data-theme="light"]){{
    --paper:#1A1917; --card:#232120; --quiet:#201E1C; --ink:#EDE7DC; --dim:#9A9186;
    --line:#38342E; --acc:#C4A47C; --acc2:#7FBFBF; --shadow:0 1px 3px rgba(0,0,0,.3);
  }}
}}
:root[data-theme="dark"]{{
  --paper:#1A1917; --card:#232120; --quiet:#201E1C; --ink:#EDE7DC; --dim:#9A9186;
  --line:#38342E; --acc:#C4A47C; --acc2:#7FBFBF; --shadow:0 1px 3px rgba(0,0,0,.3);
}}
*{{box-sizing:border-box;margin:0;padding:0}}
html{{line-break:strict;word-break:normal}}
body{{background:var(--paper);color:var(--ink);
  font-family:"Noto Sans JP",-apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif;
  font-size:15px;line-height:1.9;-webkit-font-smoothing:antialiased}}
h1,h2,h3,p,li,dt,dd,.lead{{word-break:auto-phrase}}

.wrap{{display:grid;grid-template-columns:1fr;max-width:1140px;margin:0 auto;padding:0 20px}}
@media(min-width:920px){{ .wrap{{grid-template-columns:212px 1fr;gap:44px;padding:0 28px}} }}

header.top{{grid-column:1/-1;padding:52px 0 30px;border-bottom:2px solid var(--ink)}}
header.top h1{{font-family:"Zen Old Mincho",serif;font-size:31px;font-weight:700;
  letter-spacing:.02em;line-height:1.4;text-wrap:balance}}
header.top .sub{{color:var(--dim);font-size:14px;margin-top:9px;max-width:34em}}
header.top .meta{{display:flex;flex-wrap:wrap;gap:7px;margin-top:18px}}
header.top .meta span{{font-size:11.5px;font-weight:700;color:var(--dim);background:var(--quiet);
  border:1px solid var(--line);border-radius:99px;padding:4px 12px;
  font-variant-numeric:tabular-nums}}

nav.toc{{position:sticky;top:0;z-index:5;background:var(--paper);
  padding:12px 0;border-bottom:1px solid var(--line);
  display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}}
nav.toc::-webkit-scrollbar{{display:none}}
nav.toc a{{flex:0 0 auto;font-size:12.5px;font-weight:500;color:var(--dim);text-decoration:none;
  padding:6px 12px;border-radius:99px;border:1px solid var(--line);white-space:nowrap;
  display:flex;align-items:center;gap:6px;transition:color .15s,border-color .15s}}
nav.toc a span{{font-family:"Zen Old Mincho",serif;color:var(--acc);font-size:13px}}
nav.toc a:hover,nav.toc a:focus-visible{{color:var(--ink);border-color:var(--acc)}}
@media(min-width:920px){{
  nav.toc{{position:sticky;top:26px;align-self:start;flex-direction:column;gap:1px;
    border:0;padding:34px 0 0;overflow:visible;max-height:calc(100vh - 60px)}}
  nav.toc a{{border:0;padding:7px 10px;border-left:2px solid var(--line);border-radius:0}}
  nav.toc a:hover,nav.toc a:focus-visible{{border-left-color:var(--acc);background:var(--quiet)}}
}}

main{{padding:8px 0 90px;min-width:0}}
section{{padding-top:46px;scroll-margin-top:64px}}
@media(min-width:920px){{ section{{scroll-margin-top:26px}} }}
section h2{{font-family:"Zen Old Mincho",serif;font-size:24px;font-weight:700;
  display:flex;align-items:baseline;gap:12px;padding-bottom:11px;
  border-bottom:1px solid var(--line);text-wrap:balance}}
section h2 .num{{color:var(--acc);font-size:22px}}
.lead{{color:var(--dim);font-size:14px;margin:14px 0 4px;max-width:40em}}
.lead b{{color:var(--ink);font-weight:700}}
h3.sub{{font-family:"Zen Old Mincho",serif;font-size:17px;margin:32px 0 12px;
  display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}}
h3.sub .goal,h3.sub .count{{font-family:"Noto Sans JP",sans-serif;font-size:12px;
  font-weight:500;color:var(--dim)}}

.grid{{display:grid;gap:12px;margin-top:14px}}
@media(min-width:640px){{ .grid{{grid-template-columns:repeat(2,1fr)}} }}
.card{{background:var(--card);border:1px solid var(--line);border-radius:12px;
  padding:17px 19px;box-shadow:var(--shadow)}}
.card.quiet{{background:var(--quiet);box-shadow:none}}
.card.small{{padding:14px 16px}}
.card h3{{font-size:16.5px;font-weight:700;display:flex;align-items:baseline;
  gap:9px;flex-wrap:wrap;margin-bottom:5px}}
.card .cat{{font-size:11.5px;font-weight:500;color:var(--dim)}}
.card p{{font-size:14px;margin-bottom:9px}}
.card p:last-child{{margin-bottom:0}}
.card ul{{margin-left:1.15em;font-size:14px}}
.card ul li{{margin-bottom:4px}}
.catch{{color:var(--acc);font-weight:700}}
.rx{{background:var(--quiet);border-left:2px solid var(--acc);border-radius:0 8px 8px 0;
  padding:11px 14px;font-size:13.5px}}
.rx b{{display:block;font-size:11px;letter-spacing:.08em;color:var(--acc);margin-bottom:2px}}
.chips{{display:flex;flex-wrap:wrap;gap:5px}}
.chips span{{font-size:12px;background:var(--quiet);border:1px solid var(--line);
  border-radius:99px;padding:3px 10px;color:var(--dim)}}
.w{{font-size:11.5px;color:var(--dim);border-top:1px dashed var(--line);padding-top:9px;margin-top:11px}}
.url{{font-size:11.5px;color:var(--acc2);word-break:break-all;font-family:ui-monospace,monospace}}
.note{{font-size:11.5px;color:var(--dim);margin-top:9px}}

dl.rows{{display:grid;grid-template-columns:1fr;gap:2px;margin-top:11px}}
dl.rows dt{{font-size:11px;font-weight:700;letter-spacing:.07em;color:var(--acc);margin-top:9px}}
dl.rows dd{{font-size:13.5px;line-height:1.85}}
dl.voice dt{{color:var(--acc2)}}
.len{{display:inline-block;font-size:10px;color:var(--dim);margin-left:7px;
  font-variant-numeric:tabular-nums;vertical-align:.15em;opacity:.65}}

ol.qs{{list-style:none;counter-reset:q;margin-top:14px;
  display:grid;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:10px;overflow:hidden}}
ol.qs li{{counter-increment:q;background:var(--card);padding:11px 15px 11px 46px;
  position:relative;font-size:14px}}
ol.qs li::before{{content:counter(q);position:absolute;left:15px;top:11px;
  font-size:11.5px;color:var(--dim);font-variant-numeric:tabular-nums}}
.tag{{display:inline-block;font-size:10.5px;font-weight:700;color:var(--acc);
  background:var(--quiet);border-radius:4px;padding:1px 7px;margin-right:8px}}
.tag.t-style{{color:var(--acc2)}}
.tag.t-time,.tag.t-give{{color:var(--acc2)}}
.scale{{font-size:12.5px;color:var(--dim);margin-top:11px}}
.tips{{margin:11px 0 0 1.15em;font-size:13.5px}}
.cta{{font-size:12px;color:var(--dim);border-top:1px dashed var(--line);padding-top:9px;margin-top:11px}}
.common{{background:var(--quiet);border-radius:9px;padding:11px 15px;font-size:14px;margin-top:6px}}
.common b{{font-size:11px;letter-spacing:.07em;color:var(--acc);display:block}}
.gate-ready{{border-left:3px solid var(--acc2)}}
.gate-time{{border-left:3px solid var(--acc)}}
.gate-other{{border-left:3px solid var(--dim)}}

pre{{background:var(--quiet);border:1px solid var(--line);border-radius:9px;
  padding:14px 16px;font-size:12px;line-height:1.75;white-space:pre-wrap;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow-x:auto;margin-top:11px}}

footer{{grid-column:1/-1;border-top:1px solid var(--line);margin-top:60px;
  padding:26px 0 60px;font-size:12px;color:var(--dim);line-height:1.9}}
a{{color:var(--acc2)}}
:focus-visible{{outline:2px solid var(--acc);outline-offset:2px}}

ol.qs.pairs li{{padding:13px 15px}}
.pa,.pb{{font-weight:700;font-size:14.5px}}
.pv{{color:var(--dim);font-size:12px;margin:0 9px}}
.pw{{display:block;font-size:11px;color:var(--dim);margin-top:3px}}
.opt{{font-size:10px;color:var(--acc2);font-style:normal;margin-left:8px;
  border:1px solid var(--line);border-radius:99px;padding:1px 7px}}
.pickq{{font-size:14px;font-weight:700;margin:16px 0 8px}}
ul.picks{{list-style:none;display:grid;gap:1px;background:var(--line);
  border:1px solid var(--line);border-radius:10px;overflow:hidden}}
ul.picks li{{background:var(--card);padding:11px 15px;font-size:14px}}
@media print{{ nav.toc{{display:none}} .wrap{{grid-template-columns:1fr}} section{{break-inside:avoid}} }}
</style>

<div class="wrap">
<header class="top">
  <h1>StrengthPath 文言集</h1>
  <p class="sub">アプリに出てくる文章を、ぜんぶ書き出したものです。画面を触らずに内容だけ確認できます。<code></code></p>
  <div class="meta">
    <span>必須 {D['GATE_CORE'] + len(D['Q_PAIR'])//2 + 1}問</span><span>追加 {len(D['Q_GATE']) - D['GATE_CORE'] + len(D['Q_PAIR'])//2 + 1}問</span>
    <span>持ち味 {len(D['TRAITS'])}種</span>
    <span>進みグセ {len(D['STYLES'])}種</span><span>道 {len(D['TYPES'])}種</span>
    <span>副業 {len(D['JOBS'])}コ</span><span>やること 9つ×{len(D['TYPES'])}</span>
    <span>AI文章 {len(P)}種</span>
  </div>
</header>
<nav class="toc">{toc}</nav>
<main>
{S1}{S2}{S3}{S4}{S5}{S6}{S7}{S8}{S9}{S10}
</main>
<footer>
<p><b>言葉づかいの決めごと</b>　①相手を否定しない（「動けない」「原因」「弱み」は書かない）　②まず肯定してから軽く提案する　③頑張らせない（どこからでも「今日はここまで」に逃げられる）　④一度に出すのは1つだけ</p>
<p style="margin-top:12px">副業カタログの分類の枠組みは、リベラルアーツ大学「AI時代に対応 おすすめの副業19選＋番外編」を参考にしています。解説文・最初の一歩・持ち味との対応づけは、すべて本ツールの独自作成です。</p>
<p style="margin-top:12px">持ち味・進みグセ・道の分類は、副業での動きやすさに絞った独自のものです。ストレングスファインダー®／CliftonStrengths®（Gallup社の登録商標）とは無関係で、同社の資質名・解説文は使用していません。</p>
<p style="margin-top:12px">お金まわりの案内は選択肢の紹介であり、投資助言や特定の金融商品の推奨ではありません。</p>
</footer>
</div>
'''

out = ROOT / 'dist' / 'review.html'
out.parent.mkdir(exist_ok=True)
out.write_text(HTML, encoding='utf-8')
print(f'書き出し: {out.relative_to(ROOT)}  {out.stat().st_size/1024:.0f}KB  / {len(SECTIONS)}節')

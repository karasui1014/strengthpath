#!/usr/bin/env python3
"""StrengthPath を1ファイルのHTMLに束ねる。
   画像はbase64で埋め込み、Service Worker登録は外す。
   共有URL（Artifact）やメール添付など、サーバーを立てずに配る用。
   実行: python3 tools/bundle.py  →  dist/strengthpath.html"""
import base64, io, os, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
read = lambda p: (ROOT / p).read_text(encoding='utf-8')

# --- 画像を data URI に ---
names = ['normal', 'think', 'surprised', 'idea', 'happy', 'wink', 'cat']
srcs = {}
for n in names:
    b = (ROOT / f'assets/akari/{n}.png').read_bytes()
    srcs[n] = 'data:image/png;base64,' + base64.b64encode(b).decode()
src_map = 'const AKARI_SRC = {\n' + ',\n'.join(f"  {n}: '{srcs[n]}'" for n in names) + '\n};\n'

# --- akari.js を埋め込み画像版に ---
akari = read('assets/akari.js')
akari = akari.replace('src="./assets/akari/${m}.png"', 'src="${AKARI_SRC[m]}"')
akari = akari.replace('src="./assets/akari/cat.png"', 'src="${AKARI_SRC.cat}"')
akari = re.sub(r'function akariImgProbe\(\)[\s\S]*?\n\}',
               'function akariImgProbe() { /* 画像は埋め込み済みなので先読み不要 */ }', akari)
akari = src_map + akari

# --- app.js から Service Worker 登録を外す ---
app = read('assets/app.js')
app = re.sub(r"/\* ローカル開発中はSWを登録しない[\s\S]*?\n\}\n?$",
             "/* 単体配布版では Service Worker を使わない */\n", app)

# --- 単体配布版はダウンロードが使えない環境があるので、書き出しをコピーに差し替える ---
app = app.replace(
    """  on('[data-export]', 'click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }));
    a.download = `StrengthPath_${today()}.json`; a.click(); URL.revokeObjectURL(a.href);
  });""",
    """  on('[data-export]', 'click', async e => {
    const txt = JSON.stringify(S, null, 2);
    try { await navigator.clipboard.writeText(txt); }
    catch (_) {
      const ta = document.createElement('textarea');
      ta.value = txt; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
    }
    e.currentTarget.textContent = 'コピーしました';
    setTimeout(() => { e.currentTarget.textContent = '書き出す'; }, 1600);
    toast('メモ帳などに貼って保存してください。', 'idea');
  });""")
app = app.replace('<button class="btn ghost" data-export="1">書き出す</button>',
                  '<button class="btn ghost" data-export="1">書き出す</button>')
app = app.replace('この端末の中だけに保存されています。たまに書き出しておくと安心です。',
                  'この端末の中だけに保存されています。「書き出す」でデータをコピーできます。')

# --- CSS：閲覧側のテーマ指定(data-theme)にも追従させる ---
css = read('assets/style.css')
css = css.replace('@media (prefers-color-scheme:dark){\n  :root[data-dark="auto"]{',
                  '@media (prefers-color-scheme:dark){\n  :root[data-dark="auto"]:not([data-theme="light"]){')
css += '''
/* 単体配布版：閲覧環境が data-theme を指定してきたら、それに合わせる */
:root[data-dark="auto"][data-theme="dark"]{
  --bg:#1B1A18; --card:#252320; --soft:#211F1D; --line:#38342E;
  --fg:#EDE7DC; --dim:#9A9186; --shadow:0 2px 16px rgba(0,0,0,.32); color-scheme:dark;
}
'''

html = f'''<meta charset="UTF-8">
<title>StrengthPath</title>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<style>
{css}
</style>

<div id="topbar"></div>
<div id="app"><main id="view"></main></div>
<nav id="nav"></nav>

<script>
document.documentElement.setAttribute('data-dark', 'auto');
{read('assets/data.js')}
{akari}
{app}
</script>
'''

out = ROOT / 'dist' / 'strengthpath.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding='utf-8')
kb = out.stat().st_size / 1024
print(f'書き出し: {out.relative_to(ROOT)}  {kb:.0f}KB')

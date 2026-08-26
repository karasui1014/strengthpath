/* 燈月悠（あかり つくよ）— 公式キャラクター素材
   assets/akari/*.png（背景透過・256px）を表示する。
   差し替えるときは同名・同サイズのPNGを置くだけでよい。 */

const AKARI_MOODS = ['normal', 'think', 'surprised', 'idea', 'happy', 'wink'];

function akariTag(mood, size) {
  const m = AKARI_MOODS.includes(mood) ? mood : 'normal';
  const s = size || 96;
  return `<img class="akari" src="./assets/akari/${m}.png" width="${s}" height="${s}"
    alt="燈月悠" loading="lazy" decoding="async">`;
}

/* 相棒のシャム猫 */
function catTag(size) {
  const s = size || 40;
  return `<img class="akari-cat" src="./assets/akari/cat.png" width="${s}" height="${s}"
    alt="" aria-hidden="true" loading="lazy" decoding="async">`;
}
const catSVG = catTag;   // 旧名の互換

/* 先読み（表情を切り替えたときにチラつかせない） */
function akariImgProbe() {
  AKARI_MOODS.concat(['cat']).forEach(n => { new Image().src = `./assets/akari/${n}.png`; });
}

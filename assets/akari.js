/* 燈月悠（あかり つくよ）— SVGアバター
   ※ assets/akari/face.png 等の画像を置くと自動でそちらが優先されます（akariImg参照） */

const AK = {
  hat: '#C4A47C', hatTop: '#CDB088', band: '#8A7358',
  hair: '#3B3B40', hairLit: '#4A4A50', tip: '#5E9E9E',
  skin: '#FAE7D8', skinSh: '#EBD2C0',
  coat: '#E2D5BF', coatSh: '#CDBBA0', coatLine: '#B9A386',
  glass: '#B08F63', eye: '#4E9C9C', dark: '#33333A', blush: '#E4A29C'
};

function akariSVG(mood, size) {
  mood = mood || 'normal';
  size = size || 96;
  const e = eyes(mood), m = mouth(mood);
  return `<svg class="akari" viewBox="0 0 200 200" width="${size}" height="${size}" role="img" aria-label="燈月悠">
  <defs>
    <clipPath id="ak-crown"><path d="M59,66 C59,35 75,22 100,22 C125,22 141,35 141,66 Z"/></clipPath>
  </defs>
  <!-- 髪（後ろ） -->
  <path fill="${AK.hair}" d="M44,112 C44,68 68,50 100,50 C132,50 156,68 156,112 L156,150 L44,150 Z"/>
  <!-- コート -->
  <path fill="${AK.coat}" d="M30,200 L30,181 C30,170 43,163 62,158 L100,149 L138,158
    C157,163 170,170 170,181 L170,200 Z"/>
  <path fill="${AK.coatSh}" d="M100,149 L84,159 L100,178 L116,159 Z"/>
  <path fill="${AK.coatSh}" d="M62,158 L84,159 L74,200 L58,200 Z" opacity=".55"/>
  <path fill="${AK.coatSh}" d="M138,158 L116,159 L126,200 L142,200 Z" opacity=".55"/>
  <!-- 首 -->
  <path fill="${AK.skinSh}" d="M89,130 L111,130 L111,152 L89,152 Z"/>
  <!-- サイドの髪（コートの手前に落ちる） -->
  <path fill="${AK.hair}" d="M62,84 C49,108 45,140 48,163 C49,172 57,178 66,177 C74,176 78,171 79,163 C80,136 78,108 76,86 Z"/>
  <path fill="${AK.hair}" d="M138,84 C151,108 155,140 152,163 C151,172 143,178 134,177 C126,176 122,171 121,163 C120,136 122,108 124,86 Z"/>
  <path fill="${AK.tip}" d="M46,137 C45,149 45,157 48,163 C49,172 57,178 66,177 C74,176 78,171 79,163 C79,153 79,145 80,137 C70,145 55,145 46,137 Z"/>
  <path fill="${AK.tip}" d="M154,137 C155,149 155,157 152,163 C151,172 143,178 134,177 C126,176 122,171 121,163 C121,153 121,145 120,137 C130,145 145,145 154,137 Z"/>
  <!-- 顔 -->
  <ellipse cx="100" cy="106" rx="39" ry="42" fill="${AK.skin}"/>
  <!-- 前髪 -->
  <path fill="${AK.hair}" d="M58,102 C58,68 77,51 100,51 C123,51 142,68 142,102
    C137,85 126,76 115,81 C108,68 90,66 80,79 C70,79 61,89 58,102 Z"/>
  <path fill="${AK.hairLit}" opacity=".45" d="M79,59 C90,55 106,56 116,62 C104,63 90,64 79,59 Z"/>
  <!-- 帽子 -->
  <ellipse cx="100" cy="67" rx="74" ry="17" fill="${AK.hat}"/>
  <ellipse cx="100" cy="64" rx="74" ry="16" fill="${AK.hatTop}"/>
  <path fill="${AK.hatTop}" d="M59,66 C59,35 75,22 100,22 C125,22 141,35 141,66 Z"/>
  <g clip-path="url(#ak-crown)"><rect x="52" y="49" width="96" height="16" fill="${AK.band}"/></g>
  <ellipse cx="100" cy="31" rx="17" ry="6" fill="${AK.hat}" opacity=".5"/>
  <!-- ほお -->
  <ellipse cx="66" cy="120" rx="7.5" ry="4" fill="${AK.blush}" opacity=".42"/>
  <ellipse cx="134" cy="120" rx="7.5" ry="4" fill="${AK.blush}" opacity=".42"/>
  ${e}
  <g fill="none" stroke="${AK.glass}" stroke-width="3.1">
    <circle cx="81" cy="108" r="15.5"/><circle cx="119" cy="108" r="15.5"/>
    <path d="M96.5,107 L103.5,107"/><path d="M65.5,104 L54,100"/><path d="M134.5,104 L146,100"/>
  </g>
  ${m}
</svg>`;
}

function eyes(mood) {
  const open = (cx, dx) => `<ellipse cx="${cx}" cy="109" rx="6.8" ry="9" fill="${AK.dark}"/>
    <ellipse cx="${cx + (dx || 0)}" cy="${109 + (dx ? -1 : 1)}" rx="4.8" ry="6.8" fill="${AK.eye}"/>
    <circle cx="${cx + (dx || 0) - 1.8}" cy="106" r="2.5" fill="#fff"/>`;
  const arc = (cx) => `<path d="M${cx - 8},111 Q${cx},101 ${cx + 8},111" stroke="${AK.dark}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
  if (mood === 'happy') return arc(81) + arc(119);
  if (mood === 'wink')  return open(81) + arc(119);
  if (mood === 'think') return open(81, 2.5) + open(119, 2.5);
  return open(81) + open(119);
}

function mouth(mood) {
  if (mood === 'happy') return `<path d="M92,129 Q100,139 108,129" stroke="${AK.dark}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  if (mood === 'think') return `<path d="M95,131 L106,130" stroke="${AK.dark}" stroke-width="2.5" stroke-linecap="round"/>`;
  return `<path d="M94,129 Q100,134 106,129" stroke="${AK.dark}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
}

/* シャム猫（相棒） */
function catSVG(size) {
  size = size || 40;
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">
    <ellipse cx="50" cy="72" rx="26" ry="24" fill="#E6DCCB"/>
    <path d="M28,44 L24,22 L42,34 Z" fill="#E6DCCB"/><path d="M72,44 L76,22 L58,34 Z" fill="#E6DCCB"/>
    <path d="M29,42 L26,27 L40,36 Z" fill="#6B584A"/><path d="M71,42 L74,27 L60,36 Z" fill="#6B584A"/>
    <ellipse cx="50" cy="44" rx="24" ry="21" fill="#F0E7D8"/>
    <ellipse cx="50" cy="52" rx="14" ry="11" fill="#7A6555" opacity=".55"/>
    <ellipse cx="41" cy="42" rx="5" ry="6" fill="#4E9C9C"/><ellipse cx="59" cy="42" rx="5" ry="6" fill="#4E9C9C"/>
    <circle cx="39.5" cy="40" r="1.8" fill="#fff"/><circle cx="57.5" cy="40" r="1.8" fill="#fff"/>
    <path d="M47,51 L53,51 L50,55 Z" fill="#B98C86"/>
    <path d="M76,80 Q92,74 88,58" stroke="#7A6555" stroke-width="7" fill="none" stroke-linecap="round"/>
    <ellipse cx="50" cy="63" rx="11" ry="3" fill="#D9A441"/>
  </svg>`;
}

/* 画像が置かれていればそれを優先する */
let AKARI_IMG = null;
/* assets/akari/face.png を置くと、SVGの代わりにその画像が使われます */
function akariImgProbe() {
  const i = new Image();
  i.onload = () => { AKARI_IMG = './assets/akari/face.png'; document.dispatchEvent(new Event('akari-img')); };
  i.src = './assets/akari/face.png';
}
function akariTag(mood, size) {
  if (AKARI_IMG) return `<img class="akari" src="${AKARI_IMG}" width="${size || 96}" alt="燈月悠">`;
  return akariSVG(mood, size);
}

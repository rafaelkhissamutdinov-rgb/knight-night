// Живой свет (v0.62, решение владельца): сцена рисуется в 2D-холст как раньше, затем WebGL-проход освещает её —
// факелы, костры, камины и портал по картам нормалей (Найт объёмный: броня ловит блики), свет ступенями,
// пыль в воздухе, «тёплое» настроение. Нет WebGL — игра показывает обычную картинку.

const VS = `attribute vec2 p; varying vec2 uv; void main(){ uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
const MAXL = 12;
const FS = `precision mediump float;
varying vec2 uv;
uniform sampler2D color, normals;
uniform vec2 res;
uniform vec4 lp[${MAXL}];   // x, y (пиксели экрана, y вниз), высота, радиус
uniform vec4 lc[${MAXL}];   // цвет, сила
uniform int count;
uniform vec3 ambient;
uniform float steps;
void main() {
  vec2 t = vec2(uv.x, 1.0 - uv.y);
  vec4 a = texture2D(color, t);
  vec3 n = normalize(texture2D(normals, t).rgb * 2.0 - 1.0);
  vec2 px = t * res;
  vec3 light = ambient;
  vec3 glow = vec3(0.0);
  for (int i = 0; i < ${MAXL}; i++) {
    if (i >= count) break;
    vec2 d = lp[i].xy - px;
    float dist = length(d);
    float att = clamp(1.0 - dist / lp[i].w, 0.0, 1.0);
    att *= att;
    vec3 L = normalize(vec3(d.x, -d.y, lp[i].z));
    light += lc[i].rgb * lc[i].a * max(dot(n, L), 0.0) * att;
    float g = clamp(1.0 - dist / (lp[i].w * 0.4), 0.0, 1.0);
    glow += lc[i].rgb * lc[i].a * g * g * g * 0.08;
  }
  if (steps > 0.5) {
    // ступени по яркости (цвет света сохраняется — без цветных колец)
    float l = dot(light, vec3(0.299, 0.587, 0.114));
    light *= (floor(l * 7.0 + 0.5) / 7.0) / max(l, 0.001);
  }
  // пламя и раскалённое светится само
  float e = step(0.9, a.r) * step(0.5, a.g) * step(a.g, a.r * 0.72) * step(a.b, a.r * 0.3);   // только оранжевое пламя (золото — нет)
  vec3 col = mix(a.rgb * light + glow, a.rgb * 1.25 + glow, e);
  gl_FragColor = vec4(col, 1.0);
}`;


// ---------- новый свет (v1.06, владелец: «более крутые шейдеры света») ----------
// Проходы: 1) освещение — как раньше + блики на металле (броня, клинки ловят огонь) + холодные тени и тёплый свет;
// 2) яркое — в четверть экрана; 3–4) размытие (свечение); 5) кадр: свечение крупными пикселями, лучи от огней
// сквозь пыль, лёгкая виньетка. Ступени света сохраняются (выбор владельца).
const LIT_FS = `precision mediump float;
varying vec2 uv;
uniform sampler2D color, normals;
uniform vec2 res;
uniform vec4 lp[${MAXL}];
uniform vec4 lc[${MAXL}];
uniform int count;
uniform vec3 ambient;
uniform float steps;
void main() {
  vec2 t = vec2(uv.x, 1.0 - uv.y);
  vec4 a = texture2D(color, t);
  vec3 n = normalize(texture2D(normals, t).rgb * 2.0 - 1.0);
  vec2 px = t * res;
  vec3 light = ambient;
  vec3 glow = vec3(0.0);
  vec3 spec = vec3(0.0);
  float mx = max(a.r, max(a.g, a.b)), mn = min(a.r, min(a.g, a.b));
  float sat = mx > 0.001 ? (mx - mn) / mx : 0.0;
  float metal = (1.0 - smoothstep(0.12, 0.35, sat)) * smoothstep(0.32, 0.75, mx) * step(n.z, 0.985);   // серое, светлое, объёмное — металл
  for (int i = 0; i < ${MAXL}; i++) {
    if (i >= count) break;
    vec2 d = lp[i].xy - px;
    float dist = length(d);
    float att = clamp(1.0 - dist / lp[i].w, 0.0, 1.0);
    att *= att;
    vec3 L = normalize(vec3(d.x, -d.y, lp[i].z));
    float lam = max(dot(n, L), 0.0);
    light += lc[i].rgb * lc[i].a * lam * att;
    vec3 Hh = normalize(L + vec3(0.0, 0.0, 1.0));
    spec += lc[i].rgb * lc[i].a * pow(max(dot(n, Hh), 0.0), 18.0) * att * metal * 1.6;
    float g = clamp(1.0 - dist / (lp[i].w * 0.4), 0.0, 1.0);
    glow += lc[i].rgb * lc[i].a * g * g * g * 0.08;
  }
  float l = dot(light, vec3(0.299, 0.587, 0.114));
  if (steps > 0.5) light *= (floor(l * 7.0 + 0.5) / 7.0) / max(l, 0.001);
  if (steps > 0.5) spec = floor(spec * 4.0 + 0.35) / 4.0;            // блик — ступенькой, пиксельно
  // тени холоднее, свет теплее (как в кино): чем темнее место, тем синее
  vec3 cool = vec3(0.86, 0.92, 1.12);
  light *= mix(cool, vec3(1.0), smoothstep(0.15, 0.75, l));
  float e = step(0.9, a.r) * step(0.5, a.g) * step(a.g, a.r * 0.72) * step(a.b, a.r * 0.3);   // пламя светится само
  float magic = step(0.75, a.b) * step(a.r * 1.25, a.b) * step(0.55, a.g);                     // руны, портал, призраки
  vec3 col = mix(a.rgb * light + glow + spec, a.rgb * 1.25 + glow, e);
  gl_FragColor = vec4(col, clamp(e + magic * 0.8, 0.0, 1.0));
}`;
const BRIGHT_FS = `precision mediump float;
varying vec2 uv;
uniform sampler2D src;
uniform vec2 texel;
void main() {
  vec3 c = vec3(0.0); float em = 0.0;
  for (int x = 0; x < 2; x++) for (int y = 0; y < 2; y++) {
    vec4 s = texture2D(src, uv + (vec2(float(x), float(y)) - 0.5) * texel);
    float l = dot(s.rgb, vec3(0.299, 0.587, 0.114));
    c += s.rgb * max(smoothstep(0.62, 0.95, l) * 0.8, s.a * 1.6); em += s.a;
  }
  gl_FragColor = vec4(c * 0.25, 1.0);
}`;
const BLUR_FS = `precision mediump float;
varying vec2 uv;
uniform sampler2D src;
uniform vec2 dir;
void main() {
  vec3 c = texture2D(src, uv).rgb * 0.227;
  c += (texture2D(src, uv + dir * 1.385).rgb + texture2D(src, uv - dir * 1.385).rgb) * 0.316;
  c += (texture2D(src, uv + dir * 3.231).rgb + texture2D(src, uv - dir * 3.231).rgb) * 0.070;
  gl_FragColor = vec4(c, 1.0);
}`;
const RAYS = 4;
const COMP_FS = `precision mediump float;
varying vec2 uv;
uniform sampler2D lit, bloom;
uniform vec2 res;
uniform vec4 rl[${RAYS}];    // лучи: x, y (пиксели, y вниз), радиус, сила
uniform vec3 rc[${RAYS}];
uniform int rays;
uniform float steps, bloomK, time;
void main() {
  vec2 t = vec2(uv.x, 1.0 - uv.y);
  vec2 px = t * res;
  vec3 col = texture2D(lit, vec2(t.x, 1.0 - t.y)).rgb;
  // свечение — крупными пикселями (2×2 мира), чтобы не мылило пиксель-арт
  vec2 bp = (floor(px / 4.0) * 4.0 + 2.0) / res;
  vec3 b = texture2D(bloom, vec2(bp.x, 1.0 - bp.y)).rgb;
  // ступени — по яркости, оттенок сохраняется (иначе цветные кольца)
  float bl = dot(b, vec3(0.299, 0.587, 0.114));
  if (steps > 0.5 && bl > 0.001) b *= (floor(bl * 6.0 + 0.3) / 6.0) / bl;
  col += b * bloomK;
  // ореол и лучи от огней: свет рассеивается в пыльном воздухе; лучи медленно колышутся (пиксельно — клетками 2×2)
  vec3 ray = vec3(0.0);
  vec2 pc = floor(px / 4.0) * 4.0 + 2.0;
  for (int i = 0; i < ${RAYS}; i++) {
    if (i >= rays) break;
    vec2 d = pc - rl[i].xy;
    float dist = length(d);
    if (dist > rl[i].z) continue;
    float fall = 1.0 - dist / rl[i].z;
    float ang = atan(d.y, d.x);
    float streak = 0.5 + 0.5 * sin(ang * 9.0 + time * 0.5 + float(i) * 1.7) * sin(ang * 5.0 - time * 0.35);
    ray += rc[i] * rl[i].w * (pow(fall, 3.0) * 0.2 + pow(fall, 2.0) * streak * 0.07);
  }
  float rlum = dot(ray, vec3(0.299, 0.587, 0.114));
  if (steps > 0.5 && rlum > 0.001) ray *= (floor(rlum * 10.0 + 0.3) / 10.0) / rlum;
  col += ray;
  // виньетка: края кадра чуть темнее — взгляд к центру
  vec2 v = (t - 0.5) * vec2(1.05, 1.35);
  col *= mix(1.0, 0.8, smoothstep(0.35, 0.95, length(v)));
  gl_FragColor = vec4(col, 1.0);
}`;

export function createLighting(colorCanvas) {
  const W = colorCanvas.width, H = colorCanvas.height, QW = W >> 2, QH = H >> 2;
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  out.className = 'lit';
  const gl = out.getContext('webgl', { premultipliedAlpha: false, antialias: false, preserveDrawingBuffer: false });
  if (!gl) return null;
  // ресурсы GL: создаются заново, если браузер потерял контекст и вернул его (v0.71)
  let P = {}, tColor, tNorm, A, B, C, plusOK = false;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const program = fs => {
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(pr, 0, 'p');
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    const cache = {};
    pr.u = n => (n in cache ? cache[n] : (cache[n] = gl.getUniformLocation(pr, n)));
    return pr;
  };
  const tex = (unit, w, h, linear) => {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    const f = linear ? gl.LINEAR : gl.NEAREST;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (w) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return t;
  };
  const target = (w, h) => {
    const t = tex(5, w, h, true), f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!ok) throw new Error('fbo');
    return { t, f, w, h };
  };
  const setup = () => {
    try { P.basic = program(FS); } catch { return false; }
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    tColor = tex(0); tNorm = tex(1);
    // новый свет — если видеокарта не справится (нет текстур-целей), остаётся прежний
    try {
      P.lit = program(LIT_FS); P.bright = program(BRIGHT_FS); P.blur = program(BLUR_FS); P.comp = program(COMP_FS);
      A = target(W, H); B = target(QW, QH); C = target(QW, QH);
      plusOK = true;
    } catch { plusOK = false; }
    return true;
  };
  if (!setup()) return null;
  // контекст потерян (сбой видеокарты, сон, много вкладок): слой света замер бы поверх игры старым кадром —
  // вместо этого сразу показываем обычную картинку, а когда контекст вернётся — собираем шейдер заново
  let lost = false;
  out.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; api.off(); });
  out.addEventListener('webglcontextrestored', () => { P = {}; lost = !setup(); });

  // холст нормалей: всё плоское (смотрит на зрителя), спрайты дорисовывают свои нормали
  const normal = document.createElement('canvas');
  normal.width = W; normal.height = H;
  const nctx = normal.getContext('2d');
  nctx.imageSmoothingEnabled = false;

  const lightUniforms = (pr, lights, ambient, steps) => {
    const ls = lights.slice(0, MAXL);
    const lp = new Float32Array(MAXL * 4), lc = new Float32Array(MAXL * 4);
    ls.forEach((l, i) => { lp.set([l.x, l.y, l.z ?? 24, l.r], i * 4); lc.set([...l.color, l.power ?? 1], i * 4); });
    gl.uniform1i(pr.u('color'), 0); gl.uniform1i(pr.u('normals'), 1);
    gl.uniform2f(pr.u('res'), W, H);
    gl.uniform4fv(pr.u('lp'), lp); gl.uniform4fv(pr.u('lc'), lc);
    gl.uniform1i(pr.u('count'), ls.length);
    gl.uniform3f(pr.u('ambient'), ...ambient);
    gl.uniform1f(pr.u('steps'), steps ? 1 : 0);
  };
  const pass = (pr, dst, w, h) => {
    gl.useProgram(pr);
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.f : null);
    gl.viewport(0, 0, w, h);
  };
  const src = (unit, t) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); };

  colorCanvas.after(out);
  let on = false;
  const api = {
    normalCtx: nctx,
    plus: true,   // новый свет (тени, блики, свечение, лучи) — переключатель в паузе
    // начало кадра: нормали — плоские
    clearNormals() { nctx.setTransform(1, 0, 0, 1, 0, 0); nctx.fillStyle = 'rgb(128,128,255)'; nctx.fillRect(0, 0, W, H); },
    // lights: [{ x, y, z, r, color: [r,g,b], power }] в пикселях экрана; ambient — [r,g,b]
    draw(lights, ambient, steps, bloomK = 1) {
      if (lost || gl.isContextLost()) { lost = true; api.off(); return; }
      if (!on) { on = true; out.hidden = false; colorCanvas.classList.add('under-light'); }
      src(0, tColor); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, colorCanvas);
      src(1, tNorm); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, normal);
      if (!api.plus || !plusOK) {
        pass(P.basic, null, W, H); lightUniforms(P.basic, lights, ambient, steps);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        return;
      }
      src(2, null); src(3, null);
      // 1) освещение → A
      pass(P.lit, A, W, H); lightUniforms(P.lit, lights, ambient, steps);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      // 2) яркое → B (четверть экрана)
      pass(P.bright, B, QW, QH); src(2, A.t);
      gl.uniform1i(P.bright.u('src'), 2); gl.uniform2f(P.bright.u('texel'), 1 / W, 1 / H);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      // 3–4) размытие B → C → B
      pass(P.blur, C, QW, QH); src(2, B.t);
      gl.uniform1i(P.blur.u('src'), 2); gl.uniform2f(P.blur.u('dir'), 1 / QW, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      pass(P.blur, B, QW, QH); src(2, C.t);
      gl.uniform2f(P.blur.u('dir'), 0, 1 / QH);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      // 5) кадр: освещённое + свечение + лучи от самых сильных огней
      pass(P.comp, null, W, H); src(2, A.t); src(3, B.t);
      gl.uniform1i(P.comp.u('lit'), 2); gl.uniform1i(P.comp.u('bloom'), 3);
      gl.uniform2f(P.comp.u('res'), W, H);
      const big = lights.filter(l => (l.power ?? 1) > 0.3).sort((a, b) => b.r * (b.power ?? 1) - a.r * (a.power ?? 1)).slice(0, RAYS);
      const rl = new Float32Array(RAYS * 4), rc = new Float32Array(RAYS * 3);
      big.forEach((l, i) => { rl.set([l.x, l.y, l.r * 0.55, Math.min(1.3, l.power ?? 1)], i * 4); rc.set(l.color, i * 3); });
      gl.uniform4fv(P.comp.u('rl'), rl); gl.uniform3fv(P.comp.u('rc'), rc);
      gl.uniform1i(P.comp.u('rays'), big.length);
      gl.uniform1f(P.comp.u('steps'), steps ? 1 : 0);
      gl.uniform1f(P.comp.u('bloomK'), bloomK);
      gl.uniform1f(P.comp.u('time'), performance.now() / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    // показать обычную картинку (заставка, карта, тёмные комнаты)
    off() { if (on) { on = false; out.hidden = true; colorCanvas.classList.remove('under-light'); } },
  };
  return api;
}

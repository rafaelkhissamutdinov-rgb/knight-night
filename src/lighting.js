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
  if (steps > 0.5) light = floor(light * 7.0 + 0.5) / 7.0;
  // пламя и раскалённое светится само
  float e = step(0.85, a.r) * step(0.42, a.g) * step(a.b, 0.6) * step(0.3, a.r - a.b);
  vec3 col = mix(a.rgb * light + glow, a.rgb * 1.25 + glow, e);
  gl_FragColor = vec4(col, 1.0);
}`;

export function createLighting(colorCanvas) {
  const W = colorCanvas.width, H = colorCanvas.height;
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  out.className = 'lit';
  const gl = out.getContext('webgl', { premultipliedAlpha: false, antialias: false, preserveDrawingBuffer: false });
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  } catch { return null; }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(prog, n);
  const tex = unit => {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  const tColor = tex(0), tNorm = tex(1);
  gl.uniform1i(U('color'), 0); gl.uniform1i(U('normals'), 1);
  gl.uniform2f(U('res'), W, H);

  // холст нормалей: всё плоское (смотрит на зрителя), спрайты дорисовывают свои нормали
  const normal = document.createElement('canvas');
  normal.width = W; normal.height = H;
  const nctx = normal.getContext('2d');
  nctx.imageSmoothingEnabled = false;

  colorCanvas.after(out);
  let on = false;
  return {
    normalCtx: nctx,
    // начало кадра: нормали — плоские
    clearNormals() { nctx.setTransform(1, 0, 0, 1, 0, 0); nctx.fillStyle = 'rgb(128,128,255)'; nctx.fillRect(0, 0, W, H); },
    // lights: [{ x, y, z, r, color: [r,g,b], power }] в пикселях экрана; ambient — [r,g,b]
    draw(lights, ambient, steps) {
      if (!on) { on = true; out.hidden = false; colorCanvas.classList.add('under-light'); }
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tColor);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, colorCanvas);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tNorm);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, normal);
      const ls = lights.slice(0, MAXL);
      const lp = new Float32Array(MAXL * 4), lc = new Float32Array(MAXL * 4);
      ls.forEach((l, i) => { lp.set([l.x, l.y, l.z ?? 24, l.r], i * 4); lc.set([...l.color, l.power ?? 1], i * 4); });
      gl.uniform4fv(U('lp'), lp); gl.uniform4fv(U('lc'), lc);
      gl.uniform1i(U('count'), ls.length);
      gl.uniform3f(U('ambient'), ...ambient);
      gl.uniform1f(U('steps'), steps ? 1 : 0);
      gl.viewport(0, 0, W, H);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    // показать обычную картинку (заставка, карта, тёмные комнаты)
    off() { if (on) { on = false; out.hidden = true; colorCanvas.classList.remove('under-light'); } },
  };
}

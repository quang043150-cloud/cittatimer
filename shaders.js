/* Solvo Timer — GPU backgrounds. Full-screen WebGL fragment shaders that react to the timer:
   uEnergy (solving), uHold (holding to start), uReady, uWarn (late inspection), uPB, uPulse (shockwave). */
(function () {
  'use strict';
  const VERT = 'attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }';
  const HEAD = `
uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse;
uniform vec3 uA; uniform vec3 uB; uniform vec3 uC;
uniform float uEnergy; uniform float uHold; uniform float uReady; uniform float uWarn; uniform float uPB;
uniform vec4 uPulse;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec2 hash2(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 5; i++){ v += a * noise(p); p = m * p; a *= 0.5; } return v; }
vec3 pal(float t){ t = clamp(t, 0.0, 1.0); return t < 0.5 ? mix(uA, uB, t * 2.0) : mix(uB, uC, t * 2.0 - 1.0); }
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float aspect(){ return uRes.x / uRes.y; }
vec2 centred(vec2 uv){ return (uv - 0.5) * vec2(aspect(), 1.0); }
vec2 shockUV(vec2 uv){
  vec2 d = uv - uPulse.xy; d.x *= aspect();
  float r = length(d), ring = uPulse.z * 1.25;
  float k = smoothstep(0.09, 0.0, abs(r - ring)) * exp(-uPulse.z * 2.2) * uPulse.w;
  return uv - normalize(d + 1e-5) * k * 0.035 * vec2(1.0 / aspect(), 1.0);
}
float stars(vec2 frag, float density){ vec2 c = floor(frag / 2.0); float s = hash(c); return step(1.0 - density, s) * (0.45 + 0.55 * sin(uTime * 2.0 + s * 60.0)); }
vec3 post(vec3 col, vec2 uv){
  vec2 q = centred(uv); float v = smoothstep(1.3, 0.25, length(q));
  col *= mix(0.5, 1.0, v);
  col *= 1.0 + uEnergy * 0.16;
  col = mix(col, col * vec3(1.15, 0.5, 0.55), uHold * 0.45);
  col = mix(col, col * vec3(0.55, 1.35, 0.7) + vec3(0.0, 0.06, 0.02), uReady * 0.5);
  col += vec3(0.95, 0.12, 0.18) * uWarn * (1.0 - v) * (0.55 + 0.45 * sin(uTime * 9.0));
  col += vec3(1.0, 0.82, 0.35) * uPB * (0.13 + 0.17 * (1.0 - v));
  vec2 d = uv - uPulse.xy; d.x *= aspect();
  col += uC * smoothstep(0.05, 0.0, abs(length(d) - uPulse.z * 1.25)) * exp(-uPulse.z * 2.6) * uPulse.w * 0.5;
  col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) / 64.0;
  return col;
}
`;
  const S = [];
  const def = (id, name, frag, extra) => S.push(Object.assign({ id, name, gl: true, frag }, extra || {}));

  def('gl-nebula', 'Nebula Flow', `
void main(){
  vec2 uv = shockUV(gl_FragCoord.xy / uRes);
  vec2 p = centred(uv) * 2.4 + (uMouse - 0.5) * 0.25;
  float t = uTime * (0.045 + 0.11 * uEnergy);
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 3.8 * q + vec2(1.7, 9.2) + 1.4 * t), fbm(p + 3.8 * q + vec2(8.3, 2.8) - 1.1 * t));
  float f = fbm(p + 3.6 * r);
  vec3 col = pal(f * f * 1.7);
  col = mix(col, uC, clamp(dot(q, q) * 0.45, 0.0, 1.0) * 0.4);
  col *= 0.28 + 1.05 * f;
  col += uC * pow(max(f - 0.55, 0.0), 2.0) * 2.2;
  col += vec3(stars(gl_FragCoord.xy, 0.004)) * (1.0 - f);
  gl_FragColor = vec4(post(col, uv), 1.0);
}`);

  def('gl-aurora', 'Aurora Curtains', `
void main(){
  vec2 uv = shockUV(gl_FragCoord.xy / uRes); vec2 p = centred(uv);
  vec3 col = mix(uA * 0.5, uA * 1.1, uv.y * 0.9);
  col += vec3(stars(gl_FragCoord.xy, 0.006)) * smoothstep(0.0, 0.6, uv.y);
  float t = uTime * (0.12 + 0.35 * uEnergy);
  for (int i = 0; i < 4; i++){
    float fi = float(i);
    float x = p.x * (0.9 + fi * 0.22) + fi * 3.1 + (uMouse.x - 0.5) * 0.3;
    float base = -0.2 + fi * 0.08 + 0.24 * fbm(vec2(x * 0.9 + t * 0.4, fi * 7.3));
    float dy = p.y - base;
    float rays = 0.45 + 0.9 * fbm(vec2(x * 9.0 + t * 1.6, fi * 3.7));
    float a = smoothstep(-0.01, 0.03, dy) * exp(-max(dy, 0.0) * (3.2 - fi * 0.4)) * rays;
    vec3 c = mix(uB, uC, fi / 3.0) * (1.2 - fi * 0.15);
    col += c * a * 0.62;
  }
  col += uC * 0.07 * exp(-pow(p.y + 0.35, 2.0) * 10.0);
  gl_FragColor = vec4(post(col, uv), 1.0);
}`);

  def('gl-chrome', 'Liquid Chrome', `
float hf(vec2 p, float t){ return fbm(p * 1.1 + vec2(t, -0.7 * t) + 1.4 * vec2(fbm(p * 1.7 - t), fbm(p * 1.7 + vec2(3.1, 1.7) + t))); }
void main(){
  vec2 uv = shockUV(gl_FragCoord.xy / uRes); vec2 p = centred(uv) * 2.0 + (uMouse - 0.5) * 0.3;
  float t = uTime * (0.07 + 0.18 * uEnergy);
  float e = 0.012; float h0 = hf(p, t), hx = hf(p + vec2(e, 0.0), t), hy = hf(p + vec2(0.0, e), t);
  vec3 n = normalize(vec3((h0 - hx) / e * 0.55, (h0 - hy) / e * 0.55, 1.0));
  vec3 l = normalize(vec3(-0.45, 0.6, 0.65));
  float dif = max(dot(n, l), 0.0);
  float spe = pow(max(dot(reflect(-l, n), vec3(0.0, 0.0, 1.0)), 0.0), 40.0);
  vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);
  vec3 env = pal(0.5 + r.y * 0.6 + r.x * 0.25);
  vec3 col = env * (0.3 + 0.8 * dif) + vec3(1.0) * spe * 0.85 + uC * pow(1.0 - n.z, 1.5) * 0.7;
  col *= 0.75 + 0.35 * h0;
  gl_FragColor = vec4(post(col, uv), 1.0);
}`, { scale: 0.55 });

  def('gl-warp', 'Hyperdrive', `
void main(){
  vec2 uv = shockUV(gl_FragCoord.xy / uRes); vec2 p = centred(uv) + (uMouse - 0.5) * 0.12;
  float r = length(p), a = atan(p.y, p.x);
  float speed = 0.45 + 2.6 * uEnergy;
  float z = 0.32 / (r + 0.02) + uTime * speed;
  vec2 ring = vec2(cos(a), sin(a));
  float n = fbm(ring * 3.0 + vec2(z * 1.3, 0.0));
  float streak = pow(fbm(ring * 22.0 + vec2(z * 0.35, 0.0)), 3.0) * 4.0;
  vec3 col = pal(fract(z * 0.06) * 0.6 + n * 0.5) * (0.25 + n);
  col += uC * streak * smoothstep(0.05, 0.6, r) * (0.6 + uEnergy);
  col *= smoothstep(0.0, 0.25, r) * 0.9 + 0.1;
  col += mix(uB, vec3(1.0), 0.4) * 0.05 / (r + 0.04);
  gl_FragColor = vec4(post(col, uv), 1.0);
}`);

  def('gl-synth', 'Synthwave Drive', `
void main(){
  vec2 uv = shockUV(gl_FragCoord.xy / uRes); vec2 p = centred(uv);
  float hz = -0.06; vec3 col;
  if (p.y > hz) {
    col = mix(uC * 0.35 + uB * 0.4, uA * 0.8, smoothstep(hz, 0.55, p.y));
    col += vec3(stars(gl_FragCoord.xy, 0.005)) * smoothstep(0.15, 0.5, p.y);
    vec2 sp = p - vec2(0.0, 0.16); float sr = length(sp);
    float cut = step(0.5, fract((sp.y + uTime * 0.02) * 26.0)) + step(0.04, sp.y);
    float sun = smoothstep(0.235, 0.228, sr) * clamp(cut, 0.0, 1.0);
    vec3 sunCol = mix(uC, vec3(1.0, 0.92, 0.65), smoothstep(-0.2, 0.25, sp.y));
    col = mix(col, sunCol, sun);
    col += uC * 0.35 * exp(-sr * 3.5);
    float m = hz + 0.04 + 0.09 * fbm(vec2(p.x * 2.6 + 3.0, 0.5)) * smoothstep(0.9, 0.15, abs(p.x));
    col = mix(col, uA * 0.18, step(p.y, m));
  } else {
    float d = hz - p.y + 0.002;
    vec2 g = vec2(p.x / d * 1.5, 0.75 / d + uTime * (0.7 + 3.0 * uEnergy));
    vec2 c = abs(fract(g) - 0.5);
    float wx = 2.2 / (d * uRes.y), wy = 1.1 / (d * d * uRes.y);
    float line = max(smoothstep(min(wx, 0.5), 0.0, 0.5 - c.x), smoothstep(min(wy, 0.5), 0.0, 0.5 - c.y));
    line = mix(line, 0.35, smoothstep(0.2, 0.5, wy));
    float fog = smoothstep(0.0, 0.3, d);
    col = mix(uA * 0.12, uC * 1.25, line * (0.25 + 0.9 * fog));
    col += uC * 0.3 * exp(-d * 14.0);
  }
  gl_FragColor = vec4(post(col, uv), 1.0);
}`, { scale: 0.85 });

  def('gl-rubik', 'Rubik Field', `
vec3 gLocal;
float sdBox(vec3 p, vec3 b){ vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }
float map(vec3 p){
  vec3 q = p; q.z += uTime * (0.6 + 2.4 * uEnergy);
  vec3 cell = floor(q / 3.0); vec3 r = mod(q, 3.0) - 1.5;
  float h1 = hash(cell.xy + cell.z * 7.1), h2 = hash(cell.yz + 3.7);
  r.xy = rot(uTime * (0.3 + h1) + h1 * 6.28) * r.xy;
  r.yz = rot(uTime * (0.25 + h2 * 0.5) + h2 * 6.28) * r.yz;
  gLocal = r;
  return sdBox(r, vec3(0.42)) - 0.05;
}
vec3 faceCol(vec3 lp){
  vec3 a = abs(lp);
  if (a.x > a.y && a.x > a.z) return lp.x > 0.0 ? vec3(0.94, 0.27, 0.27) : vec3(0.98, 0.57, 0.24);
  if (a.y > a.z) return lp.y > 0.0 ? vec3(0.96, 0.96, 0.94) : vec3(1.0, 0.82, 0.25);
  return lp.z > 0.0 ? vec3(0.13, 0.77, 0.37) : vec3(0.23, 0.51, 0.96);
}
float stickerMask(vec3 lp){
  vec3 a = abs(lp); vec2 f;
  if (a.x > a.y && a.x > a.z) f = lp.yz; else if (a.y > a.z) f = lp.xz; else f = lp.xy;
  vec2 g = fract((f + 0.47) / 0.94 * 3.0); vec2 e = min(g, 1.0 - g);
  return smoothstep(0.05, 0.12, min(e.x, e.y));
}
void main(){
  vec2 uv = shockUV(gl_FragCoord.xy / uRes); vec2 p = centred(uv);
  vec3 ro = vec3((uMouse.x - 0.5) * 1.2, (uMouse.y - 0.5) * 0.8, 0.0);
  vec3 rd = normalize(vec3(p, 1.1));
  rd.xy = rot(sin(uTime * 0.07) * 0.2) * rd.xy;
  float t = 0.0, hit = 0.0;
  for (int i = 0; i < 64; i++){ float d = map(ro + rd * t); if (d < 0.002) { hit = 1.0; break; } t += d * 0.75; if (t > 28.0) break; }
  vec3 fog = mix(uA * 0.7, uB * 0.45, uv.y);
  vec3 col = fog;
  if (hit > 0.5){
    vec3 pos = ro + rd * t; map(pos); vec3 lp = gLocal;
    vec2 e = vec2(0.003, 0.0);
    vec3 n = normalize(vec3(map(pos + e.xyy) - map(pos - e.xyy), map(pos + e.yxy) - map(pos - e.yxy), map(pos + e.yyx) - map(pos - e.yyx)));
    vec3 base = mix(vec3(0.04), faceCol(lp), stickerMask(lp));
    vec3 l = normalize(vec3(-0.5, 0.7, -0.4));
    float dif = max(dot(n, l), 0.0) * 0.8 + 0.25;
    float spe = pow(max(dot(reflect(rd, n), l), 0.0), 24.0);
    col = base * dif + spe * 0.6;
    col += uC * pow(1.0 - max(dot(n, -rd), 0.0), 3.0) * 0.6;
    col = mix(col, fog, 1.0 - exp(-t * 0.09));
  }
  col += vec3(stars(gl_FragCoord.xy, 0.003)) * (1.0 - hit);
  gl_FragColor = vec4(post(col, uv), 1.0);
}`, { scale: 0.5 });

  def('gl-voronoi', 'Voronoi Glass', `
void main(){
  vec2 uv = shockUV(gl_FragCoord.xy / uRes); vec2 p = centred(uv) * 3.2 + (uMouse - 0.5) * 0.4;
  float t = uTime * (0.35 + 1.2 * uEnergy);
  vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0; vec2 id = vec2(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 b = vec2(float(x), float(y)); vec2 o = hash2(i + b); o = 0.5 + 0.45 * sin(t + 6.2831 * o);
    vec2 rr = b + o - f; float d = dot(rr, rr);
    if (d < d1) { d2 = d1; d1 = d; id = i + b; } else if (d < d2) { d2 = d; }
  }
  float edge = sqrt(d2) - sqrt(d1);
  float h = hash(id);
  vec3 cell = pal(0.15 + h * 0.8);
  vec3 col = cell * (0.25 + 0.55 * (1.0 - sqrt(d1))) * (0.7 + 0.3 * sin(t * 0.7 + h * 6.28));
  col += uC * smoothstep(0.07, 0.0, edge) * 1.1 + vec3(1.0) * smoothstep(0.02, 0.0, edge) * 0.35;
  gl_FragColor = vec4(post(col, uv), 1.0);
}`, { scale: 0.75 });

  def('gl-galaxy', 'Spiral Galaxy', `
void main(){
  vec2 uv = shockUV(gl_FragCoord.xy / uRes); vec2 p = centred(uv) * 1.6 + (uMouse - 0.5) * 0.2;
  p = rot(uTime * (0.03 + 0.12 * uEnergy)) * p;
  p.y *= 1.6;
  float r = length(p), a = atan(p.y, p.x);
  float arms = 0.5 + 0.5 * cos(2.0 * a - log(r + 0.001) * 5.0);
  float dust = fbm(p * 5.0 + vec2(uTime * 0.05, 0.0));
  float dens = exp(-r * 2.2) * (0.35 + 0.9 * pow(arms, 3.0)) * (0.5 + dust);
  vec3 col = uA * 0.25 + pal(dens * 1.5) * dens * 2.2;
  col += vec3(1.0, 0.95, 0.85) * exp(-r * 9.0) * 1.3;
  col += vec3(stars(gl_FragCoord.xy, 0.006));
  gl_FragColor = vec4(post(col, uv), 1.0);
}`);

  def('gl-storm', 'Electric Storm', `
void main(){
  vec2 uv = shockUV(gl_FragCoord.xy / uRes); vec2 p = centred(uv);
  float t = uTime * (0.6 + 1.5 * uEnergy);
  float clouds = fbm(p * 2.2 + vec2(t * 0.08, t * 0.03)) * fbm(p * 4.0 - t * 0.05);
  vec3 col = mix(uA * 0.5, uB * 0.8, clouds * 1.6);
  float flash = 0.0;
  for (int k = 0; k < 3; k++){
    float fk = float(k);
    float seed = floor(t * 0.6 + fk * 0.37);
    float life = fract(t * 0.6 + fk * 0.37);
    float on = step(0.55, hash(vec2(seed, fk)) + uPulse.w * exp(-uPulse.z * 3.0));
    float x0 = (hash(vec2(seed, fk + 3.0)) - 0.5) * aspect();
    float wig = (fbm(vec2(p.y * 3.5, seed * 7.0 + fk)) - 0.5) * 0.55 + (noise(vec2(p.y * 18.0, seed)) - 0.5) * 0.08;
    float d = abs(p.x - x0 - wig);
    float fade = exp(-life * 6.0) * on;
    col += uC * (0.0025 / (d + 0.0015)) * fade;
    col += vec3(1.0) * (0.0008 / (d + 0.0008)) * fade;
    flash += fade;
  }
  col += uB * flash * 0.25;
  gl_FragColor = vec4(post(col, uv), 1.0);
}`);

  def('gl-ink', 'Ink Swirl', `
void main(){
  vec2 uv = shockUV(gl_FragCoord.xy / uRes); vec2 p = centred(uv) * 2.2 + (uMouse - 0.5) * 0.3;
  float t = uTime * (0.12 + 0.35 * uEnergy);
  vec2 q = p;
  for (int i = 0; i < 5; i++){ float fi = float(i); q += 0.32 * vec2(sin(q.y * 1.9 + t + fi * 1.3), cos(q.x * 1.7 - t * 1.2 + fi * 2.1)); }
  float f = fbm(q * 1.3);
  float g = 0.5 + 0.5 * sin(q.x * 2.0 + q.y * 1.5);
  vec3 col = pal(f * 0.85 + g * 0.25) * (0.35 + 0.95 * f);
  col += uC * pow(g, 8.0) * 0.5;
  gl_FragColor = vec4(post(col, uv), 1.0);
}`);

  const rgb = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  const NEUTRAL = { energy: 0, hold: 0, ready: 0, warn: 0, pb: 0, pulse: [0.5, 0.5, 9, 0], mouse: [0.5, 0.5] };

  class GL {
    constructor(canvas) {
      this.c = canvas; this.progs = {}; this.errors = {};
      const force = !!window.SOLVO_FORCE_GL;
      const o = { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: !force };
      let gl = null; try { gl = canvas.getContext('webgl', o) || canvas.getContext('experimental-webgl', o); } catch (e) { gl = null; }
      if (gl && !force) { // software WebGL would hog the CPU: use the 2D scenes instead
        let r = ''; try { const ext = gl.getExtension('WEBGL_debug_renderer_info'); r = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER)); } catch (e) { }
        this.renderer = r; if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(r)) { this.soft = true; gl = null; }
      }
      this.gl = gl; if (!gl) return;
      const hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
      this.prec = hp && hp.precision > 0 ? 'highp' : 'mediump';
      this.buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      this.lost = false;
      canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.lost = true; this.progs = {}; });
      canvas.addEventListener('webglcontextrestored', () => { this.lost = false; this.progs = {}; const g = this.gl; this.buf = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, this.buf); g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW); });
    }
    ok() { return !!this.gl && !this.lost; }
    prog(scene) {
      if (this.progs[scene.id] !== undefined) return this.progs[scene.id];
      const gl = this.gl;
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { this.errors[scene.id] = gl.getShaderInfoLog(s); gl.deleteShader(s); return null; } return s; };
      const v = sh(gl.VERTEX_SHADER, VERT), f = sh(gl.FRAGMENT_SHADER, `precision ${this.prec} float;\n` + HEAD + scene.frag);
      if (!v || !f) { this.progs[scene.id] = null; return null; }
      const p = gl.createProgram(); gl.attachShader(p, v); gl.attachShader(p, f); gl.bindAttribLocation(p, 0, 'aPos'); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { this.errors[scene.id] = gl.getProgramInfoLog(p); this.progs[scene.id] = null; return null; }
      const u = {}; ['uRes', 'uTime', 'uMouse', 'uA', 'uB', 'uC', 'uEnergy', 'uHold', 'uReady', 'uWarn', 'uPB', 'uPulse'].forEach(n => u[n] = gl.getUniformLocation(p, n));
      return (this.progs[scene.id] = { p, u });
    }
    render(scene, w, h, t, P, fx) {
      if (!this.ok()) return false; const pr = this.prog(scene); if (!pr) return false;
      const gl = this.gl; fx = fx || NEUTRAL;
      gl.viewport(0, 0, w, h); gl.useProgram(pr.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      const u = pr.u;
      gl.uniform2f(u.uRes, w, h); gl.uniform1f(u.uTime, t); gl.uniform2f(u.uMouse, fx.mouse[0], fx.mouse[1]);
      gl.uniform3fv(u.uA, rgb(P.shadow)); gl.uniform3fv(u.uB, rgb(P.mid)); gl.uniform3fv(u.uC, rgb(P.high));
      gl.uniform1f(u.uEnergy, fx.energy); gl.uniform1f(u.uHold, fx.hold); gl.uniform1f(u.uReady, fx.ready); gl.uniform1f(u.uWarn, fx.warn); gl.uniform1f(u.uPB, fx.pb);
      gl.uniform4f(u.uPulse, fx.pulse[0], fx.pulse[1], fx.pulse[2], fx.pulse[3]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return true;
    }
  }
  window.SolvoShaders = { scenes: S, GL, HEAD, VERT };
})();

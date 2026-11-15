/** Eurovision studio stage cards — fan-made broadcast-style postcards in a fixed 1600×900 frame.
 *  Original artwork only (no official marks). Motion is transform/opacity (plus a short blur-in on text). */
import "@fontsource/baloo-2/700.css";
import { ASIA_T } from "./evaudio";
import "@fontsource/baloo-2/800.css";
import "@fontsource-variable/fredoka";
import "@fontsource/montserrat/600.css";
import "@fontsource/outfit/700.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/montserrat/900.css";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { EvCard } from "./eurovision-data";
import "./evcards.css";

const W = 1600, H = 900;
const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const css = (o: Record<string, string | number>) => o as CSSProperties;
const rng = (seed: number) => { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };

const FONTS = ["800 100px 'Baloo 2'", "700 40px 'Baloo 2'", "700 100px 'Fredoka Variable'", "900 100px Montserrat", "700 40px Montserrat", "600 30px Montserrat", "700 100px Outfit", "800 100px Outfit"];
let fontsPromise: Promise<unknown> | null = null;
export function useFontsReady() {
  const [ok, setOk] = useState(typeof document === "undefined");
  useEffect(() => {
    let dead = false; const done = () => { if (!dead) setOk(true); };
    const f = (document as any).fonts;
    if (!f?.load) { done(); return; }
    fontsPromise ||= Promise.all(FONTS.map(x => f.load(x).catch(() => null)));
    fontsPromise.then(done, done);
    const t = setTimeout(done, 2500);
    return () => { dead = true; clearTimeout(t); };
  }, []);
  return ok;
}

/** Largest font size (≤ max) at which text fits target width, measured with the real webfont. */
export function fitSize(text: string, font: (px: number) => string, target: number, max: number, spacingEm = 0, ok = true) {
  if (!ok || typeof document === "undefined") return max;
  const g = document.createElement("canvas").getContext("2d"); if (!g) return max;
  g.font = font(100);
  const w = g.measureText(text).width + spacingEm * 100 * text.length;
  return Math.max(24, Math.min(max, (target / w) * 100));
}

/** Fixed 1600×900 stage scaled to the host; in fullscreen on a portrait phone it turns sideways. */
export function TvFrame({ full, children, className = "", ready }: { full?: boolean; children: ReactNode; className?: string; ready: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [k, setK] = useState({ s: 358 / W, rot: false });
  useIso(() => {
    const el = host.current; if (!el) return;
    const fit = () => {
      const bw = el.clientWidth, bh = el.clientHeight || bw * 9 / 16;
      if (full) { const rot = bh > bw * 1.05; setK({ s: rot ? Math.min(bh / W, bw / H) : Math.min(bw / W, bh / H), rot }); }
      else setK({ s: bw / W, rot: false });
    };
    fit();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    ro?.observe(el); addEventListener("resize", fit);
    return () => { ro?.disconnect(); removeEventListener("resize", fit); };
  }, [full]);
  return (
    <div ref={host} className={"sc-host" + (full ? " full" : "")}>
      <div className={"sc-tv " + className + (ready ? " ready" : "") + (reduced() ? "" : " anim")}
        style={{ transform: `translate(-50%,-50%)${k.rot ? " rotate(90deg)" : ""} scale(${k.s})` }}>
        {children}
        <span className="sc-fan">Fan-made recreation</span>
      </div>
    </div>
  );
}

const Txt = ({ d, className, children, style }: { d: number; className: string; children: ReactNode; style?: CSSProperties }) =>
  <div className={"sc-txt " + className} style={{ ...style, "--d": d + "s" } as CSSProperties}>{children}</div>;

/* ───────────────────────── 1. Eurovision Asia — thermal kaleidoscope ───────────────────────── */
// Timeline (seconds), matched to the broadcast clip: dark 0–1.7 · hearts burst in from everywhere 1.7–2.9 and settle
// into the ring · country types in purple → white from 2.0 · hold (palette cycling + breathing) to 8.0 ·
// exit 8.0–9.6 · clean stage · loop at 10.4.
const { burst: A_BURST, hold: A_HOLD, end: A_END, loop: A_LOOP } = ASIA_T;   // shared with the sound engine
const clamp01 = (x: number) => x < 0 ? 0 : x > 1 ? 1 : x;
const ease = (x: number) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const outCubic = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

/** Ring state for timeline time T: expand factor, palette shift, scatter (few hearts left), overall fade, size, burst, magenta mix. */
function ringAt(T: number) {
  const B = A_BURST;
  // palette keyframes from the clip: burst yellow/red → blue/yellow as it settles → pink/red/yellow magenta for the hold
  const pal = (t: number) => {
    const b = t - B;
    const sh = b < .8 ? -.28 : b < 1.25 ? lerp(-.28, .85, ease((b - .8) / .45)) : b < 1.9 ? .85 : b < 2.6 ? lerp(.85, .05, ease((b - 1.9) / .7)) : .05 + .22 * Math.sin((b - 2.6) * 1.3);
    const mg = ease((b - 2.0) / .7) * (.85 + .15 * Math.sin(b * 1.7));
    return { sh, mg };
  };
  if (T < A_HOLD) {
    const b = T - B;
    if (b < 0) return { ex: 2, sh: 0, sc: 0, fa: 0, sz: .2, bu: 0, mg: 0 };
    // burst: hearts pop up all over the frame and swell, then pull back out into the ring
    const grow = ease(b / .5), pull = outCubic((b - .5) / .75);
    const hold = b - 1.25;
    const breathe = hold > 0 ? Math.sin(hold * 2.2) * .045 * ease(hold / .6) : 0;
    const { sh, mg } = pal(T);
    return { ex: (2.05 - 1.05 * pull) * (1 + breathe), sh, sc: 0, fa: clamp01(b / .08), sz: (.25 + .9 * grow) * (1 - pull) + pull, bu: grow + pull, mg };
  }
  const e = T - A_HOLD; const hold = A_HOLD - B - 1.25;
  const p0 = pal(A_HOLD);
  return {
    ex: (1 + Math.sin(hold * 2.2) * .045) + .06 * ease(e / .3) + .25 * ease((e - .45) / .35),
    sh: p0.sh * (1 - ease(e / .2)) + .45 * ease(e / .22) * (1 - ease((e - .4) / .18)) - .2 * ease((e - .45) / .18) * (1 - ease((e - .85) / .2)),
    sc: ease((e - .8) / .3),
    fa: 1 - ease((e - 1.25) / .4),
    sz: 1 - .3 * ease(e / .22) * (1 - ease((e - .4) / .25)) + .35 * ease((e - .45) / .3),
    bu: 2, mg: p0.mg * (1 - ease(e / .25)),
  };
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const VS = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
const FS = `precision highp float;
uniform vec2 uRes;uniform float uT,uEx,uSh,uSc,uFa,uSz,uBu,uMg;
float h1(float n){return fract(sin(n*91.345)*47453.5453);}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){return .55*noise(p)+.3*noise(p*2.03+7.1)+.15*noise(p*4.1+3.3);}
float dot2(vec2 v){return dot(v,v);}
float sdHeart(vec2 p){p.x=abs(p.x);
 if(p.y+p.x>1.)return sqrt(dot2(p-vec2(.25,.75)))-.35355;
 return sqrt(min(dot2(p-vec2(0,1)),dot2(p-.5*max(p.x+p.y,0.))))*sign(p.x-p.y);}
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
vec3 thermal(float x){x=clamp(x,0.,1.);
 vec3 c=vec3(1.,.95,.62);
 c=mix(c,vec3(1.,.82,0.),smoothstep(.0,.09,x));
 c=mix(c,vec3(1.,.48,0.),smoothstep(.09,.2,x));
 c=mix(c,vec3(1.,.18,.43),smoothstep(.2,.33,x));
 c=mix(c,vec3(.9,.08,.17),smoothstep(.33,.48,x));
 c=mix(c,vec3(.45,.08,.5),smoothstep(.56,.68,x));
 c=mix(c,vec3(.12,.24,1.),smoothstep(.68,.8,x));
 c=mix(c,vec3(.25,.75,1.),smoothstep(.93,1.,x));
 return c;}
vec3 magenta(float x){x=clamp(x,0.,1.);                 // the pink/red/yellow palette the ring cycles into
 vec3 c=vec3(1.,.96,.55);
 c=mix(c,vec3(1.,.66,.08),smoothstep(.0,.1,x));
 c=mix(c,vec3(1.,.28,.62),smoothstep(.1,.22,x));
 c=mix(c,vec3(.95,.06,.22),smoothstep(.22,.36,x));
 c=mix(c,vec3(.82,.08,.7),smoothstep(.5,.64,x));
 c=mix(c,vec3(.48,.14,.95),smoothstep(.68,.82,x));
 c=mix(c,vec3(1.,.82,.2),smoothstep(.92,1.,x));
 return c;}
vec3 pal(float x){return mix(thermal(x),magenta(x),uMg);}
void main(){
 vec2 fc=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y)/uRes*vec2(1600.,900.);
 vec2 p=fc-vec2(800.,452.);
 vec2 q=vec2(abs(p.x),p.y);                       // kaleidoscope: mirror left/right
 float t=uT;
 vec2 R=vec2(470.,372.)*uEx;
 float e=length(q/R);
 float th=atan(q.y/R.y,q.x/R.x);
 // heart field: three layers of blobs around the oval
 float d=1e5;float dw=1e5;float id=0.;float sz=1.;vec2 lpk=vec2(0.);
 for(int L=0;L<3;L++){
  float fl=float(L);
  float N=fl==0.?9.:fl==1.?8.:7.;
  float er=fl==0.?1.1:fl==1.?1.4:1.78;
  float s0=(fl==0.?112.:fl==1.?150.:190.)*(.8+.2*uEx)*uSz;
  for(int k=0;k<9;k++){
   float fk=float(k);if(fk>=N)break;
   float hid=fl*10.+fk;float r1=h1(hid+1.),r2=h1(hid+2.3),r3=h1(hid+5.7);
   float a=-1.62+(fk+.5+(r1-.5)*.5)/N*3.24+.05*sin(t*.7+hid);
   float rr=er+.07*sin(t*1.1+hid*1.7)+(r2-.5)*.12;
   vec2 c=vec2(cos(a),sin(a))*R*rr;
   float sc=1.;
   if(uSc>0.){float keep=step(r3,.5);sc=mix(1.,keep*.55,uSc);c*=1.+uSc*(.04+r1*.16);}
   float s=s0*(.8+.4*r2)*(1.+.07*sin(t*2.3+hid*2.1))*sc;
   if(uBu<2.){float gr=clamp(uBu,0.,1.),pu=clamp(uBu-1.,0.,1.),st=r3*.3;s*=smoothstep(st,st+.45,gr);c*=mix(.28+r1*.95,1.,pu);}   // burst: hearts pop up staggered all over, then pull out to the ring
   if(s<1.)continue;
   if(length(q-c)>s*1.9){d=smin(d,length(q-c)-s*.75,14.);continue;}
   float ang=(r1-.5)*1.6+a*.6+.55*sin(t*.9+hid*1.3);
   vec2 lp=q-c;float ca=cos(ang),sa=sin(ang);lp=mat2(ca,-sa,sa,ca)*lp/s;
   lp.y=-lp.y+.48;
   lp+=.07*vec2(sin(lp.y*5.+t*2.1+hid),cos(lp.x*5.-t*1.7+hid));   // morph
   float dk=(sdHeart(lp*vec2(.9+.15*r3,1.))-.05)*s;
   if(dk<dw){dw=dk;id=hid;sz=s;lpk=lp;}
   d=smin(d,dk,14.);
  }
 }
 float inside=smoothstep(1.2,-1.2,d);
 // blob colour: rim hot (yellow/orange) → body red/pink → cool blue/purple spots in the core
 float u=clamp(-d/(sz*.42),0.,1.);
 float n=fbm(lpk*2.4+vec2(id*3.1,t*.5));
 float cyc=.1*sin(t*2.2+id*1.9)+.07*sin(t*3.7+th*4.);
 // puffy lighting: hot (orange→yellow) highlight on each lobe, red/pink body, purple-blue cool patches, dark rim
 vec2 lo=vec2(abs(lpk.x)-.26,lpk.y-.72);
 float hl=exp(-dot(lo,lo)*7.)*smoothstep(.05,.5,u);
 float x=.42-hl*(.2+.12*sin(t*1.9+id))+cyc+uSh*.32;
 x+=smoothstep(.6,.8,fbm(lpk*1.7+vec2(id*7.3,-t*.4)))*.4*smoothstep(.15,.4,u);                    // cool spots
 x-=smoothstep(.12,.0,u)*.12*(.5+.5*sin(t*2.6+id*2.3+th*3.));          // glowing rims (cycle)
 x=mix(x,floor(x*14.)/14.,.3);
 vec3 bc=pal(x);
 bc*=mix(.55,1.,smoothstep(.0,.12,u));                                   // rim shade
 bc=mix(bc,vec3(.3,.04,.4),.4*smoothstep(.3,.0,u)*smoothstep(.3,-.3,lpk.y));   // purple underside
 if(uSc>.0){bc=mix(bc,mix(vec3(.9,.08,.15),vec3(1.,.5,.35),hl),uSc*.9);}
 // outer colour mush (blurry, abstract) + dark gaps near the hollow
 float m=fbm(q*.0042+vec2(t*.22,-t*.17)+id*.0);
 float m2=fbm(q*.009-vec2(t*.3,t*.12)+4.);
 float xm=.5+(m-.5)*1.1+.14*sin(t*1.6+th*3.)+uSh*.3;
 vec3 mc=pal(xm);
 mc=mix(mc,vec3(.3,.85,1.),smoothstep(.62,.8,m2)*.55);
 mc=mix(mc,vec3(1.,.85,.1),smoothstep(.66,.82,m)*.45);
 float mw=smoothstep(1.12,1.55,e)*(1.-uSc)*clamp(uBu-1.,0.,1.);   // no colour mush until the ring has formed
 float sh=1.-.8*exp(-max(d,0.)/9.);                                  // shadow halo around blobs
 vec3 col=mc*sh;float al=mw*(.55+.45*sh);
 float gap=smoothstep(.98,1.12,e)*(1.-uSc)*.9*clamp(uBu-1.,0.,1.);
 al=max(al,gap*(1.-mw)*.92);col=mix(vec3(0.),col,mw/max(al,.001)*.9);
 col=mix(col,bc,inside);al=max(al,inside);
 // outer blur ring brightness falloff
 al*=uFa;
 gl_FragColor=vec4(col*al,al);
}`;

/** WebGL thermal kaleidoscope ring; falls back to nothing (CSS glow) without WebGL. Driven by the shared clock. */
function useThermalGL(cv: { current: HTMLCanvasElement | null }) {
  const st = useRef<{ draw: (T: number) => void } | null>(null);
  useEffect(() => {
    const c = cv.current; if (!c) return;
    const gl = (c.getContext("webgl", { premultipliedAlpha: true, antialias: false, alpha: true }) || c.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) { c.classList.add("nogl"); return; }
    const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram()!; gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { c.classList.add("nogl"); return; }
    gl.useProgram(pr);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n: string) => gl.getUniformLocation(pr, n);
    const uRes = U("uRes"), uT = U("uT"), uEx = U("uEx"), uSh = U("uSh"), uSc = U("uSc"), uFa = U("uFa"), uSz = U("uSz"), uBu = U("uBu"), uMg = U("uMg");
    // resolution: device pixels of the on-screen frame, capped; drops further if the GPU can't hold ~60fps
    let cap = (window as any).__scGLCap || 1440, n = 0, slow = 0, last = 0;
    const size = () => {
      const r = c.getBoundingClientRect(); const dpr = Math.min(devicePixelRatio || 1, 3);
      const w = Math.round(Math.min(cap, Math.max(320, Math.max(r.width, r.height) * dpr))), h = Math.round(w * H / W);
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    };
    const pace = () => {
      const now = performance.now(), dt = now - last; last = now;
      if (dt > 0 && dt < 200) { if (dt > 24) slow++; if (++n >= 45) { if (slow > 30 && cap > 700) cap = Math.round(cap * .8); n = slow = 0; } }
      if (n % 15 === 0) size();
    };
    st.current = {
      draw: (T: number) => {
        pace(); if (!c.width || c.width === 300) size(); const r = ringAt(T);
        gl.viewport(0, 0, c.width, c.height);
        gl.uniform2f(uRes, c.width, c.height); gl.uniform1f(uT, T); gl.uniform1f(uEx, r.ex); gl.uniform1f(uSh, r.sh); gl.uniform1f(uSc, r.sc); gl.uniform1f(uFa, r.fa); gl.uniform1f(uSz, r.sz); gl.uniform1f(uBu, r.bu); gl.uniform1f(uMg, r.mg);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
    };
    return () => { st.current = null; gl.getExtension("WEBGL_lose_context")?.loseContext(); };
  }, [cv]);
  return st;
}

/** Cursive looped ℓ drawn as a stroke, sized to Outfit's ascender (0.7em) and stem weight. */
export const Ell = ({ w }: { w: number }) => (
  <svg className="sc-ell" viewBox="0 0 40 72" aria-hidden="true" style={{ strokeWidth: w }}>
    <path d="M3.5 63 C15 55 30 39 30 21 C30 10 26 5.2 21 5.2 C15 5.2 12 12 12 23 L12 54 C12 63.5 16.5 67 23 67 C28 67 32 64 35.5 60" />
  </svg>
);

type LetterPlan = { a: number; v: number; tin: string; tout: string; ld: number; pd?: number };
/** One line split into letter spans; 'l' becomes the looped ℓ. Full text stays readable via aria-label. */
function Letters({ text, className, plan, stroke, reg, style }: { text: string; className: string; plan: (i: number, n: number) => LetterPlan; stroke: number; reg: (el: HTMLElement | null, p: LetterPlan) => void; style?: CSSProperties }) {
  const chars = Array.from(text.replace(/"([^"]*)"/g, "\u201c$1\u201d"));
  return (
    <div className={"sc-al " + className} style={style}>
      {chars.map((ch, i) => (
        <span key={i} aria-hidden="true" ref={el => reg(el, plan(i, chars.length))}>{ch === "l" ? <Ell w={stroke} /> : ch === " " ? "\u00a0" : ch}</span>
      ))}
      <span className="sc-sr">{text}</span>
    </div>
  );
}

const TINT_P = "#ff5f93", TINT_Y = "#ffd43a", TINT_R = "#ff3b4e", TINT_O = "#ffae2a", TINT_V = "#9a4dff", TINT_L = "#c7a8ff";
/** Letter style for time T: types in with a warm tint, sits white, tints then erases. */
function letterStyle(p: LetterPlan, T: number): [number, string] {
  if (T < p.a) return [0, "#fff"];
  const ia = T - p.a;
  if (p.pd) { if (ia < p.pd) return [clamp01(ia / .05), p.tin]; }      // types in purple, then turns white
  else if (ia < .16) return [clamp01(ia / .05), ia < .07 ? p.tin : ia < .12 ? TINT_P : "#fff"];
  if (T < p.v - p.ld) return [1, "#fff"];
  if (T < p.v) return [1, T < p.v - p.ld * .45 ? p.tout : TINT_Y];
  return [1 - clamp01((T - p.v) / .06), TINT_Y];
}

const AsiaStage = memo(function AsiaStage() {
  const lx = 800, ly = 395;
  const beams = useMemo(() => {
    const R = rng(77); const out: { a: number; len: number; w: number; o: number }[] = [];
    for (let i = 0; i < 22; i++) { const a = -58 + (i / 21) * 116 + (R() - .5) * 5; out.push({ a, len: 520 + R() * 320, w: 8 + R() * 16, o: .18 + R() * .32 }); }
    return out;
  }, []);
  const crowd = useMemo(() => {
    const R = rng(5); const heads: { x: number; y: number; r: number }[] = []; const ph: { x: number; y: number; o: number }[] = [];
    for (let x = -10; x < 1620; x += 15 + R() * 13) heads.push({ x, y: 846 + R() * 26 + Math.abs(x - 800) * .02, r: 12 + R() * 6 });
    for (let i = 0; i < 46; i++) ph.push({ x: 40 + R() * 1520, y: 790 + R() * 70, o: .45 + R() * .55 });
    return { heads, ph };
  }, []);
  const pillars = useMemo(() => {
    const out: { x: number; w: number; top: number; bot: number }[] = [];
    for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
      const x = 800 + side * (210 + i * 50), w = 18 - i * 1.4;
      out.push({ x: x - w / 2, w, top: 470 - i * 16, bot: 690 + i * 10 });
    }
    return out;
  }, []);
  const beamSvg = (set: number, wide: boolean) => (
    <svg viewBox={`0 0 ${W} ${H}`} className="sc-svgfill">
      <defs>
        <linearGradient id={`scbeam${set}${wide ? "w" : ""}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity=".9" /><stop offset=".3" stopColor="#f2f4ff" stopOpacity=".4" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {beams.filter((_, i) => i % 2 === set).map((b, i) => (
        <polygon key={i} points={`0,-1.5 ${b.len},${-b.w * (wide ? 4 : 1)} ${b.len},${b.w * (wide ? 4 : 1)} 0,1.5`} fill={`url(#scbeam${set}${wide ? "w" : ""})`} opacity={b.o * (wide ? .45 : 1)}
          transform={`translate(${lx} ${ly}) rotate(${b.a - 90})`} />
      ))}
    </svg>
  );
  // truss: an inverted-V row of small bright lamps across the top of the arena
  const rig = useMemo(() => { const out: { x: number; y: number; r: number }[] = [];
    for (let i = 0; i <= 44; i++) { const x = 60 + i * (1480 / 44); const y = 168 + Math.abs(x - 800) * .17; out.push({ x, y, r: i % 4 === 0 ? 4.2 : 2.6 }); out.push({ x, y: y + 22, r: 2 }); }
    return out; }, []);
  return (
    <div className="sc-asia-stage" aria-hidden="true">
      <div className="sc-asia-haze" />
      <svg viewBox={`0 0 ${W} ${H}`} className="sc-svgfill sc-asia-rig">
        <defs><radialGradient id="scrigl"><stop offset="0" stopColor="#fff" /><stop offset=".35" stopColor="#dfe6ff" stopOpacity=".75" /><stop offset="1" stopColor="#9fb0ff" stopOpacity="0" /></radialGradient></defs>
        <path d={`M60 ${168 + 740 * .17} L800 168 L1540 ${168 + 740 * .17}`} stroke="#4a4f66" strokeWidth="3" fill="none" opacity=".55" />
        {rig.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r * 3.2} fill="url(#scrigl)" />)}
      </svg>
      <div className="sc-asia-pillars">
        {pillars.map((p, i) => <i key={i} style={css({ left: p.x, top: p.top, width: p.w, height: p.bot - p.top, "--d": -(i % 5) * .37 + "s" })} />)}
      </div>
      <div className="sc-beams a">{beamSvg(0, false)}</div>
      <div className="sc-beams b">{beamSvg(1, false)}</div>
      <div className="sc-beams w">{beamSvg(0, true)}</div>
      <div className="sc-asia-sun" />
      <svg viewBox={`0 0 ${W} ${H}`} className="sc-svgfill sc-asia-crowd">
        <defs><radialGradient id="sccrowdlight" cx=".5" cy=".85" r=".6"><stop offset="0" stopColor="#3a3a50" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient></defs>
        <ellipse cx="800" cy="840" rx="760" ry="120" fill="url(#sccrowdlight)" opacity=".8" />
        {crowd.heads.map((c, i) => <g key={i} fill="#020203"><circle cx={c.x} cy={c.y} r={c.r} /><ellipse cx={c.x} cy={c.y + c.r * 2.3} rx={c.r * 1.9} ry={c.r * 1.5} /></g>)}
        {crowd.ph.map((c, i) => <g key={"p" + i} className="sc-ph" style={css({ "--d": -(i * .53 % 3) + "s" })}><circle cx={c.x} cy={c.y} r="6" fill="#fff" opacity={c.o * .18} /><rect x={c.x - 1.6} y={c.y - 2.6} width="3.2" height="5.2" rx="1" fill="#fff" opacity={c.o} /></g>)}
      </svg>
    </div>
  );
});

function AsiaCard({ card, ok }: { card: EvCard; ok: boolean }) {
  const country = card.country || "Country";
  const lines = (card.lyrics || "").split(/\s*(?:\n|&)\s*/).map(s => s.trim()).filter(Boolean).map((l, i, a) => l + (i < a.length - 1 ? "," : ""));
  // fit the country to ~44% of the frame width (the ℓ is wider than Outfit's l)
  const nL = (country.match(/l/g) || []).length;
  const big = (() => {
    if (!ok || typeof document === "undefined") return 132;
    const g = document.createElement("canvas").getContext("2d"); if (!g) return 132;
    g.font = "700 100px Outfit"; const w = g.measureText(country.replace(/l/g, "")).width + nL * 40 - country.length * 1.5;
    return Math.max(48, Math.min(150, 700 / w * 100));
  })();
  const els = useRef<{ el: HTMLElement; p: LetterPlan; o: number; c: string }[]>([]);
  els.current = [];
  const reg = (el: HTMLElement | null, p: LetterPlan) => { if (el) els.current.push({ el, p, o: -1, c: "" }); };
  const cv = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const gl = useThermalGL(cv);
  const X = A_HOLD;
  // entry: lines type in from the left top→bottom; exit: country erases from the left, credits vanish bottom-up
  const B = A_BURST;
  const planCountry = (i: number) => ({ a: B + .2 + i * .085, v: X + (i < 3 ? .32 + .09 * i : .55 + .065 * (i - 3)), tin: TINT_V, tout: TINT_P, ld: .15, pd: .24 });
  // credit lines: patches of tint sweep through, then the whole line drops out right→left in ~0.1s
  const linePlan = (a0: number, gone: number, tout: string) => (i: number, n: number) =>
    ({ a: a0 + i * .018, v: X + gone + (n - 1 - i) / Math.max(1, n - 1) * -.1 + .1, tin: TINT_L, tout, ld: .1 + .2 * (.5 + .5 * Math.sin(i * .55 + n)), pd: .22 });
  useEffect(() => {
    if (!ok) return;
    const still = reduced();
    let raf = 0, loops = 0; const t0 = performance.now();
    const frame = () => {
      const fz = (window as any).__scFreeze;
      const raw = (performance.now() - t0) / 1000;
      const T = still ? A_BURST + 2.6 : typeof fz === "number" ? fz : raw % A_LOOP;
      // tell the studio each time the card loops back to its entry, so the sound can play again
      const lp = Math.floor(raw / A_LOOP); if (!still && typeof fz !== "number" && lp > loops) { loops = lp; dispatchEvent(new CustomEvent("ev-card-loop", { detail: "asia" })); }
      gl.current?.draw(T);
      for (const L of els.current) {
        const [o, c] = still ? [1, "#fff"] : letterStyle(L.p, T);
        const oo = Math.round(o * 100) / 100;
        if (oo !== L.o) { L.o = oo; L.el.style.opacity = String(oo); }
        if (c !== L.c) { L.c = c; L.el.style.color = c; }
      }
      const z = T < X ? 1 : 1 + .3 * ease((T - X) / 1.7);
      // dark until the burst; the rig lights up as the hearts settle, beams warm up through the hold
      const lit = T < X ? .08 + .3 * ease((T - B - 2.6) / 2.2) : .38 + .62 * ease((T - X - .1) / .35);
      const s = stage.current; if (s) { s.style.transform = `scale(${z})`; s.style.setProperty("--lit", lit.toFixed(3)); s.style.setProperty("--rig", (T < X ? ease((T - B - .9) / .6) : 1).toFixed(3)); s.style.setProperty("--wide", (T < X ? 0 : ease((T - X - .2) / .6)).toFixed(3)); s.style.opacity = String(T < X ? ease((T - B - .4) / .9) : T > A_END + .5 ? 1 - ease((T - A_END - .5) / .3) : 1); }
      if (!still) raf = requestAnimationFrame(frame);
    };
    frame();
    return () => cancelAnimationFrame(raf);
  }, [ok, gl]);
  const by = card.artist ? `By ${card.artist}` : "By artist";
  return (
    <>
      <div className="sc-asia-bg" />
      <div className="sc-asia-zoom" ref={stage}><AsiaStage /></div>
      <canvas ref={cv} className="sc-asia-gl" aria-hidden="true" />
      <div className="sc-asia-copy">
        <Letters text={card.song || "Song"} className="sc-asia-song" stroke={11} reg={reg} plan={linePlan(B + .38, 1.05, TINT_Y)} />
        <Letters text={by} className="sc-asia-by" stroke={11} reg={reg} plan={linePlan(B + .55, .8, TINT_O)} />
        <Letters text={country} className="sc-asia-country" stroke={11.5} reg={reg} plan={planCountry} style={{ fontSize: big }} />
        <div className="sc-asia-credits">
          <Letters text="Music & Lyrics" className="sc-asia-ml" stroke={11} reg={reg} plan={linePlan(B + 1.15, .8, TINT_Y)} />
          {lines.map((l, i) => <Letters key={i} text={l} className="sc-asia-ly" stroke={11} reg={reg}
            plan={linePlan(B + 1.5 + i * .22, Math.max(.4, .7 - (i - (lines.length - 2)) * .22), i === lines.length - 1 ? TINT_R : TINT_P)} />)}
        </div>
      </div>
    </>
  );
}

/* ───────────────────────── 2. Eurovision 2026 — neon arena ───────────────────────── */

const Star4 = () => <svg viewBox="-10 -10 20 20" aria-hidden="true"><path d="M0-10C.7-2.2 2.2-.7 10 0 2.2.7.7 2.2 0 10-.7 2.2-2.2.7-10 0-2.2-.7-.7-2.2 0-10z" fill="#fff" /></svg>;

const EscArena = memo(function EscArena() {
  const seats = useMemo(() => {
    const R = rng(2026); const pts: string[] = [];
    for (let t = 0; t < 11; t++) {
      const rx = 560 + t * 92, ry = 230 + t * 34, cy = 1130;
      for (let a = 0; a < 140; a++) {
        const th = Math.PI + (a / 139) * Math.PI; if (R() < .35) continue;
        const x = 800 + Math.cos(th) * rx, y = cy + Math.sin(th) * ry;
        if (y > 905 || x < -10 || x > 1610) continue;
        const warm = R() < .6;
        pts.push(`<circle cx='${x.toFixed(1)}' cy='${(y + (R() - .5) * 6).toFixed(1)}' r='${(.9 + R() * 1.5).toFixed(2)}' fill='${warm ? "#ffd9a8" : "#ff9ad0"}' fill-opacity='${(.35 + R() * .6).toFixed(2)}'/>`);
      }
    }
    const tiers = Array.from({ length: 11 }, (_, t) => `<ellipse cx='800' cy='1130' rx='${560 + t * 92}' ry='${230 + t * 34}' fill='none' stroke='${t % 2 ? "#1b0f22" : "#140a18"}' stroke-width='30'/>`).join("");
    return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${W} ${H}'>${tiers}${pts.join("")}</svg>`)}")`;
  }, []);
  const rays = [
    { x: -120, y: 980, a: -38, w: 260, c: "230,20,50", d: 0, s: 6 }, { x: -60, y: 760, a: -20, w: 180, c: "255,40,70", d: -3, s: 5 },
    { x: -140, y: 520, a: -6, w: 150, c: "200,10,40", d: -6, s: 7 }, { x: 0, y: 1000, a: -58, w: 140, c: "255,60,80", d: -2, s: 6 },
    { x: 620, y: 1000, a: -82, w: 220, c: "255,40,170", d: -1, s: 5 }, { x: 800, y: 1000, a: -96, w: 260, c: "255,90,200", d: -4, s: 6 },
    { x: 980, y: 1000, a: -108, w: 200, c: "220,40,190", d: -5, s: 5 },
    { x: 1720, y: 980, a: -142, w: 260, c: "60,70,255", d: -2, s: 6 }, { x: 1660, y: 760, a: -160, w: 180, c: "90,90,255", d: -5, s: 5 },
    { x: 1740, y: 520, a: -174, w: 150, c: "70,40,230", d: -1, s: 7 }, { x: 1600, y: 1000, a: -122, w: 140, c: "110,80,255", d: -6, s: 6 },
  ];
  const lasers = [
    { x: -100, y: 120, a: 14, d: 0 }, { x: -100, y: 640, a: -22, d: -4 }, { x: 1700, y: 200, a: 158, d: -2 }, { x: 1700, y: 700, a: 200, d: -6 },
    { x: 300, y: 950, a: -48, d: -3 }, { x: 1300, y: 950, a: -132, d: -1 },
  ];
  const stars = useMemo(() => {
    const R = rng(44); return Array.from({ length: 34 }, () => ({ x: R() * W, y: R() * 640, s: 12 + R() * 34, d: -R() * 4, p: 1.6 + R() * 2.4 }));
  }, []);
  return (
    <div className="sc-esc-arena" aria-hidden="true">
      <div className="sc-esc-glow" />
      <div className="sc-esc-seats" style={{ backgroundImage: seats }} />
      <div className="sc-esc-decor">
        {rays.map((r, i) => <i key={i} className="sc-ray" style={css({ left: r.x, top: r.y, width: 2000, height: r.w * (i >= 4 && i <= 6 ? 2 : 3), marginTop: -r.w * (i >= 4 && i <= 6 ? 1 : 1.5), "--a": r.a + "deg", "--c": r.c, "--d": r.d + "s", "--s": r.s + "deg" })}><b /></i>)}
        {lasers.map((l, i) => <i key={i} className="sc-laser" style={css({ left: l.x, top: l.y, "--a": l.a + "deg", "--d": l.d + "s" })} />)}
        {stars.map((s, i) => <span key={i} className="sc-star" style={css({ left: s.x - s.s / 2, top: s.y - s.s / 2, width: s.s, height: s.s, "--d": s.d + "s", "--p": s.p + "s" })}><Star4 /></span>)}
      </div>
    </div>
  );
});

function Neon({ text, ok }: { text: string; ok: boolean }) {
  const T = text.toUpperCase();
  const size = fitSize(T, px => `700 ${px}px 'Fredoka Variable'`, 1380, 220, .04, ok);
  const letters = [...T];
  const layer = (cls: string) => (
    <div className={"sc-neon-l " + cls} aria-hidden="true">
      {letters.map((ch, i) => <span key={i} style={css({ "--i": i })}>{ch === " " ? "\u00a0" : ch}</span>)}
    </div>
  );
  return (
    <div className="sc-neon" role="img" aria-label={T} style={{ fontSize: size }}>
      {layer("depth")}{layer("halo")}{layer("glow")}{layer("tube")}
    </div>
  );
}

function EscCard({ card, ok }: { card: EvCard; ok: boolean }) {
  const lines = (card.lyrics || "").split(/\s*(?:\n|&|\/)\s*/).map(s => s.trim()).filter(Boolean);
  const song = (card.song || "Song").toUpperCase();
  const songSize = fitSize(song, px => `700 ${px}px 'Fredoka Variable'`, 640, 128, .02, ok);
  return (
    <>
      <div className="sc-bgfade sc-esc-bg" />
      <EscArena />
      <div className="sc-esc-title"><Neon text={card.country || "Country"} ok={ok} /></div>
      <div className="sc-esc-l">
        <Txt d={1.7} className="sc-esc-song" style={{ fontSize: songSize }}>{song}</Txt>
        {card.artist ? <Txt d={1.85} className="sc-esc-by">BY {card.artist.toUpperCase()}</Txt> : null}
      </div>
      <div className="sc-esc-r">
        <Txt d={2.0} className="sc-esc-k">MUSIC &amp; LYRICS</Txt>
        {lines.map((l, i) => <Txt key={i} d={2.1 + i * .1} className="sc-esc-ly">{l.toUpperCase()}</Txt>)}
      </div>
    </>
  );
}

/* ───────────────────────── 3. Junior Eurovision 2026 — tiara ───────────────────────── */

/* Original symmetrical line-art tiara (not the official JESC mark). Left half is drawn, right half mirrored. */
type TP = { d: string; c: string; w: number; t: number };
const T_CENTRE: TP[] = [
  { d: "M141 12 L159 12 L150 28 Z", c: "#ff5fc8", w: 1.6, t: 0 },
  { d: "M150 34 a22 22 0 1 1 -.01 0 Z", c: "#ff7ad9", w: 1.5, t: .08 },
  { d: "M150 70c-9-7-13-14-8-19 4-4 8 0 8 0s4-4 8 0c5 5 1 12-8 19z", c: "#ff9be3", w: 1.4, t: .2 },
  { d: "M40 106 C100 119 200 119 260 106", c: "#f2c14e", w: 1.8, t: .35 },
  { d: "M58 112 C110 121 190 121 242 112", c: "#ff7ad9", w: 1.1, t: .5 },
];
const T_HALF: TP[] = [
  { d: "M131 72 C114 77 101 67 104 55 C106 46 117 45 119 53 C120 59 113 61 111 56", c: "#ffe566", w: 1.5, t: .3 },
  { d: "M128 84 C100 93 73 80 74 58 C75 41 93 37 99 48 C103 57 94 64 87 59", c: "#ff4fc0", w: 1.6, t: .42 },
  { d: "M120 96 C86 108 46 100 34 80 C26 64 40 54 49 62 C55 68 49 76 42 72", c: "#ff3fb0", w: 1.5, t: .55 },
  { d: "M112 40 C104 28 108 18 117 20 C122 21 122 28 117 29", c: "#ffe566", w: 1.3, t: .62 },
  { d: "M64 44 C58 36 62 28 70 30", c: "#8fd3ff", w: 1.2, t: .7 },
  { d: "M92 100 C84 102 80 98 82 94", c: "#8fd3ff", w: 1.2, t: .72 },
];
const T_DOTS: [number, number, number, string][] = [[150, 36, 1.6, "#8fd3ff"], [126, 50, 1.8, "#ffe566"], [174, 50, 1.8, "#ffe566"], [133, 30, 1.3, "#8fd3ff"], [167, 30, 1.3, "#8fd3ff"],
  [150, 86, 1.8, "#ffe566"], [40, 106, 2.4, "#8fd3ff"], [260, 106, 2.4, "#8fd3ff"], [58, 50, 1.6, "#ff9be3"], [242, 50, 1.6, "#ff9be3"], [96, 32, 1.3, "#ffe566"], [204, 32, 1.3, "#ffe566"]];

function Tiara({ sparkle }: { sparkle: boolean }) {
  const strokes = (k: number) => (
    <>
      {T_CENTRE.map((p, i) => <path key={"c" + i} d={p.d} pathLength={1} stroke={p.c} strokeWidth={p.w * k} style={css({ "--d": p.t + "s" })} />)}
      {T_HALF.map((p, i) => <path key={"l" + i} d={p.d} pathLength={1} stroke={p.c} strokeWidth={p.w * k} style={css({ "--d": p.t + "s" })} />)}
      <g transform="translate(300 0) scale(-1 1)">
        {T_HALF.map((p, i) => <path key={"r" + i} d={p.d} pathLength={1} stroke={p.c} strokeWidth={p.w * k} style={css({ "--d": p.t + "s" })} />)}
      </g>
      {T_DOTS.map(([x, y, r, c], i) => <circle key={"d" + i} cx={x} cy={y} r={r} pathLength={1} stroke={c} strokeWidth={1.1 * k} style={css({ "--d": .8 + (i % 6) * .05 + "s" })} />)}
    </>
  );
  return (
    <div className="sc-tiara">
      <svg className="sc-tiara-glow" viewBox="0 0 300 130" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{strokes(3)}</svg>
      <svg className="ev-crown sc-tiara-line" viewBox="0 0 300 130" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {strokes(1)}
        {sparkle && (
          <g className="sc-spark">
            <circle r="4" fill="#fff" opacity=".3" /><circle r="1.3" fill="#fff" />
            <path d="M0-7L.6-.6 7 0 .6.6 0 7-.6.6-7 0-.6-.6z" fill="#fff" />
            <animateMotion dur="2.6s" begin="1.2s" repeatCount="indefinite" path="M40 106 C100 119 200 119 260 106 C200 119 100 119 40 106" />
          </g>
        )}
      </svg>
    </div>
  );
}

const JescArena = memo(function JescArena() {
  const lights = useMemo(() => { const R = rng(9); return Array.from({ length: 12 }, (_, i) => ({ x: 30 + i * 56, y: 92 + (30 + i * 56) * (78 / 700), d: -R() * 3, p: 2 + R() * 2 })); }, []);
  return (
    <div className="sc-jesc-arena" aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} className="sc-svgfill">
        <defs><linearGradient id="sctruss" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#6c7cc8" stopOpacity=".55" /><stop offset="1" stopColor="#6c7cc8" stopOpacity="0" /></linearGradient></defs>
        <g stroke="url(#sctruss)" strokeWidth="2" fill="none">
          <path d="M0 52 L700 130" /><path d="M0 82 L700 160" />
          {Array.from({ length: 24 }, (_, i) => <path key={i} d={`M${i * 29} ${52 + i * 3.25} L${i * 29 + 14.5} ${82 + i * 3.25 + 1.6} L${i * 29 + 29} ${52 + (i + 1) * 3.25}`} />)}
        </g>
        {Array.from({ length: 9 }, (_, t) => <ellipse key={t} cx="800" cy="1180" rx={620 + t * 110} ry={300 + t * 40} fill="none" stroke="#1d2a6e" strokeOpacity={.35 - t * .025} strokeWidth="22" />)}
      </svg>
      {lights.map((l, i) => <i key={i} className="sc-jl" style={css({ left: l.x, top: l.y, "--d": l.d + "s", "--p": l.p + "s" })} />)}
      <i className="sc-haze h1" /><i className="sc-haze h2" /><i className="sc-haze h3" />
    </div>
  );
});

function JescCard({ card, ok }: { card: EvCard; ok: boolean }) {
  const C = (card.country || "Country").toUpperCase();
  const big = fitSize(C, px => `900 ${px}px Montserrat`, 1180, 220, .03, ok);
  const songLine = `${(card.song || "Song").toUpperCase()}${card.artist ? ` - ${card.artist.toUpperCase()}` : ""}`;
  const songSize = fitSize(songLine, px => `700 ${px}px Montserrat`, 1240, 48, .1, ok);
  return (
    <>
      <div className="sc-bgfade sc-jesc-bg" />
      <JescArena />
      <div className="sc-jesc-copy">
        <Tiara sparkle={!reduced()} />
        <Txt d={1.5} className="sc-jesc-country" style={{ fontSize: big }}>{C}</Txt>
        <Txt d={1.7} className="sc-jesc-song" style={{ fontSize: songSize }}>{songLine}</Txt>
        {card.lyrics ? <Txt d={1.85} className="sc-jesc-ly">MUSIC &amp; LYRICS: {card.lyrics.toUpperCase()}</Txt> : null}
      </div>
    </>
  );
}

export function StageCardTV({ card, play, full }: { card: EvCard; play: number; full?: boolean }) {
  const ok = useFontsReady();
  const body = card.style === "asia" ? <AsiaCard card={card} ok={ok} /> : card.style === "esc" ? <EscCard card={card} ok={ok} /> : <JescCard card={card} ok={ok} />;
  return (
    <TvFrame full={full} ready={ok} className={"sc-" + card.style} key={`${card.style}-${play}`}>
      {body}
    </TvFrame>
  );
}

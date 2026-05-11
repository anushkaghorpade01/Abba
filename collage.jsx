// Cinematic memory collage — full set (73 photos), every photo highlighted.

const CANVAS_W = 5600;
// 4K UHD output for high-res recording. Stage auto-scales to fit viewport.
const VIEW_W = 3840;
const VIEW_H = 2160;
// Scale all overlay sizes (titles, vignette radii) up for 4K so they read the same as before.
const UI_SCALE = VIEW_W / 1920;

// index, aspect (w/h)
// [index, aspect (w/h), preRotateDeg]
// preRotateDeg: visual rotation applied to baked image so it shows upright.
// When 90/270, the aspect is already given as the desired (post-rotation) orientation.
const RAW = [
[1, 1600 / 1200, 0], [2, 1600 / 1201, 90], [3, 1600 / 1201, 90], [4, 1600 / 1200, 90], [5, 1600 / 1201, 90],
[6, 1600 / 1165, 90], [7, 1080 / 1300, 0], [8, 1600 / 1200, 0], [9, 1600 / 1200, 0], [10, 1600 / 1200, 0],
[11, 1080 / 1300, 0], [12, 1600 / 870, 0], [13, 1080 / 1340, 0], [14, 1600 / 870, 0], [15, 1080 / 1340, 0],
[16, 1600 / 870, 0], [17, 1600 / 870, 0], [18, 1600 / 870, 0], [19, 1600 / 870, 0], [20, 1087 / 1447, 0],
[21, 1600 / 785, 0], [22, 1600 / 1232, 0], [23, 1436 / 912, 0], [24, 1600 / 863, 0], [25, 1600 / 942, 0],
[26, 1600 / 1200, 0], [27, 1600 / 918, 0], [28, 1600 / 1553, 0], [29, 1600 / 1025, 0], [30, 1600 / 1200, 0],
[31, 1600 / 775, 0], [32, 1600 / 915, 0], [33, 1600 / 972, 0], [34, 892 / 865, 0], [35, 1600 / 966, 0],
[36, 1600 / 1200, 0], [37, 1600 / 856, 0], [38, 1600 / 930, 0], [39, 1600 / 789, 0], [40, 1600 / 863, 0],
[41, 1050 / 1008, 0], [42, 1600 / 1279, 0], [43, 1600 / 1335, 0], [44, 1200 / 1600, 0], [45, 1600 / 1046, 0],
[46, 1162 / 1600, 0], [47, 1600 / 1582, 0], [48, 1600 / 1200, 0], [49, 1280 / 853, 0], [50, 1600 / 1458, 0],
[51, 1600 / 713, 0], [52, 1394 / 1128, 0], [53, 1600 / 861, 0], [54, 1600 / 800, 0], [55, 1548 / 675, 0],
[56, 1012 / 1600, 0], [57, 1600 / 785, 0], [58, 569 / 450, 0], [59, 1600 / 785, 0], [60, 1600 / 840, 0],
[61, 1280 / 583, 0], [62, 1600 / 1384, 0], [63, 1600 / 752, 0], /* m64 removed (duplicate) */[65, 1600 / 729, 0],
[66, 1600 / 844, 0], [67, 1600 / 1262, 0], [68, 960 / 1050, 0], [69, 1600 / 1200, 0], [70, 1600 / 1532, 0],
[71, 1048 / 1600, 0], [72, 1259 / 1462, 0], [73, 1600 / 966, 0]];


function seeded(seed) {
  let s = seed >>> 0;
  return () => {s = s * 1664525 + 1013904223 >>> 0;return s / 0xffffffff;};
}

// Tweak defaults — persisted on edit.
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "pace": 1.8,
  "tiltAmount": 6,
  "padding": 12,
  "vignette": 0.55,
  "grain": 0.18,
  "warmth": 0.5,
  "rowSpacing": 60,
  "smoothness": 1,
  "showTitles": true,
  "rotations": {}
} /*EDITMODE-END*/;

// ─── Layout ─────────────────────────────────────────────────────────────────

function buildLayout(rowSpacingPx, tiltAmount) {
  const rnd = seeded(42);
  const PAD = 44;
  const ROW_TOP = 160;
  const X_MIN = 80,X_MAX = CANVAS_W - 80;
  const usableW = X_MAX - X_MIN;

  const photos = [];
  let y = ROW_TOP;
  let idx = 0;
  const heightsCycle = [620, 540, 700, 580, 660, 520, 640, 600];
  let rowCount = 0;

  while (idx < RAW.length) {
    const rowH = heightsCycle[rowCount % heightsCycle.length] + Math.floor(rnd() * 60 - 30);
    const row = [];
    let widthSum = 0;
    while (idx < RAW.length) {
      const ar = RAW[idx][1];
      const w = rowH * ar;
      if (row.length > 0 && widthSum + PAD + w > usableW * 1.05) break;
      row.push({ idx, ar, w, h: rowH });
      widthSum += w + (row.length > 1 ? PAD : 0);
      idx++;
      if (row.length >= 6) break;
    }
    if (row.length === 0) break;

    const scale = usableW / widthSum;
    const scaledH = row[0].h * scale;
    let x = X_MIN;
    let maxJitter = 0;
    for (const it of row) {
      const w = it.w * scale;
      const h = it.h * scale;
      const jitterY = (rnd() - 0.5) * 14;
      const cx = x + w / 2 + (rnd() - 0.5) * 10;
      const cy = y + h / 2 + jitterY;
      const tilt = (rnd() - 0.5) * tiltAmount * 2;
      const raw = RAW[it.idx];
      photos.push({
        photoId: raw[0],
        preRotate: raw[2] || 0,
        src: window.__resources && window.__resources['m' + String(raw[0]).padStart(2, '0')] || `memories/m${String(raw[0]).padStart(2, '0')}.jpeg`,
        x: cx, y: cy, w, h, tilt
      });
      maxJitter = Math.max(maxJitter, Math.abs(jitterY));
      x += w + PAD;
    }
    // No overlap: full row height + spacing + worst-case jitter + tilt clearance
    const tiltClearance = Math.sin(Math.abs(tiltAmount) * Math.PI / 180) * scaledH * 0.5;
    y += scaledH + rowSpacingPx + maxJitter + tiltClearance;
    rowCount++;
  }
  return photos;
}

// ─── Camera path (smooth, one keyframe per photo) ───────────────────────────

// Smoother easing — easeInOutQuint for fewer abrupt accelerations
const easeQuint = (t) => t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
const easeQuart = (t) => t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;

function buildPath(photos, pacePerPhoto, canvasH, smoothness) {
  const cx0 = CANVAS_W / 2,cy0 = canvasH / 2;
  // Cover-fit so the opening/closing collage view fills the viewport edge-to-edge.
  const coverScale = Math.max(VIEW_W / CANVAS_W, VIEW_H / canvasH);
  const easer = smoothness >= 1 ? easeQuint : easeQuart;

  const beats = [];
  beats.push({ t: 0.0, cx: cx0 - 300, cy: cy0 - 200, scale: coverScale * 1.00 });
  beats.push({ t: 4.5, cx: cx0 + 200, cy: cy0 + 120, scale: coverScale * 1.06 });

  // Smooth bridge into the first photo — intermediate beat keeps acceleration low.
  let t = 4.5;
  if (photos.length > 0) {
    const p0 = photos[0];
    const zoom0 = Math.min(VIEW_W * 0.78 / p0.w, VIEW_H * 0.80 / p0.h);
    const midScale = Math.sqrt(coverScale * 1.06 * zoom0);
    const midCx = (cx0 + 200 + p0.x) / 2;
    const midCy = (cy0 + 120 + p0.y) / 2;
    beats.push({ t: t + 2.2, cx: midCx, cy: midCy, scale: midScale });
    t += 2.2;
  }

  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    const zoomScale = Math.min(VIEW_W * 0.78 / p.w, VIEW_H * 0.80 / p.h);
    const approach = i === 0 ? pacePerPhoto * 1.4 : pacePerPhoto * 0.7;
    beats.push({ t: t + approach, cx: p.x, cy: p.y, scale: zoomScale });
    beats.push({ t: t + approach + pacePerPhoto * 0.3, cx: p.x + 6, cy: p.y - 4, scale: zoomScale * 1.03 });
    t += approach + pacePerPhoto * 0.3;
  }

  beats.push({ t: t + 3.0, cx: cx0, cy: cy0, scale: coverScale * 1.02 });
  beats.push({ t: t + 6.0, cx: cx0, cy: cy0, scale: coverScale * 0.98 });

  return { beats, easer, fitScale: coverScale };
}

function sampleCamera(time, beats, easer) {
  if (time <= beats[0].t) return beats[0];
  if (time >= beats[beats.length - 1].t) return beats[beats.length - 1];
  for (let i = 0; i < beats.length - 1; i++) {
    if (time >= beats[i].t && time <= beats[i + 1].t) {
      const a = beats[i],b = beats[i + 1];
      const span = b.t - a.t;
      const local = span === 0 ? 0 : (time - a.t) / span;
      const e = easer(local);
      return {
        cx: a.cx + (b.cx - a.cx) * e,
        cy: a.cy + (b.cy - a.cy) * e,
        scale: a.scale + (b.scale - a.scale) * e
      };
    }
  }
  return beats[beats.length - 1];
}

function clamp01(v) {return Math.max(0, Math.min(1, v));}

// ─── Components ─────────────────────────────────────────────────────────────

function Photo({ p, index, padding, rotation, onClick, editMode }) {
  const time = useTime();
  const breathe = 1 + Math.sin(time * 0.35 + index * 0.6) * 0.0025;
  const drift = Math.sin(time * 0.22 + index * 0.9) * 0.6;
  const rot = (rotation || 0) % 360;

  return (
    <div
      onClick={editMode ? onClick : undefined}
      style={{
        position: "absolute",
        left: p.x - p.w / 2,
        top: p.y - p.h / 2 + drift,
        width: p.w,
        height: p.h,
        transform: `rotate(${p.tilt}deg) scale(${breathe})`,
        transformOrigin: "center center",
        background: "#fafaf6",
        padding: padding,
        boxShadow:
        "0 28px 64px rgba(15,8,4,0.6), 0 8px 20px rgba(15,8,4,0.4), inset 0 0 0 1px rgba(255,255,255,0.55)",
        borderRadius: 3,
        cursor: editMode ? "pointer" : "default",
        outline: editMode ? "2px dashed rgba(243,230,207,0.35)" : "none",
        outlineOffset: 2
      }}
      title={editMode ? `Click to rotate photo ${p.photoId} (${rot}°)` : undefined}>
      
      <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden", background: "#222" }}>
        {(() => {
          const totalRot = (((p.preRotate || 0) + rot) % 360 + 360) % 360;
          const swap = totalRot === 90 || totalRot === 270;
          const innerW = p.w - padding * 2;
          const innerH = p.h - padding * 2;
          // When the image is rotated 90/270, swap the rendered width/height so the
          // rotated bounding box matches the frame exactly — no crop, no blank space.
          const imgStyle = swap ? {
            position: "absolute", left: "50%", top: "50%",
            width: innerH, height: innerW,
            transform: `translate(-50%, -50%) rotate(${totalRot}deg)`,
            transformOrigin: "center center",
            objectFit: "fill", display: "block"
          } : {
            width: "100%", height: "100%", objectFit: "fill", display: "block"
          };
          return <img src={p.src} alt="" style={{ ...imgStyle, objectFit: "contain" }} draggable={false} loading="eager" />;
        })()}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(160deg, rgba(255,210,150,0.08), rgba(80,30,10,0.16))",
          mixBlendMode: "multiply",
          pointerEvents: "none"
        }} />
      </div>
    </div>);

}

function Grain({ amount }) {
  const time = useTime();
  const shift = Math.floor(time * 24) % 8;
  if (amount <= 0) return null;
  return (
    <div style={{
      position: "absolute", inset: -50, pointerEvents: "none",
      backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.95' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.6  0 0 0 0 0.55  0 0 0 0 0.48  0 0 0 0.7 0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.45'/></svg>")`,
      backgroundSize: "240px 240px",
      opacity: amount,
      transform: `translate(${shift * 7}px, ${shift * 5}px)`,
      mixBlendMode: "overlay"
    }} />);

}

function TitleOverlay({ total, show }) {
  const time = useTime();
  if (!show) return null;
  const introIn = clamp01((time - 0.4) / 1.4);
  const introOut = clamp01((time - 3.2) / 1.4);
  const introAlpha = introIn * (1 - introOut);

  const closeStart = total - 5.0;
  const closeIn = clamp01((time - closeStart) / 1.8);
  const closeOut = clamp01((time - (total - 0.8)) / 0.8);
  const closeAlpha = closeIn * (1 - closeOut);

  return (
    <>
      <div style={{
        position: "absolute", inset: 0, display: "flex",
        alignItems: "center", justifyContent: "center",
        pointerEvents: "none", opacity: introAlpha
      }}>
        <div style={{ textAlign: "center", color: "#f3e6cf",
          textShadow: "0 4px 30px rgba(0,0,0,0.7)",
          transform: `translateY(${(1 - introIn) * 12}px)`
        }}>
          <div style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 28 * UI_SCALE, letterSpacing: 14 * UI_SCALE, textTransform: "uppercase",
            opacity: 0.75, marginBottom: 18 * UI_SCALE
          }}>A Life in Frames</div>
          <div style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontStyle: "italic", fontSize: 110 * UI_SCALE, fontWeight: 400, lineHeight: 1.0
          }}>For those we hold</div>
        </div>
      </div>

      <div style={{
        position: "absolute", inset: 0, display: "flex",
        alignItems: "center", justifyContent: "center",
        pointerEvents: "none", opacity: closeAlpha
      }}>
        <div style={{ textAlign: "center", color: "#f3e6cf",
          textShadow: "0 4px 30px rgba(0,0,0,0.85)"
        }}>
          <div style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontStyle: "italic", fontSize: 96 * UI_SCALE, fontWeight: 400, lineHeight: 1.0, marginBottom: 22 * UI_SCALE
          }}>Every face a chapter.</div>
          <div style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 22 * UI_SCALE, letterSpacing: 10 * UI_SCALE, textTransform: "uppercase", opacity: 0.7
          }}>Every frame a homecoming</div>
        </div>
      </div>
    </>);

}

// ─── Stage wrapper ──────────────────────────────────────────────────────────

function Collage({ t, editMode, onRotate }) {
  const layout = React.useMemo(
    () => buildLayout(t.rowSpacing, t.tiltAmount),
    [t.rowSpacing, t.tiltAmount]
  );
  const canvasH = React.useMemo(() => {
    const maxY = Math.max(...layout.map((p) => p.y + p.h / 2));
    return maxY + 240;
  }, [layout]);

  const { beats, easer } = React.useMemo(
    () => buildPath(layout, t.pace, canvasH, t.smoothness),
    [layout, canvasH, t.pace, t.smoothness]
  );
  const total = beats[beats.length - 1].t;

  // Publish total duration to Stage via context-less side-channel
  React.useEffect(() => {
    window.__collageDuration = total;
    window.dispatchEvent(new Event("__collageDurationChange"));
  }, [total]);

  const time = useTime();
  const cam = sampleCamera(time, beats, easer);
  const tx = VIEW_W / 2 - cam.cx * cam.scale;
  const ty = VIEW_H / 2 - cam.cy * cam.scale;

  // Warmth-driven background gradient stops
  const warm = t.warmth;
  const bg = `radial-gradient(ellipse at 50% 45%,
    rgb(${42 + warm * 30}, ${31 - warm * 4}, ${23 - warm * 6}) 0%,
    rgb(${21 + warm * 12}, ${16 - warm * 2}, ${11 - warm * 4}) 60%,
    rgb(${7 + warm * 4}, ${5}, ${10}) 100%)`;

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: bg }}>
      <div style={{
        position: "absolute",
        width: CANVAS_W,
        height: canvasH,
        left: 0, top: 0,
        transformOrigin: "0 0",
        transform: `translate(${tx}px, ${ty}px) scale(${cam.scale})`,
        willChange: "transform"
      }}>
        {layout.map((p, i) =>
        <Photo
          key={p.photoId}
          p={p}
          index={i}
          padding={t.padding}
          rotation={t.rotations[p.photoId] || 0}
          editMode={editMode}
          onClick={() => onRotate(p.photoId)} />

        )}
      </div>

      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,${t.vignette}) 100%)`
      }} />
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `linear-gradient(180deg, rgba(60,28,8,${0.05 + warm * 0.10}), rgba(15,8,4,${0.10 + warm * 0.15}))`,
        mixBlendMode: "multiply"
      }} />
      <Grain amount={t.grain} />
      <TitleOverlay total={total} show={t.showTitles} />

      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 60, background: "#000", pointerEvents: "none", zIndex: 5 }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 60, background: "#000", pointerEvents: "none", zIndex: 5 }} />
    </div>);

}

// ─── Tweaks UI ──────────────────────────────────────────────────────────────

function TweaksUI({ t, setTweak, resetRotations }) {
  return (
    <TweaksPanel>
      <TweakSection label="Motion" />
      <TweakSlider label="Pace per photo" value={t.pace} min={0.8} max={4} step={0.1} unit="s"
      onChange={(v) => setTweak('pace', v)} />
      <TweakRadio label="Smoothness" value={t.smoothness === 1 ? 'butter' : 'standard'}
      options={['standard', 'butter']}
      onChange={(v) => setTweak('smoothness', v === 'butter' ? 1 : 0)} />

      <TweakSection label="Frames" />
      <TweakSlider label="Tilt" value={t.tiltAmount} min={0} max={12} step={0.5} unit="°"
      onChange={(v) => setTweak('tiltAmount', v)} />
      <TweakSlider label="Border" value={t.padding} min={0} max={28} step={1} unit="px"
      onChange={(v) => setTweak('padding', v)} />
      <TweakSlider label="Row spacing" value={t.rowSpacing} min={0} max={160} step={4} unit="px"
      onChange={(v) => setTweak('rowSpacing', v)} />

      <TweakSection label="Look" />
      <TweakSlider label="Vignette" value={t.vignette} min={0} max={0.9} step={0.05}
      onChange={(v) => setTweak('vignette', v)} />
      <TweakSlider label="Grain" value={t.grain} min={0} max={0.6} step={0.02}
      onChange={(v) => setTweak('grain', v)} />
      <TweakSlider label="Warmth" value={t.warmth} min={0} max={1} step={0.05}
      onChange={(v) => setTweak('warmth', v)} />
      <TweakToggle label="Show titles" value={t.showTitles}
      onChange={(v) => setTweak('showTitles', v)} />

      <TweakSection label="Photo orientation" />
      <div style={{ fontSize: 11, color: 'rgba(41,38,27,.6)', lineHeight: 1.45 }}>
        Click any photo to rotate it 90°. Click 4× to reset.
      </div>
      <TweakButton label="Reset all rotations" onClick={resetRotations} />
    </TweaksPanel>);

}

// ─── App ────────────────────────────────────────────────────────────────────

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [editMode, setEditMode] = React.useState(false);
  const [duration, setDuration] = React.useState(180);

  // Listen for the host's edit-mode toggle so we can put images into "click to rotate" mode
  React.useEffect(() => {
    const handler = (e) => {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === '__activate_edit_mode') setEditMode(true);
      if (e.data.type === '__deactivate_edit_mode') setEditMode(false);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Track total duration published by Collage
  React.useEffect(() => {
    const sync = () => setDuration(window.__collageDuration || 180);
    window.addEventListener('__collageDurationChange', sync);
    sync();
    return () => window.removeEventListener('__collageDurationChange', sync);
  }, []);

  const rotatePhoto = React.useCallback((photoId) => {
    const cur = t.rotations && t.rotations[photoId] || 0;
    const next = (cur + 90) % 360;
    const merged = { ...(t.rotations || {}) };
    if (next === 0) delete merged[photoId];else
    merged[photoId] = next;
    setTweak('rotations', merged);
  }, [t.rotations, setTweak]);

  const resetRotations = React.useCallback(() => {
    setTweak('rotations', {});
  }, [setTweak]);

  return (
    <>
      <Stage width={VIEW_W} height={VIEW_H} duration={duration} background="#07050a" fps={60}>
        <Collage t={t} editMode={editMode} onRotate={rotatePhoto} />
      </Stage>
      <TweaksUI t={t} setTweak={setTweak} resetRotations={resetRotations} />
    </>);

}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
// photobooth-ui.jsx — UI sous-composants : panneaux, contrôles, galerie
// Charge AVANT photobooth-app.jsx

// ─── Icons (inline SVG, monoline) ──────────────────────────────────────────
const Icon = ({ d, size = 22, stroke = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={stroke}
       strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

const Icons = {
  camera: <Icon d={<><path d="M3 7h3l2-2h8l2 2h3v12H3z" /><circle cx="12" cy="13" r="4" /></>} />,
  burst: <Icon d={<><rect x="3" y="6" width="14" height="14" rx="1.5" /><path d="M7 3h13v13" /></>} />,
  boomerang: <Icon d={<><path d="M3 21c3-9 9-15 18-18" /><path d="M3 21l4-2" /><path d="M3 21l2-4" /></>} />,
  lensWide: <Icon d={<><circle cx="12" cy="12" r="8" /><path d="M4 12h16M8 7c-1.5 3-1.5 7 0 10M16 7c1.5 3 1.5 7 0 10" /></>} />,
  lensNormal: <Icon d={<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>} />,
  sparkle: <Icon d={<><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" /></>} />,
  timer: <Icon d={<><circle cx="12" cy="13" r="8" /><path d="M12 13V9M9 3h6" /></>} />,
  gallery: <Icon d={<><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="1.5" /><path d="M3 17l5-4 4 3 4-5 5 6" /></>} />,
  settings: <Icon d={<><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.4 1a7 7 0 0 0-2.1-1.2L14 3h-4l-.4 2.6a7 7 0 0 0-2.1 1.2l-2.4-1-2 3.5 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 2.1 1.2L10 21h4l.4-2.6a7 7 0 0 0 2.1-1.2l2.4 1 2-3.5-2-1.5c.1-.4.1-.8.1-1.2z" /></>} />,
  check: <Icon d={<path d="M5 12l5 5L20 7" />} stroke={2.4} />,
  x: <Icon d={<><path d="M6 6l12 12M18 6L6 18" /></>} stroke={2.4} />,
  trash: <Icon d={<><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" /></>} />,
  download: <Icon d={<><path d="M12 4v12M6 12l6 6 6-6M4 20h16" /></>} />,
  print: <Icon d={<><rect x="6" y="14" width="12" height="7" /><path d="M6 14V4h12v10M6 18H3v-6h18v6h-3" /></>} />,
  close: <Icon d={<><path d="M6 6l12 12M18 6L6 18" /></>} stroke={2} />,
  filter: <Icon d={<><circle cx="8" cy="9" r="5" /><circle cx="16" cy="15" r="5" /></>} />,
  rotate: <Icon d={<><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5" /></>} />,
  move: <Icon d={<><path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" /></>} />,
  trashSmall: <Icon size={18} d={<><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></>} />,
  plus: <Icon d={<><path d="M12 5v14M5 12h14" /></>} stroke={2.2} />,
};

// ─── Label avec style thème ────────────────────────────────────────────────
const Label = ({ children, style }) => {
  const T = window.__THEME;
  return (
    <div style={{
      fontSize: 12,
      fontWeight: T.labelWeight,
      letterSpacing: T.labelTracking,
      textTransform: T.labelTransform,
      color: T.textMuted,
      fontFamily: T.fontUI,
      ...style,
    }}>{children}</div>
  );
};

// ─── Bouton générique tactile ──────────────────────────────────────────────
const TactileButton = ({
  active, onClick, children, icon, vertical, big, primary, danger,
  style, disabled, ariaLabel,
}) => {
  const T = window.__THEME;
  const bsize = window.__BTN_SIZE || 1;
  const padY = (big ? 18 : 14) * bsize;
  const padX = (big ? 28 : 22) * bsize;
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      style={{
        appearance: 'none',
        border: `1px solid ${active ? T.borderStrong : T.border}`,
        borderRadius: T.rMd,
        background: primary ? T.accent : (active ? T.surfaceStrong : T.surface),
        color: primary ? T.accentText : (danger ? T.danger : T.text),
        padding: `${padY}px ${padX}px`,
        fontSize: 16 * bsize,
        fontWeight: 500,
        fontFamily: T.fontUI,
        display: 'flex',
        flexDirection: vertical ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: vertical ? 6 : 10,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'background .15s, border-color .15s, transform .08s',
        whiteSpace: 'nowrap',
        ...style,
      }}
      onPointerDown={(e) => e.currentTarget.style.transform = 'scale(0.97)'}
      onPointerUp={(e) => e.currentTarget.style.transform = ''}
      onPointerLeave={(e) => e.currentTarget.style.transform = ''}
    >
      {icon}
      {children}
    </button>
  );
};

// ─── Segment / chip group (touch-friendly) ─────────────────────────────────
const ChipGroup = ({ options, value, onChange, vertical }) => {
  const T = window.__THEME;
  const bsize = window.__BTN_SIZE || 1;
  return (
    <div style={{
      display: 'flex',
      flexDirection: vertical ? 'column' : 'row',
      gap: 8,
      padding: 6,
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: T.rMd,
    }}>
      {options.map((o) => {
        const v = typeof o === 'object' ? o.value : o;
        const l = typeof o === 'object' ? o.label : o;
        const ic = typeof o === 'object' ? o.icon : null;
        const on = value === v;
        return (
          <button key={String(v)} type="button" onClick={() => onChange(v)}
            style={{
              appearance: 'none',
              border: 'none',
              background: on ? T.accent : 'transparent',
              color: on ? T.accentText : T.text,
              fontFamily: T.fontUI,
              fontSize: 15 * bsize,
              fontWeight: on ? 600 : 500,
              padding: `${10 * bsize}px ${18 * bsize}px`,
              borderRadius: T.rSm,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              flex: vertical ? '0 0 auto' : 1,
              justifyContent: 'center',
              transition: 'background .15s',
              whiteSpace: 'nowrap',
            }}>
            {ic}{l}
          </button>
        );
      })}
    </div>
  );
};

// ─── Shutter button (gros bouton central) ──────────────────────────────────
const ShutterButton = ({ onClick, disabled, mode }) => {
  const T = window.__THEME;
  const size = 130;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Déclencher"
      style={{
        appearance: 'none',
        width: size, height: size,
        borderRadius: '50%',
        border: `4px solid ${T.shutterRing}`,
        background: T.glass,
        backdropFilter: T.glassBlur,
        WebkitBackdropFilter: T.glassBlur,
        padding: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: T.shadow,
        transition: 'transform .12s cubic-bezier(.3,.7,.4,1)',
        position: 'relative',
      }}
      onPointerDown={(e) => e.currentTarget.style.transform = 'scale(0.94)'}
      onPointerUp={(e) => e.currentTarget.style.transform = ''}
      onPointerLeave={(e) => e.currentTarget.style.transform = ''}
    >
      <div style={{
        width: size - 28, height: size - 28,
        borderRadius: '50%',
        background: T.shutterBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: T.shutterCore,
        boxShadow: '0 4px 18px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.4)',
      }}>
        {mode === 'burst' && (
          <div style={{ fontFamily: T.fontDisplay, fontSize: 28, fontWeight: 700, color: T.shutterCore }}>×4</div>
        )}
        {mode === 'boomerang' && (
          <div style={{ fontFamily: T.fontDisplay, fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', color: T.shutterCore }}>BOOM</div>
        )}
        {mode === 'single' && (
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: T.shutterCore }} />
        )}
      </div>
    </button>
  );
};

// ─── Galerie (drawer latéral droit) ────────────────────────────────────────
const GalleryDrawer = ({ open, photos, onClose, onDelete }) => {
  const T = window.__THEME;
  return (
    <div style={{
      position: 'absolute',
      top: 0, right: 0, bottom: 0,
      width: 420,
      background: T.glass,
      backdropFilter: T.glassBlur,
      WebkitBackdropFilter: T.glassBlur,
      borderLeft: `1px solid ${T.border}`,
      transform: open ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform .3s cubic-bezier(.3,.7,.4,1)',
      display: 'flex', flexDirection: 'column',
      zIndex: 20,
      color: T.text,
    }}>
      <div style={{
        padding: '24px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${T.border}`,
      }}>
        <div>
          <Label>Galerie</Label>
          <div style={{ fontFamily: T.fontDisplay, fontSize: 28, fontWeight: 600, marginTop: 4 }}>
            {photos.length} photo{photos.length !== 1 ? 's' : ''}
          </div>
        </div>
        <button type="button" onClick={onClose}
          style={{
            appearance: 'none', border: 'none', background: T.surface,
            color: T.text, width: 44, height: 44, borderRadius: T.rPill,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}>{Icons.close}</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {photos.length === 0 && (
          <div style={{ gridColumn: 'span 2', textAlign: 'center', color: T.textFaint, padding: 40, fontFamily: T.fontUI, fontSize: 15 }}>
            Aucune photo pour l'instant.<br />Lance ta première capture.
          </div>
        )}
        {photos.slice().reverse().map((p) => (
          <div key={p.id} style={{
            aspectRatio: '4/3',
            background: T.surface,
            borderRadius: T.rSm,
            overflow: 'hidden',
            position: 'relative',
            border: `1px solid ${T.border}`,
          }}>
            <img src={p.dataUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              padding: '8px 10px',
              background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
              color: '#fff',
              fontFamily: T.fontMono, fontSize: 10,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>{p.time}</span>
              {p.hasDecoration && <span style={{ background: T.accent, color: T.accentText, padding: '2px 6px', borderRadius: T.rSm }}>déco</span>}
            </div>
            <button type="button" onClick={() => onDelete(p.id)}
              style={{
                position: 'absolute', top: 8, right: 8,
                appearance: 'none', border: 'none',
                background: 'rgba(0,0,0,0.55)', color: '#fff',
                width: 32, height: 32, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}>{Icons.trashSmall}</button>
          </div>
        ))}
      </div>
    </div>
  );
};

Object.assign(window, { Icons, Icon, Label, TactileButton, ChipGroup, ShutterButton, GalleryDrawer });

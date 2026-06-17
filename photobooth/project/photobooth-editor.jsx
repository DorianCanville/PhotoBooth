// photobooth-editor.jsx — Éditeur photo post-capture (depuis la galerie) + FilterRow partagé
// Charge APRÈS photobooth-deco.jsx, AVANT photobooth-main.jsx

// ─── Sélecteur de filtre horizontal (review + éditeur) ─────────────────────
function FilterRow({ value, onChange, compact }) {
  const T = window.__THEME;
  const bsize = window.__BTN_SIZE || 1;
  return (
    <div style={{
      display: 'flex', gap: 8, padding: 6,
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: T.rMd, flexWrap: 'wrap', justifyContent: 'center',
    }}>
      {FILTERS.map((f) => {
        const on = value === f.value;
        return (
          <button key={f.value} type="button" onClick={() => onChange(f.value)}
            style={{
              appearance: 'none', border: 'none',
              background: on ? T.accent : 'transparent',
              color: on ? T.accentText : T.text,
              fontFamily: T.fontUI, fontSize: (compact ? 13 : 15) * bsize,
              fontWeight: on ? 600 : 500,
              padding: `${(compact ? 8 : 10) * bsize}px ${(compact ? 14 : 18) * bsize}px`,
              borderRadius: T.rSm, cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'background .15s',
            }}>{f.label}</button>
        );
      })}
    </div>
  );
}

// ─── Éditeur photo ─────────────────────────────────────────────────────────
function PhotoEditor({ photo, savedTexts = [], customStickers = [], onSave, onClose }) {
  const T = window.__THEME;
  const { useState, useEffect, useRef, useLayoutEffect, useCallback } = React;

  const [baseImg, setBaseImg] = useState(null);
  const [editFilter, setEditFilter] = useState(photo.filter || 'none');
  const [editDecos, setEditDecos] = useState(() => (photo.decoSnapshot || []).map((d, i) => ({
    ...d,
    id: 'e' + i + '-' + Date.now(),
    ...(d.kind === 'image' && !d.sourceId ? { sourceId: d.id } : {}),
  })));
  const [selectedDeco, setSelectedDeco] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [scale, setScale] = useState(0.4);

  const outerRef = useRef(null);
  const stageRef = useRef(null);

  // Charge l'image de base
  useEffect(() => {
    let alive = true;
    loadImageCached(photo.baseUrl).then((img) => { if (alive) setBaseImg(img); });
    return () => { alive = false; };
  }, [photo.baseUrl]);

  // Calcule le scale du stage logique (1920 large) pour tenir dans l'espace dispo
  useLayoutEffect(() => {
    const measure = () => {
      if (!outerRef.current) return;
      const w = outerRef.current.clientWidth;
      setScale(w / 1920);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const filterCss = FILTERS.find((f) => f.value === editFilter)?.css || 'none';

  // ─── Manip décos ─────────────────────────────────────────────────────────
  const updateDeco = useCallback((id, patch) => {
    setEditDecos((prev) => prev.map((d) => d.id === id ? { ...d, ...patch } : d));
  }, []);
  const deleteDeco = useCallback((id) => {
    setEditDecos((prev) => prev.filter((d) => d.id !== id));
    setSelectedDeco(null);
  }, []);
  const addSticker = useCallback((stickerId) => {
    const id = 'e' + Date.now();
    setEditDecos((prev) => [...prev, { id, kind: 'sticker', stickerId, x: 50, y: 50, scale: 1, rotate: 0 }]);
    setSelectedDeco(id);
    setPickerOpen(false);
  }, []);
  const addText = useCallback((cfg) => {
    const id = 'e' + Date.now();
    setEditDecos((prev) => [...prev, { id, kind: 'text', ...cfg, x: 50, y: 50, scale: 1, rotate: 0 }]);
    setSelectedDeco(id);
    setPickerOpen(false);
  }, []);
  const addSavedText = useCallback((textObj) => {
    const id = 'e' + Date.now();
    const { id: _o, byAdmin: _b, ...cfg } = textObj;
    setEditDecos((prev) => [...prev, { id, kind: 'text', ...cfg, x: 50, y: 50, scale: 1, rotate: 0 }]);
    setSelectedDeco(id);
    setPickerOpen(false);
  }, []);
  const clearAll = useCallback(() => { setEditDecos([]); setSelectedDeco(null); }, []);

  // ─── Sauvegarde ──────────────────────────────────────────────────────────
  const doSave = useCallback(() => {
    if (!baseImg) return;
    const dataUrl = composePhoto(baseImg, filterCss, editDecos, true);
    const dataUrlRaw = composePhoto(baseImg, filterCss, editDecos, false);
    onSave({
      baseUrl: photo.baseUrl,
      filter: editFilter,
      decorations: editDecos,
      dataUrl, dataUrlRaw,
    });
  }, [baseImg, filterCss, editDecos, editFilter, photo.baseUrl, onSave]);

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 65,
      background: '#000',
      color: T.text, fontFamily: T.fontUI,
      overflow: 'hidden',
    }}>
      {/* Photo plein écran */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div ref={outerRef} onPointerDown={(e) => { if (e.target === e.currentTarget) setSelectedDeco(null); }}
          style={{
            width: 'min(100vw, calc(100vh * 1.3333))',
            aspectRatio: '4 / 3',
            position: 'relative', overflow: 'hidden',
            background: '#000',
          }}>
          {/* Stage logique 1920 de large (cohérent avec le rendu canvas) */}
          <div ref={stageRef}
            style={{
              position: 'absolute', top: 0, left: 0,
              width: 1920, height: 1440,
              transformOrigin: 'top left',
              transform: `scale(${scale})`,
            }}>
            {baseImg && (
              <img src={photo.baseUrl} alt=""
                draggable={false}
                style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%',
                  objectFit: 'cover', filter: filterCss, pointerEvents: 'none',
                }} />
            )}
            {editDecos.map((d) => (
              <DraggableDecoration key={d.id} deco={d}
                selected={selectedDeco === d.id}
                canMove={true} canDelete={true}
                onSelect={setSelectedDeco}
                onChange={updateDeco}
                onDelete={deleteDeco}
                containerRef={stageRef} />
            ))}
          </div>
        </div>
      </div>

      {/* Top bar flottante */}
      <div style={{
        position: 'absolute', top: 24, left: 30, right: 30,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        zIndex: 15, pointerEvents: 'none',
      }}>
        <div style={{ pointerEvents: 'auto', display: 'flex', gap: 14, alignItems: 'center' }}>
          <button type="button" onClick={() => setPickerOpen((v) => !v)}
            style={{
              appearance: 'none', border: `1px solid ${pickerOpen ? T.borderStrong : T.border}`,
              background: pickerOpen ? T.accent : T.glass,
              color: pickerOpen ? T.accentText : T.text,
              backdropFilter: T.glassBlur, WebkitBackdropFilter: T.glassBlur,
              padding: '14px 22px', borderRadius: T.rPill,
              fontFamily: T.fontUI, fontSize: 15, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
            }}>
            {Icons.sparkle}<span>Décoration{editDecos.length > 0 ? ` (${editDecos.length})` : ''}</span>
          </button>
          <div style={{
            padding: '10px 18px',
            background: T.glass, backdropFilter: T.glassBlur, WebkitBackdropFilter: T.glassBlur,
            border: `1px solid ${T.border}`, borderRadius: T.rPill,
          }}>
            <div style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.12em', color: T.accent, fontWeight: 600 }}>
              ✎ MODIFIER
            </div>
            <div style={{ fontFamily: T.fontUI, fontSize: 13, color: T.textMuted }}>crée une copie</div>
          </div>
        </div>
        <button type="button" onClick={onClose}
          style={{
            pointerEvents: 'auto',
            appearance: 'none', border: `1px solid ${T.border}`, background: T.glass,
            backdropFilter: T.glassBlur, WebkitBackdropFilter: T.glassBlur,
            color: T.text, width: 52, height: 52, borderRadius: T.rPill,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>{Icons.close}</button>
      </div>

      {/* Picker (réutilisé) — flottant */}
      <DecorationPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAddSticker={addSticker}
        onAddText={addText}
        onOpenOfficial={() => {}}
        hideOfficial={true}
        adminUnlocked={false}
        onClearAll={clearAll}
        hasAnyUserDeco={editDecos.length > 0}
        customStickers={customStickers}
        onBeginStickerImport={() => {}}
        onDeleteCustomSticker={() => {}}
        savedTexts={savedTexts}
        onAddSavedText={addSavedText}
        onDeleteSavedText={() => {}}
        onClearAllTexts={() => {}} />

      {/* Barre flottante du bas */}
      <div style={{
        position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        zIndex: 15,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        padding: '14px 24px',
        background: T.glass, backdropFilter: T.glassBlur, WebkitBackdropFilter: T.glassBlur,
        border: `1px solid ${T.border}`, borderRadius: T.rLg,
        boxShadow: T.shadow,
        maxWidth: 'calc(100% - 60px)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          <Label>Filtre</Label>
          <FilterRow value={editFilter} onChange={setEditFilter} compact />
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          <TactileButton onClick={onClose}>
            <span>Annuler</span>
          </TactileButton>
          <TactileButton onClick={doSave} icon={Icons.check} primary big disabled={!baseImg}>
            <span>Enregistrer une copie</span>
          </TactileButton>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { FilterRow, PhotoEditor });

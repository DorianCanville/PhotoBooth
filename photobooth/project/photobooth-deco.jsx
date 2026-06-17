// photobooth-deco.jsx — UI décorations : draggable, picker, official editor, PIN, viewer galerie
// Charge APRÈS photobooth-app.jsx, AVANT photobooth-main.jsx

// ─── Draggable decoration (rendu DOM + handles) ────────────────────────────
function DraggableDecoration({ deco, selected, canMove = true, canDelete = true, showLockBadge = false, onSelect, onChange, onDelete, containerRef }) {
  const T = window.__THEME;
  const ref = useRef(null);

  const onPointerDown = (e) => {
    if (!canMove) {
      // Si pas déplaçable, on permet quand même la sélection pour faire apparaître la corbeille
      if (canDelete) {
        e.stopPropagation();
        onSelect(deco.id);
      }
      return;
    }
    e.stopPropagation();
    onSelect(deco.id);
    if (e.target.dataset.handle) return;
    const startX = e.clientX, startY = e.clientY;
    const startPos = { x: deco.x, y: deco.y };
    const rect = containerRef.current.getBoundingClientRect();
    const move = (ev) => {
      const dx = ((ev.clientX - startX) / rect.width) * 100;
      const dy = ((ev.clientY - startY) / rect.height) * 100;
      onChange(deco.id, {
        x: Math.max(0, Math.min(100, startPos.x + dx)),
        y: Math.max(0, Math.min(100, startPos.y + dy)),
      });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const handlePointerEvent = (action) => (e) => {
    e.stopPropagation();
    if (action === 'resize') {
      const startX = e.clientX;
      const startScale = deco.scale;
      const move = (ev) => onChange(deco.id, { scale: Math.max(0.15, Math.min(8, startScale + (ev.clientX - startX) / 150)) });
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    } else if (action === 'rotate') {
      const rect = ref.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
      const startRot = deco.rotate;
      const move = (ev) => {
        const a = Math.atan2(ev.clientY - cy, ev.clientX - cx);
        onChange(deco.id, { rotate: startRot + ((a - startAngle) * 180) / Math.PI });
      };
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    }
  };

  // ─── Détermine taille de base + ratio ───────────────────────────────────
  let baseW = `${22 * deco.scale}%`;
  let aspectRatio = 1;
  let content = null;
  let isFullScreen = false;

  if (deco.kind === 'sticker') {
    const tpl = findSticker(deco.stickerId);
    if (!tpl) return null;
    if (tpl.full) {
      isFullScreen = true;
      baseW = '100%';
      aspectRatio = 4 / 3;
    } else {
      aspectRatio = tpl.aspect;
    }
    const src = tpl.imageUrl || makeSvgUrl(tpl.svg);
    content = <img src={src} alt="" draggable={false}
      style={{ width: '100%', height: '100%', pointerEvents: 'none', filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.3))' }} />;
  } else if (deco.kind === 'image') {
    content = <img src={deco.imageUrl} alt="" draggable={false}
      style={{ width: '100%', height: 'auto', pointerEvents: 'none', filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.35))', display: 'block' }} />;
    // Auto aspect — laisse fluide
    aspectRatio = 'auto';
  } else if (deco.kind === 'text') {
    baseW = 'auto';
    aspectRatio = 'auto';
    const fontSize = 60 * deco.scale;
    const hasBg = deco.bg && deco.bg !== 'none';
    content = (
      <div style={{
        fontFamily: deco.font,
        fontSize: `${fontSize}px`,
        fontWeight: deco.weight || 700,
        color: deco.color || '#ffffff',
        background: hasBg ? deco.bg : 'transparent',
        padding: hasBg ? '0.3em 0.7em' : 0,
        borderRadius: '999px',
        whiteSpace: 'nowrap',
        textShadow: hasBg ? 'none' : '0 4px 16px rgba(0,0,0,0.6)',
        lineHeight: 1.05,
        pointerEvents: 'none',
        userSelect: 'none',
      }}>
        {deco.text || ' '}
      </div>
    );
  }

  if (!content) return null;

  return (
    <div
      ref={ref}
      data-decoration={deco.id}
      onPointerDown={onPointerDown}
      style={{
        position: 'absolute',
        left: `${deco.x}%`,
        top: `${deco.y}%`,
        width: baseW,
        ...(aspectRatio !== 'auto' && deco.kind !== 'image' ? { aspectRatio } : {}),
        ...(deco.kind === 'image' ? { width: `${22 * deco.scale}%` } : {}),
        transform: `translate(-50%, -50%) rotate(${deco.rotate}deg)`,
        cursor: canMove ? 'move' : (canDelete ? 'pointer' : 'default'),
        touchAction: 'none',
        userSelect: 'none',
        outline: selected ? `2px dashed ${T.accent}` : (showLockBadge ? `1px dashed ${T.accent}80` : 'none'),
        outlineOffset: 8,
        pointerEvents: 'auto',
      }}
    >
      {content}

      {/* Cadenas pour décorations verrouillées (toujours visible discrètement) */}
      {showLockBadge && (
        <div style={{
          position: 'absolute', top: -28, right: -8,
          width: 28, height: 28, borderRadius: '50%',
          background: 'rgba(0,0,0,0.7)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, pointerEvents: 'none',
        }}>🔒</div>
      )}

      {selected && canMove && (
        <>
          {/* Resize handle */}
          <div data-handle="resize" onPointerDown={handlePointerEvent('resize')} style={handleStyle('resize', T)}>↘</div>
          {/* Rotate handle */}
          <div data-handle="rotate" onPointerDown={handlePointerEvent('rotate')} style={handleStyle('rotate', T)}>⟳</div>
          <div style={{
            position: 'absolute', left: '50%', top: -50, width: 1, height: 28,
            transform: 'translate(-50%, 22px)', background: T.accent, pointerEvents: 'none',
          }} />
        </>
      )}
      {selected && canDelete && (
        /* Delete handle */
        <button type="button" data-handle="delete"
          onPointerDown={(e) => { e.stopPropagation(); onDelete(deco.id); }}
          style={handleStyle('delete', T)}>✕</button>
      )}
    </div>
  );
}

function handleStyle(kind, T) {
  const SIZE = 44; // touch-friendly
  const base = {
    position: 'absolute',
    width: SIZE, height: SIZE,
    borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 3px 12px rgba(0,0,0,0.35)',
    fontSize: 20, fontWeight: 700,
    border: 'none',
    cursor: 'pointer',
    userSelect: 'none',
    color: T.accentText,
    background: T.accent,
  };
  if (kind === 'resize') return { ...base, right: -SIZE / 2, bottom: -SIZE / 2, cursor: 'nwse-resize' };
  if (kind === 'rotate') return { ...base, left: '50%', top: -SIZE - 8, transform: 'translateX(-50%)', cursor: 'grab' };
  if (kind === 'delete') return { ...base, right: -SIZE / 2, top: -SIZE / 2, background: '#fff', color: '#000', fontSize: 22 };
  return base;
}

// ─── Decoration picker (avec tabs) ─────────────────────────────────────────
function DecorationPicker({ open, onClose, onAddSticker, onAddText, onOpenOfficial, adminUnlocked = false, onClearAll, hasAnyUserDeco = false, customStickers = [], onBeginStickerImport, onBeginStickerEdit, onDeleteCustomSticker, savedTexts = [], onAddSavedText, onDeleteSavedText, onUpdateSavedText, onClearAllTexts, hideOfficial = false }) {
  const T = window.__THEME;
  const [tab, setTab] = useState('stickers');

  // Text form
  const [text, setText] = useState('');
  const [textFont, setTextFont] = useState(TEXT_FONTS[1]);
  const [textColor, setTextColor] = useState('#ffffff');
  const [textBg, setTextBg] = useState('none');
  const [editingTextId, setEditingTextId] = useState(null); // id du texte en cours d'édition

  const fileRef = useRef(null);
  const stickerFileRef = useRef(null);
  const onStickerFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const label = file.name.replace(/\.[^.]+$/, '').slice(0, 30) || 'Custom';
      onBeginStickerImport?.(label, ev.target.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  if (!open) return null;

  const submitText = () => {
    if (!text.trim()) return;
    if (editingTextId) {
      // Mode édition : met à jour le texte existant
      onUpdateSavedText?.(editingTextId, { text: text.trim(), font: textFont.value, weight: textFont.weight, color: textColor, bg: textBg });
      setEditingTextId(null);
    } else {
      onAddText({ text: text.trim(), font: textFont.value, weight: textFont.weight, color: textColor, bg: textBg });
    }
    setText('');
    setTextColor('#ffffff');
    setTextBg('none');
  };

  // Charge un texte enregistré dans le formulaire pour édition
  const startEditText = (s) => {
    setEditingTextId(s.id);
    setText(s.text || '');
    setTextColor(s.color || '#ffffff');
    setTextBg(s.bg || 'none');
    const f = TEXT_FONTS.find((ff) => ff.value === s.font);
    if (f) setTextFont(f);
  };
  const cancelEditText = () => {
    setEditingTextId(null);
    setText('');
    setTextColor('#ffffff');
    setTextBg('none');
  };

  const tabs = [
    { id: 'stickers', label: 'Stickers' },
    { id: 'text', label: 'Texte' },
  ];

  return (
    <div style={{
      position: 'absolute',
      left: 30, top: 92, bottom: 30,
      width: 460,
      background: T.glass,
      backdropFilter: T.glassBlur,
      WebkitBackdropFilter: T.glassBlur,
      border: `1px solid ${T.border}`,
      borderRadius: T.rLg,
      padding: 22,
      zIndex: 18,
      display: 'flex', flexDirection: 'column',
      boxShadow: T.shadow,
      color: T.text,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Label>Décorations</Label>
          <div style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, marginTop: 4 }}>Ajouter au cadre</div>
        </div>
        <button type="button" onClick={onClose} style={closeBtnStyle(T)}>{Icons.close}</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, padding: 4, background: T.surface, borderRadius: T.rMd, marginBottom: 14 }}>
        {tabs.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            style={{
              flex: 1, appearance: 'none', border: 'none',
              background: tab === t.id ? T.accent : 'transparent',
              color: tab === t.id ? T.accentText : T.text,
              padding: '10px 12px', borderRadius: T.rSm,
              fontFamily: T.fontUI, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>{t.label}</button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {tab === 'stickers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {STICKERS.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {STICKERS.map((d) => (
                  <button key={d.id} type="button" onClick={() => onAddSticker(d.id)}
                    style={pickerCardStyle(T)}
                    onMouseEnter={(e) => Object.assign(e.currentTarget.style, { background: T.surfaceStrong, borderColor: T.borderStrong })}
                    onMouseLeave={(e) => Object.assign(e.currentTarget.style, { background: T.surface, borderColor: T.border })}
                  >
                    <div style={{
                      aspectRatio: '2/1', background: 'rgba(255,255,255,0.96)',
                      borderRadius: T.rSm, padding: 8,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                    }}>
                      <img src={makeSvgUrl(d.svg)} alt=""
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, textAlign: 'left' }}>{d.label}</div>
                  </button>
                ))}
              </div>
            )}

            {customStickers.length === 0 && STICKERS.length === 0 && !adminUnlocked && (
              <div style={{
                padding: 32, border: `1.5px dashed ${T.border}`, borderRadius: T.rMd,
                textAlign: 'center', color: T.textMuted, fontFamily: T.fontUI,
              }}>
                <div style={{ fontSize: 30, marginBottom: 10, opacity: 0.5 }}>🎨</div>
                <div style={{ fontSize: 14, marginBottom: 6 }}>Aucun sticker disponible</div>
                <div style={{ fontSize: 12 }}>Demande à l'admin d'en importer (code 1234)</div>
              </div>
            )}

            {/* Stickers custom (admin) */}
            {(customStickers.length > 0 || adminUnlocked) && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <Label>Stickers admin ({customStickers.length})</Label>
                  {adminUnlocked && (
                    <span style={{ fontSize: 11, color: T.accent, fontFamily: T.fontUI, fontWeight: 600 }}>🔓 mode admin</span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {customStickers.map((d) => (
                    <div key={d.id} style={{ position: 'relative' }}>
                      <button type="button" onClick={() => onAddSticker(d.id)} style={pickerCardStyle(T)}>
                        <div style={{
                          aspectRatio: '2/1', background: 'rgba(255,255,255,0.96)',
                          borderRadius: T.rSm, padding: 8,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                        }}>
                          <img src={d.imageUrl} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 500, textAlign: 'left' }}>{d.label}</div>
                      </button>
                      {adminUnlocked && (
                        <div style={{ position: 'absolute', top: -8, right: -8, display: 'flex', gap: 4 }}>
                          <button type="button" onClick={(e) => { e.stopPropagation(); onBeginStickerEdit?.(d); }}
                            title="Modifier (position, verrou)"
                            style={{
                              width: 28, height: 28, borderRadius: '50%',
                              background: T.accent, color: T.accentText, border: 'none', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 13, fontWeight: 700, boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                            }}>✎</button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); onDeleteCustomSticker?.(d.id); }}
                            title="Supprimer"
                            style={{
                              width: 28, height: 28, borderRadius: '50%',
                              background: T.danger, color: '#fff', border: 'none', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 13, fontWeight: 700, boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                            }}>✕</button>
                        </div>
                      )}
                      {d.lockedPosition && (
                        <div style={{
                          position: 'absolute', bottom: 6, left: 6,
                          fontSize: 12, background: 'rgba(0,0,0,0.6)', color: '#fff',
                          width: 22, height: 22, borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          pointerEvents: 'none',
                        }} title="Position verrouillée">🔒</div>
                      )}
                    </div>
                  ))}
                  {adminUnlocked && (
                    <button type="button" onClick={() => stickerFileRef.current?.click()}
                      style={{
                        ...pickerCardStyle(T),
                        border: `1.5px dashed ${T.borderStrong}`,
                        background: 'transparent',
                        alignItems: 'center', justifyContent: 'center',
                        minHeight: 96,
                      }}>
                      <div style={{ fontSize: 24, opacity: 0.7 }}>＋</div>
                      <div style={{ fontSize: 12, fontWeight: 500, textAlign: 'center' }}>Importer sticker</div>
                    </button>
                  )}
                </div>
                <input ref={stickerFileRef} type="file" accept="image/*" onChange={onStickerFile} style={{ display: 'none' }} />
              </div>
            )}
          </div>
        )}

        {tab === 'text' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <Label style={{ marginBottom: 6 }}>Ton texte</Label>
              <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Bon anniversaire !"
                onKeyDown={(e) => e.key === 'Enter' && submitText()}
                style={inputStyle(T)} />
            </div>
            <div>
              <Label style={{ marginBottom: 6 }}>Police</Label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {TEXT_FONTS.map((f) => (
                  <button key={f.label} type="button" onClick={() => setTextFont(f)}
                    style={{
                      appearance: 'none', textAlign: 'left',
                      padding: '10px 14px', borderRadius: T.rSm,
                      border: `1px solid ${textFont.label === f.label ? T.borderStrong : T.border}`,
                      background: textFont.label === f.label ? T.surfaceStrong : T.surface,
                      color: T.text, cursor: 'pointer',
                      fontFamily: f.value, fontSize: 17, fontWeight: f.weight,
                    }}>{f.label} — {text.trim() || 'Aa Bb Cc'}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <Label style={{ marginBottom: 6 }}>Couleur</Label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {TEXT_COLOR_PRESETS.map((c) => (
                    <button key={c} type="button" onClick={() => setTextColor(c)}
                      style={swatchStyle(c, textColor === c, T)} />
                  ))}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <Label style={{ marginBottom: 6 }}>Fond</Label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {TEXT_BG_PRESETS.map((c) => (
                    <button key={c} type="button" onClick={() => setTextBg(c)}
                      style={swatchStyle(c === 'none' ? 'transparent' : c, textBg === c, T, c === 'none')} />
                  ))}
                </div>
              </div>
            </div>
            {editingTextId ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={cancelEditText}
                  style={{
                    appearance: 'none', border: `1px solid ${T.border}`, background: T.surface,
                    color: T.text, padding: '14px 18px', borderRadius: T.rMd,
                    fontFamily: T.fontUI, fontSize: 15, fontWeight: 600, cursor: 'pointer',
                  }}>Annuler</button>
                <button type="button" onClick={submitText} disabled={!text.trim()}
                  style={{ ...primaryBtnStyle(T, !text.trim()), flex: 1 }}>✓ Enregistrer les modifications</button>
              </div>
            ) : (
              <button type="button" onClick={submitText} disabled={!text.trim()}
                style={primaryBtnStyle(T, !text.trim())}>Ajouter au cadre</button>
            )}

            {/* Bibliothèque de textes enregistrés */}
            {savedTexts.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <Label>Textes enregistrés ({savedTexts.length})</Label>
                  {adminUnlocked && (
                    <button type="button" onClick={onClearAllTexts}
                      style={{
                        appearance: 'none', border: 'none', background: 'transparent',
                        color: T.danger, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        fontFamily: T.fontUI, textDecoration: 'underline', padding: 0,
                      }}>Tout supprimer</button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {savedTexts.slice().reverse().map((s) => {
                    // Supprimable par tous si non-admin ; sinon réservé admin
                    const canDelete = !s.byAdmin || adminUnlocked;
                    const hasBg = s.bg && s.bg !== 'none';
                    return (
                      <div key={s.id} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button type="button" onClick={() => onAddSavedText(s)}
                          style={{
                            flex: 1, appearance: 'none', textAlign: 'left',
                            border: `1px solid ${T.border}`, background: T.surface,
                            borderRadius: T.rSm, padding: '10px 14px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden',
                          }}
                          onMouseEnter={(e) => Object.assign(e.currentTarget.style, { background: T.surfaceStrong, borderColor: T.borderStrong })}
                          onMouseLeave={(e) => Object.assign(e.currentTarget.style, { background: T.surface, borderColor: T.border })}
                        >
                          <span style={{
                            fontFamily: s.font, fontWeight: s.weight,
                            color: hasBg ? '#fff' : s.color,
                            background: hasBg ? s.bg : 'transparent',
                            padding: hasBg ? '2px 10px' : 0,
                            borderRadius: 999,
                            fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            maxWidth: '100%',
                          }}>{s.text}</span>
                          {s.byAdmin && (
                            <span style={{ marginLeft: 'auto', fontSize: 10, color: T.accent, fontWeight: 700, letterSpacing: '0.05em', flexShrink: 0 }}>ADMIN</span>
                          )}
                        </button>
                        {canDelete ? (
                          <>
                            <button type="button" onClick={(e) => { e.stopPropagation(); startEditText(s); }}
                              style={{
                                flexShrink: 0, width: 36, height: 36, borderRadius: '50%',
                                border: `1px solid ${editingTextId === s.id ? T.borderStrong : T.border}`,
                                background: editingTextId === s.id ? T.accent : T.surface,
                                color: editingTextId === s.id ? T.accentText : T.text,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 15, fontWeight: 700,
                              }} title="Modifier">✎</button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); onDeleteSavedText(s.id); }}
                              style={{
                                flexShrink: 0, width: 36, height: 36, borderRadius: '50%',
                                border: `1px solid ${T.border}`, background: T.surface, color: T.danger,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 16, fontWeight: 700,
                              }} title="Supprimer">✕</button>
                          </>
                        ) : (
                          <div style={{
                            flexShrink: 0, width: 36, height: 36, borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 14, color: T.textFaint,
                          }} title="Texte admin — code requis">🔒</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Footer — actions */}
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {hasAnyUserDeco && (
          <button type="button" onClick={onClearAll}
            style={{
              appearance: 'none',
              border: `1px solid ${T.danger}`, background: 'transparent', color: T.danger,
              padding: '12px 16px', borderRadius: T.rMd,
              fontFamily: T.fontUI, fontSize: 14, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}>
            {Icons.trashSmall}<span>Tout effacer les décorations</span>
          </button>
        )}
        <button type="button" onClick={onOpenOfficial}
          style={{
            display: hideOfficial ? 'none' : 'flex',
            appearance: 'none',
            border: `1px solid ${T.border}`, background: T.surface, color: T.text,
            padding: '12px 16px', borderRadius: T.rMd,
            fontFamily: T.fontUI, fontSize: 14, fontWeight: 500,
            cursor: 'pointer', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}>
          <span>🔒</span><span>Décoration officielle (code requis)</span>
        </button>
      </div>
    </div>
  );
}

const pickerCardStyle = (T) => ({
  appearance: 'none', border: `1px solid ${T.border}`,
  background: T.surface, padding: 12, borderRadius: T.rMd, cursor: 'pointer',
  display: 'flex', flexDirection: 'column', gap: 8,
  transition: 'background .15s, border-color .15s',
  fontFamily: T.fontUI, color: T.text,
});

const closeBtnStyle = (T) => ({
  appearance: 'none', border: 'none', background: T.surface,
  color: T.text, width: 40, height: 40, borderRadius: T.rPill,
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
});

const inputStyle = (T) => ({
  appearance: 'none', boxSizing: 'border-box',
  width: '100%', padding: '14px 18px',
  border: `1px solid ${T.border}`, borderRadius: T.rSm,
  background: T.surface, color: T.text,
  fontFamily: T.fontUI, fontSize: 16,
  outline: 'none',
});

const swatchStyle = (color, on, T, isNone = false) => ({
  appearance: 'none', flex: 1, height: 40,
  border: on ? `2.5px solid ${T.accent}` : `1px solid ${T.border}`,
  borderRadius: T.rSm,
  background: isNone
    ? `repeating-linear-gradient(45deg, ${T.surface}, ${T.surface} 6px, ${T.border} 6px, ${T.border} 7px)`
    : color,
  cursor: 'pointer', padding: 0,
  position: 'relative',
});

const primaryBtnStyle = (T, disabled) => ({
  appearance: 'none', border: 'none',
  background: T.accent, color: T.accentText,
  padding: '14px 22px', borderRadius: T.rMd,
  fontFamily: T.fontUI, fontSize: 16, fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.4 : 1,
});

// ─── PIN Modal ─────────────────────────────────────────────────────────────
function PinModal({ open, onClose, onSuccess, title = 'Code requis', subtitle = 'Entre le code admin pour modifier la décoration officielle' }) {
  const T = window.__THEME;
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => { if (open) { setPin(''); setError(false); } }, [open]);

  if (!open) return null;

  const onDigit = (d) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setError(false);
    if (next.length === 4) {
      setTimeout(() => {
        if (next === ADMIN_PIN) { onSuccess(); }
        else { setError(true); setPin(''); }
      }, 100);
    }
  };
  const onBack = () => { setPin(pin.slice(0, -1)); setError(false); };

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: T.bg, padding: 36, borderRadius: T.rLg,
        border: `1px solid ${T.border}`,
        minWidth: 380, maxWidth: 440,
        color: T.text, fontFamily: T.fontUI,
        boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🔒</div>
          <div style={{ fontFamily: T.fontDisplay, fontSize: 24, fontWeight: 600 }}>{title}</div>
          <div style={{ fontSize: 13, color: T.textMuted, marginTop: 6, lineHeight: 1.4 }}>{subtitle}</div>
        </div>
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 14,
          marginBottom: 22,
          animation: error ? 'shake 0.4s' : 'none',
        }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{
              width: 18, height: 18, borderRadius: '50%',
              background: pin.length > i ? T.accent : T.surface,
              border: `1px solid ${error ? T.danger : T.border}`,
              transition: 'background .15s',
            }} />
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} type="button" onClick={() => onDigit(d)} style={pinBtnStyle(T)}>{d}</button>
          ))}
          <button type="button" onClick={onClose} style={{ ...pinBtnStyle(T), background: 'transparent', fontSize: 14, fontWeight: 500 }}>Annuler</button>
          <button type="button" onClick={() => onDigit('0')} style={pinBtnStyle(T)}>0</button>
          <button type="button" onClick={onBack} style={{ ...pinBtnStyle(T), background: 'transparent', fontSize: 22 }}>⌫</button>
        </div>
      </div>
    </div>
  );
}
const pinBtnStyle = (T) => ({
  appearance: 'none', border: `1px solid ${T.border}`,
  background: T.surface, color: T.text,
  height: 64, borderRadius: T.rMd,
  fontFamily: T.fontDisplay, fontSize: 26, fontWeight: 500,
  cursor: 'pointer',
});

// ─── Official decoration editor ────────────────────────────────────────────
function OfficialEditor({ open, current, onClose, onSave, onRemove }) {
  const T = window.__THEME;
  const [draft, setDraft] = useState(null);
  const [tab, setTab] = useState('stickers');

  // Text form
  const [text, setText] = useState('');
  const [textFont, setTextFont] = useState(TEXT_FONTS[1]);
  const [textColor, setTextColor] = useState('#ffd23f');
  const [textBg, setTextBg] = useState('none');
  const fileRef = useRef(null);

  useEffect(() => {
    if (open) {
      setDraft(current ? { ...current } : null);
      if (current?.kind === 'text') {
        setText(current.text || '');
        setTextColor(current.color || '#ffd23f');
        setTextBg(current.bg || 'none');
        const f = TEXT_FONTS.find((f) => f.value === current.font);
        if (f) setTextFont(f);
        setTab('text');
      } else if (current?.kind === 'image') {
        setTab('image');
      } else {
        setTab('stickers');
      }
    }
  }, [open, current]);

  if (!open) return null;

  const pickSticker = (id) => {
    setDraft({ kind: 'sticker', stickerId: id, x: 50, y: 20, scale: 1, rotate: 0, locked: true });
  };
  const buildText = () => {
    if (!text.trim()) return;
    setDraft({
      kind: 'text', text: text.trim(),
      font: textFont.value, weight: textFont.weight,
      color: textColor, bg: textBg,
      x: 50, y: 15, scale: 1, rotate: 0, locked: true,
    });
  };
  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const id = 'official-img-' + Date.now();
      cacheUserImage(id, ev.target.result).then(() => {
        setDraft({
          kind: 'image', id, imageUrl: ev.target.result,
          x: 50, y: 20, scale: 1, rotate: 0, locked: true,
        });
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 45,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 40,
    }}>
      <div style={{
        background: T.bg, padding: 30, borderRadius: T.rLg,
        border: `1px solid ${T.border}`,
        width: 560, maxWidth: '90vw', maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
        color: T.text, fontFamily: T.fontUI,
        boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <Label>Mode admin 🔓</Label>
            <div style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, marginTop: 4 }}>Décoration officielle</div>
          </div>
          <button type="button" onClick={onClose} style={closeBtnStyle(T)}>{Icons.close}</button>
        </div>

        {draft ? (
          <>
            <div style={{
              padding: 16, background: T.surface, borderRadius: T.rMd,
              display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14,
            }}>
              <div style={{ width: 64, height: 64, borderRadius: T.rSm, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {draft.kind === 'sticker' && (() => {
                  const s = findSticker(draft.stickerId);
                  if (!s) return null;
                  return (
                    <img src={s.imageUrl || makeSvgUrl(s.svg)} alt=""
                      style={{ maxWidth: '90%', maxHeight: '90%' }} />
                  );
                })()}
                {draft.kind === 'text' && (
                  <div style={{ fontFamily: draft.font, color: draft.color, fontSize: 14, fontWeight: draft.weight, padding: 4, textAlign: 'center' }}>
                    {draft.text}
                  </div>
                )}
                {draft.kind === 'image' && (
                  <img src={draft.imageUrl} alt="" style={{ maxWidth: '90%', maxHeight: '90%' }} />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Sélection</div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>
                  {draft.kind === 'sticker' && (findSticker(draft.stickerId)?.label || 'Sticker')}
                  {draft.kind === 'text' && `« ${draft.text} »`}
                  {draft.kind === 'image' && 'Image importée'}
                </div>
              </div>
              <button type="button" onClick={() => setDraft(null)}
                style={{ appearance: 'none', border: 'none', background: T.surfaceStrong, color: T.text, padding: '8px 14px', borderRadius: T.rSm, fontSize: 13, cursor: 'pointer' }}>
                Changer
              </button>
            </div>
            <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.5, marginBottom: 16 }}>
              Une fois enregistrée, cette décoration sera visible sur toutes les photos et ne pourra pas être déplacée ou supprimée sans le code admin.
              <br />Tu pourras la positionner à l'écran après avoir enregistré.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {current && (
                <button type="button" onClick={onRemove}
                  style={{ appearance: 'none', border: `1px solid ${T.danger}`, background: 'transparent', color: T.danger, padding: '12px 18px', borderRadius: T.rMd, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  Supprimer l'actuelle
                </button>
              )}
              <button type="button" onClick={() => onSave(draft)}
                style={{ ...primaryBtnStyle(T, false), flex: 1 }}>
                Enregistrer comme officielle
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 4, padding: 4, background: T.surface, borderRadius: T.rMd, marginBottom: 14 }}>
              {['stickers', 'text', 'image'].map((tid) => (
                <button key={tid} type="button" onClick={() => setTab(tid)}
                  style={{
                    flex: 1, appearance: 'none', border: 'none',
                    background: tab === tid ? T.accent : 'transparent',
                    color: tab === tid ? T.accentText : T.text,
                    padding: '10px 12px', borderRadius: T.rSm,
                    fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  }}>{tid === 'stickers' ? 'Stickers' : tid === 'text' ? 'Texte' : 'Image'}</button>
              ))}
            </div>
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              {tab === 'stickers' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[...STICKERS, ...(window.__customStickers || [])].map((d) => (
                    <button key={d.id} type="button" onClick={() => pickSticker(d.id)} style={pickerCardStyle(T)}>
                      <div style={{ aspectRatio: '2/1', background: '#fff', borderRadius: T.rSm, padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        <img src={d.imageUrl || makeSvgUrl(d.svg)} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{d.label}</div>
                    </button>
                  ))}
                  {STICKERS.length === 0 && (window.__customStickers || []).length === 0 && (
                    <div style={{ gridColumn: 'span 2', padding: 30, textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
                      Aucun sticker disponible.<br />Ouvre le picker principal en mode admin et importe-en un.
                    </div>
                  )}
                </div>
              )}
              {tab === 'text' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <input type="text" value={text} onChange={(e) => setText(e.target.value)}
                    placeholder="Joyeux Anniversaire Marie !" style={inputStyle(T)} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {TEXT_FONTS.map((f) => (
                      <button key={f.label} type="button" onClick={() => setTextFont(f)}
                        style={{
                          appearance: 'none', textAlign: 'left',
                          padding: '10px 14px', borderRadius: T.rSm,
                          border: `1px solid ${textFont.label === f.label ? T.borderStrong : T.border}`,
                          background: textFont.label === f.label ? T.surfaceStrong : T.surface,
                          color: T.text, cursor: 'pointer',
                          fontFamily: f.value, fontSize: 16, fontWeight: f.weight,
                        }}>{f.label} — {text.trim() || 'Aa Bb Cc'}</button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 14 }}>
                    <div style={{ flex: 1 }}>
                      <Label style={{ marginBottom: 6 }}>Couleur</Label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {TEXT_COLOR_PRESETS.map((c) => (
                          <button key={c} type="button" onClick={() => setTextColor(c)} style={swatchStyle(c, textColor === c, T)} />
                        ))}
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <Label style={{ marginBottom: 6 }}>Fond</Label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {TEXT_BG_PRESETS.map((c) => (
                          <button key={c} type="button" onClick={() => setTextBg(c)} style={swatchStyle(c === 'none' ? 'transparent' : c, textBg === c, T, c === 'none')} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <button type="button" onClick={buildText} disabled={!text.trim()}
                    style={primaryBtnStyle(T, !text.trim())}>Aperçu</button>
                </div>
              )}
              {tab === 'image' && (
                <div style={{ padding: 30, border: `2px dashed ${T.border}`, borderRadius: T.rMd, textAlign: 'center', background: T.surface }}>
                  <div style={{ fontSize: 18, marginBottom: 8 }}>📁 Importer le logo / image officielle</div>
                  <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
                  <button type="button" onClick={() => fileRef.current?.click()} style={primaryBtnStyle(T, false)}>Choisir un fichier</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Gallery viewer (plein écran, navigable) ───────────────────────────────
function GalleryViewer({ photos, idx, version, onClose, onPrev, onNext, onReprint, onSetVersion, onEdit }) {
  const T = window.__THEME;
  if (idx < 0 || !photos[idx]) return null;
  const photo = photos[idx];
  const currentUrl = version === 'without' && photo.dataUrlRaw ? photo.dataUrlRaw : photo.dataUrl;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') onPrev();
      else if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onPrev, onNext]);

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 60,
      background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '20px 28px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        color: T.text, fontFamily: T.fontUI, gap: 24,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: T.fontMono, fontSize: 12, color: T.textMuted, letterSpacing: '0.12em' }}>
            PHOTO {String(idx + 1).padStart(3, '0')} / {String(photos.length).padStart(3, '0')}
          </div>
          <div style={{ fontFamily: T.fontDisplay, fontSize: 20, fontWeight: 600, marginTop: 2, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span>Capturée à {photo.time}</span>
            {photo.hasDecoration && (
              <span style={{ padding: '3px 10px', fontSize: 12, background: T.accent, color: T.accentText, borderRadius: T.rPill, fontWeight: 600, letterSpacing: '0.05em' }}>
                avec décoration
              </span>
            )}
            {photo.printed && (
              <span style={{ padding: '3px 10px', fontSize: 12, background: '#3a8a4e', color: '#fff', borderRadius: T.rPill, fontWeight: 600, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13 }}>🖨</span>
                <span>imprimée{photo.printedWithDeco === false ? ' (sans déco)' : photo.printedWithDeco === true ? ' (avec déco)' : ''}</span>
              </span>
            )}
          </div>
        </div>

        {/* Tabs version */}
        {photo.dataUrlRaw && (
          <div style={{ display: 'flex', gap: 4, padding: 4, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.rMd }}>
            {[
              { id: 'with', label: 'Avec déco' },
              { id: 'without', label: 'Sans déco' },
            ].map((tab) => (
              <button key={tab.id} type="button" onClick={() => onSetVersion(tab.id)}
                style={{
                  appearance: 'none', border: 'none',
                  background: version === tab.id ? T.accent : 'transparent',
                  color: version === tab.id ? T.accentText : T.text,
                  padding: '8px 14px', borderRadius: T.rSm,
                  fontFamily: T.fontUI, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}>{tab.label}</button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          {onEdit && photo.baseUrl && (
            <button type="button" onClick={() => onEdit(photo)}
              style={{
                appearance: 'none', border: `1px solid ${T.borderStrong}`, background: T.surface,
                color: T.text, padding: '0 18px', height: 52, borderRadius: T.rMd,
                fontFamily: T.fontUI, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
              <span style={{ fontSize: 16 }}>✎</span>
              <span>Modifier</span>
            </button>
          )}
          <button type="button" onClick={() => onReprint(photo.id)}
            style={{
              appearance: 'none', border: `1px solid ${T.borderStrong}`, background: T.surface,
              color: T.text, padding: '0 18px', height: 52, borderRadius: T.rMd,
              fontFamily: T.fontUI, fontSize: 14, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
            <span style={{ fontSize: 18 }}>🖨</span>
            <span>{photo.printed ? 'Réimprimer' : 'Imprimer'}</span>
          </button>
          <button type="button" onClick={onClose}
            style={{
              appearance: 'none', border: `1px solid ${T.border}`, background: T.surface,
              color: T.text, width: 52, height: 52, borderRadius: T.rPill,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}>{Icons.close}</button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 100px', minHeight: 0, position: 'relative' }}>
        <button type="button" onClick={onPrev} disabled={idx === 0} style={navBtnStyle(T, idx === 0, 'left')}>‹</button>
        <img src={currentUrl} alt=""
          style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', borderRadius: T.rMd, boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }} />
        <button type="button" onClick={onNext} disabled={idx >= photos.length - 1} style={navBtnStyle(T, idx >= photos.length - 1, 'right')}>›</button>
      </div>

      <div style={{ padding: '20px 28px 28px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', maxWidth: '90vw', padding: '6px 4px' }}>
          {photos.map((p, i) => {
            const thumbUrl = version === 'without' && p.dataUrlRaw ? p.dataUrlRaw : p.dataUrl;
            return (
              <button key={p.id} type="button" onClick={() => { if (i < idx) for (let k = 0; k < idx - i; k++) onPrev(); else for (let k = 0; k < i - idx; k++) onNext(); }}
                style={{
                  flex: '0 0 auto', appearance: 'none', padding: 0, borderRadius: 4,
                  border: i === idx ? `2px solid ${T.accent}` : `1px solid ${T.border}`,
                  background: 'transparent', cursor: 'pointer', overflow: 'hidden',
                  width: i === idx ? 80 : 64, height: i === idx ? 60 : 48,
                  transition: 'all .15s', position: 'relative',
                }}>
                <img src={thumbUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                {p.printed && (
                  <div style={{
                    position: 'absolute', top: 2, right: 2,
                    width: 16, height: 16, borderRadius: '50%',
                    background: '#3a8a4e', color: '#fff', fontSize: 9,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                  }}>🖨</div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Confirm modal (générique) ─────────────────────────────────────────────
function ConfirmModal({ open, title, subtitle, confirmLabel = 'Oui', cancelLabel = 'Non', onConfirm, onCancel, icon }) {
  const T = window.__THEME;
  if (!open) return null;
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 70,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: T.bg, padding: 32, borderRadius: T.rLg,
        border: `1px solid ${T.border}`,
        minWidth: 380, maxWidth: 440,
        color: T.text, fontFamily: T.fontUI,
        boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
        textAlign: 'center',
      }}>
        {icon && <div style={{ fontSize: 44, marginBottom: 10 }}>{icon}</div>}
        <div style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 14, color: T.textMuted, marginTop: 8, lineHeight: 1.5 }}>{subtitle}</div>}
        <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
          <button type="button" onClick={onCancel}
            style={{
              flex: 1, appearance: 'none', border: `1px solid ${T.border}`, background: T.surface,
              color: T.text, padding: '14px 20px', borderRadius: T.rMd,
              fontFamily: T.fontUI, fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}>{cancelLabel}</button>
          <button type="button" onClick={onConfirm}
            style={{
              flex: 1, appearance: 'none', border: 'none', background: T.accent,
              color: T.accentText, padding: '14px 20px', borderRadius: T.rMd,
              fontFamily: T.fontUI, fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
const navBtnStyle = (T, disabled, side) => ({
  position: 'absolute',
  [side]: 24,
  top: '50%', transform: 'translateY(-50%)',
  appearance: 'none', border: `1px solid ${T.border}`,
  background: T.glass, backdropFilter: T.glassBlur, WebkitBackdropFilter: T.glassBlur,
  color: T.text, width: 64, height: 80, borderRadius: T.rMd,
  fontSize: 40, fontWeight: 300, lineHeight: 1, cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.3 : 1,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
});

Object.assign(window, {
  DraggableDecoration, DecorationPicker, PinModal, OfficialEditor, GalleryViewer, ConfirmModal,
});

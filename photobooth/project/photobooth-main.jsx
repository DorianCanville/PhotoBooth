// photobooth-main.jsx — Composant racine + ReviewModal + Tweaks
// Charge en dernier

function App() {
  const [t, setTweak] = useTweaks(window.TWEAK_DEFAULTS);

  // Thème actif → window globals lus par sous-composants
  const theme = THEMES[t.theme] || THEMES.studio;
  // override accent
  if (t.accentOverride && t.accentOverride !== '') {
    theme.accent = t.accentOverride;
    theme.shutterCore = t.accentOverride;
  }
  window.__THEME = theme;
  window.__BTN_SIZE = t.buttonSize || 1;

  // ─── État ───────────────────────────────────────────────────────────────
  const [mode, setMode] = useState('single');
  const [lens, setLens] = useState('normal');
  const [timer, setTimer] = useState(5);
  const [filter, setFilter] = useState('none');

  const [decorations, setDecorations] = useState([]);
  const [officialDeco, setOfficialDeco] = useState(null);
  const [selectedDeco, setSelectedDeco] = useState(null);
  const [decoPickerOpen, setDecoPickerOpen] = useState(false);

  // Admin
  const [pinOpen, setPinOpen] = useState(false);
  const [pinPurpose, setPinPurpose] = useState('unlock'); // 'unlock' | 'official'
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [officialEditorOpen, setOfficialEditorOpen] = useState(false);

  // Bibliothèque de textes enregistrés
  const [savedTexts, setSavedTexts] = useState([]); // [{ id, text, font, weight, color, bg, byAdmin }]

  // Barre de contrôles repliée
  const [controlsCollapsed, setControlsCollapsed] = useState(false);

  // Persistance — chargé depuis IndexedDB au démarrage
  const [hydrated, setHydrated] = useState(false);

  // Galerie
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [viewerIdx, setViewerIdx] = useState(-1);
  const [photos, setPhotos] = useState([]);
  const [galleryTab, setGalleryTab] = useState('with'); // 'with' | 'without'

  // Bibliothèque d'imports (réutilisables)
  const [importedImages, setImportedImages] = useState([]); // [{ id, dataUrl, addedAt }]

  // Stickers custom (importés par admin)
  const [customStickers, setCustomStickers] = useState([]); // [{ id, label, dataUrl, aspect, imageUrl }]
  useEffect(() => {
    // On expose une COPIE pour que d'éventuelles mutations externes ne polluent pas le state React.
    window.__customStickers = customStickers.slice();
  }, [customStickers]);

  // Affichage de la déco officielle (toggleable même hors admin)
  const [showOfficial, setShowOfficial] = useState(true);

  // Draft sticker en cours de placement (mode admin)
  const [draftSticker, setDraftSticker] = useState(null);
  // { id, label, imageUrl, aspect, x, y, scale, rotate, lockedPosition }

  // Confirmations / toast
  const [reprintConfirm, setReprintConfirm] = useState(null); // { photoId } | null
  const [toast, setToast] = useState(null);
  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  // Capture flow
  const [captureStage, setCaptureStage] = useState('idle');
  const [countdownN, setCountdownN] = useState(0);
  const [flashOn, setFlashOn] = useState(false);
  const [reviewSet, setReviewSet] = useState([]);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [reviewActions, setReviewActions] = useState([]); // [{ type, photoId? }]
  const [reviewFilter, setReviewFilter] = useState('none');
  const [burstIdx, setBurstIdx] = useState(0);

  // Éditeur photo (post-capture, depuis la galerie)
  const [editingPhoto, setEditingPhoto] = useState(null);

  const { videoRef, ready: camReady, error: camError } = useCamera(true);
  const stageRef = useRef(null);

  const filterCss = FILTERS.find((f) => f.value === filter)?.css || 'none';

  // ─── Préchargement stickers ─────────────────────────────────────────────
  useEffect(() => {preloadStickers();}, []);

  // ─── Hydratation depuis IndexedDB (au démarrage) ────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [p, cs, st, od, settings] = await Promise.all([
        idbGet('photos'), idbGet('customStickers'), idbGet('savedTexts'),
        idbGet('officialDeco'), idbGet('settings')]
        );
        if (!alive) return;
        if (Array.isArray(p)) setPhotos(p);
        if (Array.isArray(cs)) {
          setCustomStickers(cs);
          // Reconstruit le cache d'images des stickers
          cs.forEach((s) => {
            if (s.imageUrl && !window.__stickerCache[s.id]) {
              const img = new Image();
              img.onload = () => {window.__stickerCache[s.id] = img;};
              img.src = s.imageUrl;
            }
          });
        }
        if (Array.isArray(st)) setSavedTexts(st);
        if (od) {
          setOfficialDeco(od);
          if (od.kind === 'image' && od.imageUrl) cacheUserImage(od.id, od.imageUrl);
        }
        if (settings) {
          if (settings.mode) setMode(settings.mode);
          if (settings.lens) setLens(settings.lens);
          if (settings.timer) setTimer(settings.timer);
          if (typeof settings.showOfficial === 'boolean') setShowOfficial(settings.showOfficial);
        }
      } catch (e) {
        console.warn('Hydratation échouée', e);
      }
      if (alive) setHydrated(true);
    })();
    return () => {alive = false;};
  }, []);

  // ─── Persistance (après hydratation) ────────────────────────────────────
  useEffect(() => {if (hydrated) idbSet('photos', photos);}, [photos, hydrated]);
  useEffect(() => {if (hydrated) idbSet('customStickers', customStickers);}, [customStickers, hydrated]);
  useEffect(() => {if (hydrated) idbSet('savedTexts', savedTexts);}, [savedTexts, hydrated]);
  useEffect(() => {if (hydrated) idbSet('officialDeco', officialDeco);}, [officialDeco, hydrated]);
  useEffect(() => {
    if (hydrated) idbSet('settings', { mode, lens, timer, showOfficial });
  }, [mode, lens, timer, showOfficial, hydrated]);

  // Réinitialisation complète (vide IndexedDB + état)
  const resetAll = useCallback(async () => {
    if (!window.confirm('Vider toute la galerie, les stickers, les textes et la décoration officielle ? Action irréversible.')) return;
    await Promise.all([
    idbDel('photos'), idbDel('customStickers'), idbDel('savedTexts'),
    idbDel('officialDeco'), idbDel('settings')]
    );
    setPhotos([]);
    setCustomStickers([]);
    setSavedTexts([]);
    setOfficialDeco(null);
    setDecorations([]);
    setSelectedDeco(null);
    setViewerIdx(-1);
    setGalleryOpen(false);
    window.__stickerCache = {};
    showToast('Données réinitialisées');
  }, [showToast]);

  // ─── Capture base (caméra pure, sans filtre ni déco) → canvas ───────────
  const captureBaseCanvas = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const c = document.createElement('canvas');
    const W = PHOTO_W;
    const H = PHOTO_H; // 4:3
    c.width = W;c.height = H;
    const ctx = c.getContext('2d');

    // Source rect
    const vw = video.videoWidth,vh = video.videoHeight;
    const targetAspect = W / H;
    const vidAspect = vw / vh;
    let sx, sy, sw, sh;
    if (vidAspect > targetAspect) {
      sh = vh;sw = vh * targetAspect;
      sx = (vw - sw) / 2;sy = 0;
    } else {
      sw = vw;sh = vw / targetAspect;
      sx = 0;sy = (vh - sh) / 2;
    }
    if (lens === 'normal') {
      const zoom = 1.35;
      const cw = sw / zoom,ch = sh / zoom;
      sx = sx + (sw - cw) / 2;sy = sy + (sh - ch) / 2;
      sw = cw;sh = ch;
    }

    // Mirror (selfie), AUCUN filtre, AUCUNE déco
    ctx.save();
    ctx.translate(W, 0);ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, W, H);
    ctx.restore();

    return c;
  }, [lens, videoRef]);

  // Snapshot des décos actives (officielle + utilisateur)
  const currentDecoSnapshot = useCallback(() => [
  ...(officialDeco && showOfficial ? [{ ...officialDeco }] : []),
  ...decorations.map((d) => ({ ...d }))],
  [officialDeco, showOfficial, decorations]);

  const doFlash = useCallback(() => {
    setFlashOn(true);
    shutterClick();
    setTimeout(() => setFlashOn(false), 200);
  }, []);

  const hasAnyDecoration = officialDeco !== null && showOfficial || decorations.length > 0;

  // ─── Capture flow ───────────────────────────────────────────────────────
  const runCapture = useCallback(async () => {
    if (captureStage !== 'idle') return;
    setSelectedDeco(null);
    setDecoPickerOpen(false);

    setCaptureStage('countdown');
    for (let i = timer; i > 0; i--) {
      setCountdownN(i);
      beep(i === 1 ? 1320 : 880, 0.08, 0.12);
      await new Promise((r) => setTimeout(r, 1000));
    }
    setCountdownN(0);
    setCaptureStage('capturing');

    const captures = [];
    const filterCssNow = FILTERS.find((f) => f.value === filter)?.css || 'none';

    const buildCapture = () => {
      const baseCanvas = captureBaseCanvas();
      const decoSnap = currentDecoSnapshot();
      const baseUrl = baseCanvas.toDataURL('image/jpeg', 0.95);
      window.__baseImgCache[baseUrl] = baseCanvas; // dispo immédiatement pour re-render
      return {
        baseCanvas, baseUrl, decoSnapshot: decoSnap, filter,
        dataUrl: composePhoto(baseCanvas, filterCssNow, decoSnap, true),
        dataUrlRaw: composePhoto(baseCanvas, filterCssNow, decoSnap, false),
        hasDecoration: hasAnyDecoration
      };
    };

    if (mode === 'single') {
      doFlash();
      await new Promise((r) => setTimeout(r, 100));
      captures.push(buildCapture());
    } else if (mode === 'burst') {
      for (let i = 0; i < BURST_COUNT; i++) {
        setBurstIdx(i + 1);
        if (i > 0) {
          // 2 secondes de countdown entre chaque (1 seconde de plus qu'avant)
          for (let n = BURST_COUNTDOWN_SECONDS; n > 0; n--) {
            setCountdownN(n);
            beep(880, 0.06);
            await new Promise((r) => setTimeout(r, 900));
          }
          setCountdownN(0);
        }
        doFlash();
        await new Promise((r) => setTimeout(r, 120));
        captures.push(buildCapture());
        await new Promise((r) => setTimeout(r, 300));
      }
      setBurstIdx(0);
    }

    setReviewFilter(filter);
    setReviewSet(captures);
    setReviewIdx(0);
    setReviewActions([]);
    setCaptureStage('review');
  }, [captureStage, timer, mode, filter, hasAnyDecoration, captureBaseCanvas, currentDecoSnapshot, doFlash]);

  // ─── Review actions ─────────────────────────────────────────────────────
  const advanceOrFinish = (newActions) => {
    if (reviewIdx + 1 >= reviewSet.length) {
      // Fin de revue
      setCaptureStage('idle');
      setReviewSet([]);
      setReviewIdx(0);
      setReviewActions([]);
    } else {
      setReviewIdx(reviewIdx + 1);
    }
  };

  const keepCurrent = useCallback((printMode = 'no') => {
    // printMode : 'no' | 'with-deco' | 'without-deco'
    const c = reviewSet[reviewIdx];
    if (!c) return;
    const id = 'p' + Date.now() + '-' + reviewIdx;
    const filterCss = FILTERS.find((f) => f.value === reviewFilter)?.css || 'none';
    // Re-bake avec le filtre choisi à la validation
    const dataUrl = composePhoto(c.baseCanvas, filterCss, c.decoSnapshot, true);
    const dataUrlRaw = composePhoto(c.baseCanvas, filterCss, c.decoSnapshot, false);
    setPhotos((prev) => [...prev, {
      id,
      baseUrl: c.baseUrl,
      decoSnapshot: c.decoSnapshot,
      filter: reviewFilter,
      dataUrl, dataUrlRaw,
      hasDecoration: c.hasDecoration,
      printed: printMode !== 'no',
      printedWithDeco: printMode === 'with-deco',
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    }]);
    setReviewActions((prev) => [...prev, { type: 'keep', photoId: id, printed: printMode !== 'no' }]);
    if (printMode !== 'no') showToast('Envoyée à l\'imprimante');
    advanceOrFinish();
  }, [reviewSet, reviewIdx, reviewFilter, showToast]);

  const skipCurrent = useCallback(() => {
    setReviewActions((prev) => [...prev, { type: 'skip' }]);
    advanceOrFinish();
  }, [reviewSet, reviewIdx]);

  // « ← Précédent » — annule la dernière décision
  const goBackReview = useCallback(() => {
    if (reviewActions.length === 0) return;
    const last = reviewActions[reviewActions.length - 1];
    if (last.type === 'keep') {
      setPhotos((prev) => prev.filter((p) => p.id !== last.photoId));
    }
    setReviewActions((prev) => prev.slice(0, -1));
    setReviewIdx(Math.max(0, reviewIdx - 1));
  }, [reviewActions, reviewIdx]);

  const retakeAll = useCallback(() => {
    // Retire toutes les photos validées de cette session de capture
    const keptIds = reviewActions.filter((a) => a.type === 'keep').map((a) => a.photoId);
    setPhotos((prev) => prev.filter((p) => !keptIds.includes(p.id)));
    setCaptureStage('idle');
    setReviewSet([]);
    setReviewIdx(0);
    setReviewActions([]);
  }, [reviewActions]);

  // ─── Décorations ────────────────────────────────────────────────────────
  const addDecoSticker = useCallback((stickerId) => {
    const tpl = findSticker(stickerId);
    if (!tpl) return;
    const id = 'd' + Date.now();
    setDecorations((prev) => [...prev, {
      id, kind: 'sticker', stickerId,
      x: tpl.defaultX ?? 50,
      y: tpl.defaultY ?? 50,
      scale: tpl.defaultScale ?? 1,
      rotate: tpl.defaultRotate ?? 0,
      locked: !!tpl.lockedPosition
    }]);
    // Si position verrouillée par l'admin, pas de sélection (l'utilisateur ne peut pas la déplacer de toute façon)
    setSelectedDeco(tpl.lockedPosition ? null : id);
    setDecoPickerOpen(false);
  }, []);
  const addDecoText = useCallback((cfg) => {
    const id = 'd' + Date.now();
    setDecorations((prev) => [...prev, { id, kind: 'text', ...cfg, x: 50, y: 50, scale: 1, rotate: 0 }]);
    // Enregistre dans la bibliothèque (dédoublonnage sur texte+style)
    setSavedTexts((prev) => {
      const exists = prev.some((s) => s.text === cfg.text && s.font === cfg.font && s.color === cfg.color && s.bg === cfg.bg);
      if (exists) return prev;
      return [...prev, { id: 'txt' + Date.now(), ...cfg, byAdmin: adminUnlocked }];
    });
    setSelectedDeco(id);
    setDecoPickerOpen(false);
  }, [adminUnlocked]);

  // Ré-ajoute un texte enregistré au cadre (sans re-sauvegarder)
  const addSavedTextToFrame = useCallback((textObj) => {
    const id = 'd' + Date.now();
    const { id: _omit, byAdmin: _omit2, ...cfg } = textObj;
    setDecorations((prev) => [...prev, { id, kind: 'text', ...cfg, x: 50, y: 50, scale: 1, rotate: 0 }]);
    setSelectedDeco(id);
    setDecoPickerOpen(false);
  }, []);

  const deleteSavedText = useCallback((id) => {
    setSavedTexts((prev) => prev.filter((s) => {
      if (s.id !== id) return true;
      // Supprimable si non-admin OU si admin déverrouillé
      return s.byAdmin && !adminUnlocked;
    }));
  }, [adminUnlocked]);

  const clearAllSavedTexts = useCallback(() => {
    setSavedTexts([]);
  }, []);

  // Met à jour un texte enregistré (édition admin)
  const updateSavedText = useCallback((id, cfg) => {
    setSavedTexts((prev) => prev.map((s) => s.id === id ? { ...s, ...cfg } : s));
  }, []);
  const addDecoImage = useCallback((dataUrl, existingId = null) => {
    const id = existingId || 'img' + Date.now();
    cacheUserImage(id, dataUrl).then(() => {
      // Ajout au cadre
      setDecorations((prev) => [...prev, { id: 'd' + Date.now(), kind: 'image', imageUrl: dataUrl, sourceId: id, x: 50, y: 50, scale: 1, rotate: 0 }]);
      setSelectedDeco(null);
      setDecoPickerOpen(false);
    });
    // Ajoute à la bibliothèque (si pas déjà dedans)
    if (!existingId) {
      setImportedImages((prev) => prev.some((p) => p.dataUrl === dataUrl) ? prev : [...prev, { id, dataUrl, addedAt: Date.now() }]);
    }
  }, []);

  const deleteImportedImage = useCallback((id) => {
    setImportedImages((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // ─── Stickers custom (admin) ────────────────────────────────────────────
  // Démarre le flow d'import : crée un draft posable sur le canvas
  const beginStickerImport = useCallback((label, dataUrl) => {
    const img = new Image();
    img.onload = () => {
      const id = 'cs-' + Date.now();
      window.__stickerCache[id] = img;
      const aspect = img.naturalWidth / img.naturalHeight;
      // Enregistre temporairement le template dans window.__customStickers pour que
      // findSticker le trouve. Le useEffect ne se déclenchera qu'au prochain setCustomStickers
      // (validation), donc cette mutation transitoire reste valide jusqu'à validate/cancel.
      const stickerTemplate = { id, label, imageUrl: dataUrl, aspect, custom: true };
      window.__customStickers = [...window.__customStickers, stickerTemplate];
      setDraftSticker({
        id, label, imageUrl: dataUrl, aspect,
        x: 50, y: 50, scale: 1, rotate: 0,
        lockedPosition: false
      });
      setDecoPickerOpen(false);
      setSelectedDeco(null);
    };
    img.src = dataUrl;
  }, []);

  const updateDraftSticker = useCallback((id, patch) => {
    setDraftSticker((prev) => prev ? { ...prev, ...patch } : null);
  }, []);

  // Édite un sticker existant : recharge ses valeurs dans le draft
  const beginStickerEdit = useCallback((sticker) => {
    setDraftSticker({
      id: sticker.id,
      label: sticker.label,
      imageUrl: sticker.imageUrl,
      aspect: sticker.aspect,
      x: sticker.defaultX ?? 50,
      y: sticker.defaultY ?? 50,
      scale: sticker.defaultScale ?? 1,
      rotate: sticker.defaultRotate ?? 0,
      lockedPosition: !!sticker.lockedPosition,
      editId: sticker.id // marque le mode édition
    });
    setDecoPickerOpen(false);
    setSelectedDeco(null);
  }, []);

  const validateDraftSticker = useCallback(() => {
    setDraftSticker((draft) => {
      if (!draft) return null;
      const sticker = {
        id: draft.id,
        label: draft.label,
        imageUrl: draft.imageUrl,
        aspect: draft.aspect,
        defaultX: draft.x,
        defaultY: draft.y,
        defaultScale: draft.scale,
        defaultRotate: draft.rotate,
        lockedPosition: draft.lockedPosition,
        custom: true
      };
      if (draft.editId) {
        // Remplace le sticker existant
        setCustomStickers((prev) => prev.map((s) => s.id === draft.editId ? sticker : s));
      } else {
        setCustomStickers((prev) => [...prev, sticker]);
      }
      return null;
    });
  }, []);

  const cancelDraftSticker = useCallback(() => {
    setDraftSticker((draft) => {
      if (draft && !draft.editId) {
        // Seulement pour un nouvel import : nettoie le template transitoire
        delete window.__stickerCache?.[draft.id];
        window.__customStickers = window.__customStickers.filter((s) => s.id !== draft.id);
      }
      return null;
    });
  }, []);

  const setDraftLocked = useCallback((locked) => {
    setDraftSticker((prev) => prev ? { ...prev, lockedPosition: locked } : null);
  }, []);

  const deleteCustomSticker = useCallback((id) => {
    setCustomStickers((prev) => prev.filter((s) => s.id !== id));
    delete window.__stickerCache?.[id];
  }, []);

  const updateDeco = useCallback((id, patch) => {
    if (officialDeco && id === officialDeco.id) {
      if (!adminUnlocked) return;
      setOfficialDeco((d) => ({ ...d, ...patch }));
      return;
    }
    setDecorations((prev) => prev.map((d) => d.id === id ? { ...d, ...patch } : d));
  }, [officialDeco, adminUnlocked]);

  const deleteDeco = useCallback((id) => {
    if (officialDeco && id === officialDeco.id) return; // refuse
    setDecorations((prev) => prev.filter((d) => d.id !== id));
    setSelectedDeco(null);
  }, [officialDeco]);

  const clearUserDecorations = useCallback(() => {
    setDecorations([]);setSelectedDeco(null);
  }, []);

  // ─── Official deco ──────────────────────────────────────────────────────
  const onOpenOfficial = () => {
    if (adminUnlocked) setOfficialEditorOpen(true);else
    {setPinPurpose('official');setPinOpen(true);}
  };
  // Bouton admin de la top bar
  const requestAdminUnlock = () => {
    setPinPurpose('unlock');
    setPinOpen(true);
  };
  const onPinSuccess = () => {
    setAdminUnlocked(true);
    setPinOpen(false);
    if (pinPurpose === 'official') setOfficialEditorOpen(true);
  };
  const saveOfficial = (cfg) => {
    if (cfg.kind === 'image') {







      // déjà mis en cache via cacheUserImage dans OfficialEditor
    }setOfficialDeco({ ...cfg, id: cfg.id || 'official' });setOfficialEditorOpen(false); // Garde adminUnlocked pour permettre repositionnement
  };const removeOfficial = () => {setOfficialDeco(null);setOfficialEditorOpen(false);};
  const lockAdmin = () => setAdminUnlocked(false);

  // Tap ailleurs → désélectionne
  const onStageTap = (e) => {
    if (e.target === e.currentTarget) setSelectedDeco(null);
  };

  // ─── Gallery viewer nav ─────────────────────────────────────────────────
  const openViewer = (idx) => setViewerIdx(idx);
  const closeViewer = () => setViewerIdx(-1);
  const prevViewer = () => setViewerIdx((i) => Math.max(0, i - 1));
  const nextViewer = () => setViewerIdx((i) => Math.min(photos.length - 1, i + 1));

  // ─── Éditeur photo (depuis galerie) ─────────────────────────────────────
  const openEditor = useCallback((photo) => {
    setEditingPhoto(photo);
  }, []);

  // Enregistre une COPIE éditée dans la galerie
  const saveEditedCopy = useCallback(({ baseUrl, filter, decorations: editDecos, dataUrl, dataUrlRaw }) => {
    const id = 'p' + Date.now() + '-edit';
    const hasDecoration = editDecos && editDecos.length > 0;
    setPhotos((prev) => [...prev, {
      id,
      baseUrl,
      decoSnapshot: editDecos,
      filter,
      dataUrl, dataUrlRaw,
      hasDecoration,
      printed: false,
      printedWithDeco: undefined,
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      edited: true
    }]);
    setEditingPhoto(null);
    // Affiche la nouvelle copie (dernière) dans le viewer
    setViewerIdx(photos.length); // length avant ajout = index de la nouvelle
    showToast('Copie modifiée créée');
  }, [photos.length, showToast]);

  // ─── Render ─────────────────────────────────────────────────────────────
  const bSize = t.buttonSize || 1;
  const decosToRender = [...(officialDeco && showOfficial ? [officialDeco] : []), ...decorations];

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: theme.bg, color: theme.text, fontFamily: theme.fontUI, overflow: 'hidden'
    }}>
      {/* Stage caméra */}
      <div ref={stageRef} onPointerDown={onStageTap}
      style={{ position: 'absolute', inset: 0, background: theme.bgGrad }}>

        {/* Video wrapper (clipping isolé pour que les poignées de déco débordent librement) */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          {!camError &&
          <video ref={videoRef} autoPlay playsInline muted
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%', objectFit: 'cover',
            transform: 'scaleX(-1)' + (lens === 'normal' ? ' scale(1.35)' : ''),
            transformOrigin: 'center',
            filter: filterCss,
            opacity: camReady ? 1 : 0,
            transition: 'opacity .4s, transform .4s'
          }} />

          }
        </div>

        {(camError || !camReady) &&
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: theme.textMuted, fontFamily: theme.fontMono, fontSize: 14,
          letterSpacing: '0.1em', textTransform: 'uppercase'
        }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.5 }}>◉ ◉</div>
              <div>{camError ? `Caméra indisponible — ${camError}` : 'Initialisation caméra…'}</div>
              {camError && <div style={{ marginTop: 8, fontSize: 11, opacity: 0.6 }}>Autorise la webcam pour démarrer</div>}
            </div>
          </div>
        }

        {/* Décorations layer (transparent aux pointeurs hors décos) */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {decosToRender.map((d) => {
            const isOfficial = officialDeco && d.id === officialDeco.id;
            const canMove = isOfficial ?
            adminUnlocked :
            !d.locked;
            const canDelete = isOfficial ?
            adminUnlocked :
            true;
            return (
              <DraggableDecoration key={d.id} deco={d}
              selected={selectedDeco === d.id && captureStage === 'idle'}
              canMove={canMove}
              canDelete={canDelete}
              showLockBadge={d.locked || isOfficial && !adminUnlocked}
              onSelect={setSelectedDeco}
              onChange={updateDeco}
              onDelete={deleteDeco}
              containerRef={stageRef} />);

          })}
          {draftSticker &&
          <DraggableDecoration
            deco={{ ...draftSticker, kind: 'sticker', stickerId: draftSticker.id }}
            selected={true}
            canMove={true}
            canDelete={false}
            onSelect={() => {}}
            onChange={(_, patch) => updateDraftSticker(draftSticker.id, patch)}
            onDelete={() => {}}
            containerRef={stageRef} />
          }
        </div>

        {/* Flash */}
        <div style={{
          position: 'absolute', inset: 0, background: '#fff',
          opacity: flashOn ? 1 : 0,
          transition: flashOn ? 'opacity 0ms' : 'opacity 200ms',
          pointerEvents: 'none', zIndex: 30
        }} />

        {/* Countdown */}
        {captureStage === 'countdown' && countdownN > 0 &&
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', zIndex: 25, background: 'rgba(0,0,0,0.35)'
        }}>
            <div key={`big-${captureStage}-${countdownN}-${Date.now()}`} style={{
            fontFamily: theme.fontDisplay, fontSize: 320, fontWeight: 700,
            color: theme.accent,
            textShadow: '0 12px 40px rgba(0,0,0,0.5)',
            animation: 'countPulse 1s cubic-bezier(.3,.7,.4,1)',
            lineHeight: 1
          }}>{countdownN}</div>
          </div>
        }

        {/* Mini countdown pendant rafale (entre les tirs) */}
        {captureStage === 'capturing' && mode === 'burst' && countdownN > 0 &&
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', zIndex: 25, background: 'rgba(0,0,0,0.25)'
        }}>
            <div key={`burst-cd-${countdownN}-${burstIdx}`} style={{
            fontFamily: theme.fontDisplay, fontSize: 240, fontWeight: 700,
            color: theme.accent, textShadow: '0 12px 40px rgba(0,0,0,0.5)',
            animation: 'countPulse 0.9s cubic-bezier(.3,.7,.4,1)', lineHeight: 1
          }}>{countdownN}</div>
          </div>
        }

        {/* Burst indicator */}
        {captureStage === 'capturing' && mode === 'burst' && burstIdx > 0 &&
        <div style={{
          position: 'absolute', top: 30, left: '50%', transform: 'translateX(-50%)',
          padding: '12px 28px',
          background: theme.glass,
          backdropFilter: theme.glassBlur, WebkitBackdropFilter: theme.glassBlur,
          border: `1px solid ${theme.border}`, borderRadius: theme.rPill,
          fontFamily: theme.fontDisplay, fontSize: 20, fontWeight: 600,
          color: theme.text, zIndex: 22
        }}>
            Rafale · {burstIdx} / {BURST_COUNT}
          </div>
        }
      </div>

      {/* Top bar */}
      {captureStage === 'idle' &&
      <div style={{
        position: 'absolute', top: 24, left: 30, right: 30,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        zIndex: 15, pointerEvents: 'none'
      }}>
          <div style={{ pointerEvents: 'auto', display: 'flex', gap: 14, alignItems: 'center' }}>
            <button type="button" onClick={() => setDecoPickerOpen((v) => !v)}
          style={{
            appearance: 'none', border: `1px solid ${decoPickerOpen ? theme.borderStrong : theme.border}`,
            background: decoPickerOpen ? theme.accent : theme.glass,
            color: decoPickerOpen ? theme.accentText : theme.text,
            backdropFilter: theme.glassBlur, WebkitBackdropFilter: theme.glassBlur,
            padding: '14px 22px', borderRadius: theme.rPill,
            fontFamily: theme.fontUI, fontSize: 15, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10
          }}>
              {Icons.sparkle}
              <span>
                {decorations.length > 0 ?
              `Décorations (${decorations.length})` :
              'Décoration'}
                {officialDeco ? ' · 🔒' : ''}
              </span>
            </button>
            <div style={{
            padding: '10px 18px',
            background: theme.glass, backdropFilter: theme.glassBlur, WebkitBackdropFilter: theme.glassBlur,
            border: `1px solid ${theme.border}`, borderRadius: theme.rPill,
            fontFamily: theme.fontMono, fontSize: 13, color: theme.text, letterSpacing: '0.1em'
          }}>
              {photos.filter((p) => p.printed).length.toString().padStart(3, '0')} IMPRIMÉES
            </div>
            {decorations.length > 0 &&
          <button type="button" onClick={clearUserDecorations}
          style={{
            ...pillBtnStyle(theme),
            border: `1px solid ${theme.danger}`,
            color: theme.danger,
            fontWeight: 600
          }}>
                {Icons.trashSmall}<span>Tout effacer ({decorations.length})</span>
              </button>
          }
            {officialDeco &&
          <button type="button" onClick={() => setShowOfficial((v) => !v)}
          style={{
            ...pillBtnStyle(theme),
            background: showOfficial ? theme.surfaceStrong : theme.surface,
            border: `1px solid ${showOfficial ? theme.borderStrong : theme.border}`,
            fontWeight: 600,
            opacity: showOfficial ? 1 : 0.7
          }}>
                <span style={{ fontSize: 13 }}>{showOfficial ? '🔒' : '🚫'}</span>
                <span>Officielle {showOfficial ? 'ON' : 'OFF'}</span>
              </button>
          }
            {adminUnlocked ?
          <button type="button" onClick={lockAdmin}
          style={{ ...pillBtnStyle(theme), background: theme.accent, color: theme.accentText, borderColor: theme.accent }}>
                <span>🔓 Quitter admin</span>
              </button> :

          <button type="button" onClick={requestAdminUnlock}
          style={pillBtnStyle(theme)}>
                <span style={{ fontSize: 13 }}>🔒</span><span>Admin</span>
              </button>
          }
          </div>

          <div style={{ pointerEvents: 'auto' }}>
            <button type="button" onClick={() => setGalleryOpen(true)}
          style={{
            appearance: 'none', border: `1px solid ${theme.border}`,
            background: theme.glass, backdropFilter: theme.glassBlur, WebkitBackdropFilter: theme.glassBlur,
            color: theme.text, padding: '14px 22px',
            borderRadius: theme.rPill, fontFamily: theme.fontUI, fontSize: 15,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10
          }}>
              {Icons.gallery}<span>Galerie ({photos.length})</span>
            </button>
          </div>
        </div>
      }

      <DecorationPicker
        open={decoPickerOpen}
        onClose={() => setDecoPickerOpen(false)}
        onAddSticker={addDecoSticker}
        onAddText={addDecoText}
        onOpenOfficial={onOpenOfficial}
        adminUnlocked={adminUnlocked}
        onClearAll={clearUserDecorations}
        hasAnyUserDeco={decorations.length > 0}
        customStickers={customStickers}
        onBeginStickerImport={beginStickerImport}
        onBeginStickerEdit={beginStickerEdit}
        onDeleteCustomSticker={deleteCustomSticker}
        savedTexts={savedTexts}
        onAddSavedText={addSavedTextToFrame}
        onDeleteSavedText={deleteSavedText}
        onUpdateSavedText={updateSavedText}
        onClearAllTexts={clearAllSavedTexts} />

      {/* Bottom control deck (centré, glass card) */}
      {captureStage === 'idle' && !draftSticker && !controlsCollapsed &&
      <div style={{
        position: 'absolute', bottom: 24,
        left: '50%', transform: 'translateX(-50%)',
        padding: 10,
        display: 'flex', alignItems: 'stretch', gap: 14,
        zIndex: 15,
        background: theme.glass,
        backdropFilter: theme.glassBlur,
        WebkitBackdropFilter: theme.glassBlur,
        border: `1px solid ${theme.border}`,
        borderRadius: theme.rLg,
        boxShadow: theme.shadow,
        maxWidth: 'calc(100% - 60px)'
      }}>
          {/* Mode + Objectif — empilés à gauche */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'stretch', minWidth: 280, justifyContent: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Label>Mode</Label>
              <ChipGroup value={mode} onChange={setMode} options={[
                { value: 'single', label: 'Photo', icon: Icons.camera },
                { value: 'burst', label: 'Rafale ×4', icon: Icons.burst }]
              } />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Label>Objectif</Label>
              <ChipGroup value={lens} onChange={setLens} options={[
                { value: 'normal', label: 'Classique', icon: Icons.lensNormal },
                { value: 'wide', label: 'Grand angle', icon: Icons.lensWide }]
              } />
            </div>
          </div>

          <div style={{ width: 1, alignSelf: 'stretch', background: theme.border }} />

          {/* Délai + Shutter — centre */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, justifyContent: 'center', padding: '0 8px' }}>
            <div style={{
              display: 'flex', gap: 6, padding: 6,
              background: theme.surface,
              border: `1px solid ${theme.border}`, borderRadius: theme.rPill
            }}>
              {TIMER_PRESETS.map((s) => {
                const on = timer === s;
                return (
                  <button key={s} type="button" onClick={() => setTimer(s)}
                  style={{
                    appearance: 'none', border: 'none',
                    width: 44 * bSize, height: 36 * bSize,
                    borderRadius: theme.rPill,
                    background: on ? theme.accent : 'transparent',
                    color: on ? theme.accentText : theme.text,
                    fontFamily: theme.fontDisplay, fontSize: 16, fontWeight: on ? 700 : 500,
                    cursor: 'pointer'
                  }}>{s}s</button>);
              })}
            </div>
            <ShutterButton onClick={runCapture} mode={mode} />
          </div>

          {/* Grande flèche réduire — pleine hauteur à droite */}
          <button type="button" onClick={() => setControlsCollapsed(true)}
            aria-label="Réduire les contrôles"
            style={{
              appearance: 'none', border: `1px solid ${theme.border}`,
              background: theme.surface, color: theme.text, cursor: 'pointer',
              borderRadius: theme.rMd, width: 56, alignSelf: 'stretch',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontFamily: theme.fontUI, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = theme.surfaceStrong; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = theme.surface; }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
          </button>
        </div>
      }

      {/* Barre repliée — shutter + bouton déplier */}
      {captureStage === 'idle' && !draftSticker && controlsCollapsed &&
      <div style={{
        position: 'absolute', bottom: 24,
        left: '50%', transform: 'translateX(-50%)',
        padding: '12px 18px',
        display: 'flex', alignItems: 'center', gap: 18,
        zIndex: 15,
        background: theme.glass,
        backdropFilter: theme.glassBlur,
        WebkitBackdropFilter: theme.glassBlur,
        border: `1px solid ${theme.border}`,
        borderRadius: theme.rLg,
        boxShadow: theme.shadow
      }}>
          <button type="button" onClick={() => setControlsCollapsed(false)}
        aria-label="Afficher les contrôles"
        style={{
          appearance: 'none', border: `1px solid ${theme.border}`, background: theme.surface,
          color: theme.text, cursor: 'pointer',
          padding: '12px 18px', borderRadius: theme.rPill,
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: theme.fontUI, fontSize: 14, fontWeight: 500
        }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 15l6-6 6 6" /></svg><span>Réglages</span>
          </button>
          <ShutterButton onClick={runCapture} mode={mode} />
          <div style={{
          padding: '0 8px', fontFamily: theme.fontMono, fontSize: 12,
          color: theme.textMuted, letterSpacing: '0.06em'
        }}>{timer}s · {mode === 'burst' ? '×4' : '1'}</div>
        </div>
      }

      {/* Review */}
      {captureStage === 'review' &&
      <ReviewModal set={reviewSet} idx={reviewIdx} actions={reviewActions} mode={mode}
      reviewFilter={reviewFilter} setReviewFilter={setReviewFilter}
      onKeep={keepCurrent} onSkip={skipCurrent}
      onBack={goBackReview} onRetakeAll={retakeAll} />
      }

      {/* Gallery list drawer */}
      <GalleryDrawer
        open={galleryOpen}
        photos={photos}
        galleryTab={galleryTab}
        onSetTab={setGalleryTab}
        onClose={() => setGalleryOpen(false)}
        onView={(idx) => {setViewerIdx(idx);}} />

      {/* Gallery fullscreen viewer */}
      <GalleryViewer photos={photos} idx={viewerIdx}
      version={galleryTab}
      onSetVersion={setGalleryTab}
      onClose={closeViewer} onPrev={prevViewer} onNext={nextViewer}
      onReprint={(photoId) => setReprintConfirm({ photoId })}
      onEdit={openEditor} />

      {/* Photo editor (copie) */}
      {editingPhoto &&
      <PhotoEditor
        photo={editingPhoto}
        savedTexts={savedTexts}
        customStickers={customStickers}
        onSave={saveEditedCopy}
        onClose={() => setEditingPhoto(null)} />
      }

      {/* PIN modal */}
      <PinModal open={pinOpen} onClose={() => setPinOpen(false)} onSuccess={onPinSuccess}
      title={pinPurpose === 'official' ? 'Décoration officielle' : 'Mode admin'}
      subtitle={pinPurpose === 'official' ?
      'Entre le code admin pour gérer la décoration officielle' :
      'Entre le code admin pour importer des stickers, gérer les textes et la décoration officielle'} />

      {/* Official decoration editor */}
      <OfficialEditor open={officialEditorOpen} current={officialDeco}
      onClose={() => setOfficialEditorOpen(false)}
      onSave={saveOfficial} onRemove={removeOfficial} />

      {/* Tweaks */}
      <PhotoboothTweaks t={t} setTweak={setTweak} onReset={resetAll} />

      {/* Admin sticker placement panel */}
      {draftSticker &&
      <div style={{
        position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)',
        padding: '16px 22px',
        background: theme.glass,
        backdropFilter: theme.glassBlur, WebkitBackdropFilter: theme.glassBlur,
        border: `1.5px solid ${theme.accent}`,
        borderRadius: theme.rLg,
        zIndex: 35,
        display: 'flex', alignItems: 'center', gap: 18,
        color: theme.text, fontFamily: theme.fontUI,
        boxShadow: '0 18px 50px rgba(0,0,0,0.45)'
      }}>
          <div>
            <div style={{ fontFamily: theme.fontMono, fontSize: 10, letterSpacing: '0.12em', color: theme.accent, fontWeight: 600 }}>
              🔓 MODE ADMIN — {draftSticker.editId ? 'MODIFICATION' : 'PLACEMENT'}
            </div>
            <div style={{ fontFamily: theme.fontDisplay, fontSize: 16, fontWeight: 600, marginTop: 2 }}>
              {draftSticker.editId ? 'Modifie' : 'Place'} « {draftSticker.label} »
            </div>
          </div>
          <div style={{ width: 1, height: 36, background: theme.border }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
            <button type="button" onClick={() => setDraftLocked(!draftSticker.lockedPosition)}
          style={{
            width: 44, height: 26, padding: 0, border: 'none', cursor: 'pointer',
            borderRadius: 999,
            background: draftSticker.lockedPosition ? theme.accent : theme.surface,
            position: 'relative',
            transition: 'background .2s'
          }}>
              <div style={{
              position: 'absolute', top: 3, left: draftSticker.lockedPosition ? 21 : 3,
              width: 20, height: 20, borderRadius: '50%',
              background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              transition: 'left .2s'
            }} />
            </button>
            <span>Verrouiller position {draftSticker.lockedPosition ? '🔒' : '🔓'}</span>
          </label>
          <div style={{ width: 1, height: 36, background: theme.border }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={cancelDraftSticker}
          style={{
            appearance: 'none', border: `1px solid ${theme.border}`, background: 'transparent',
            color: theme.text, padding: '10px 16px', borderRadius: theme.rMd,
            fontSize: 14, fontWeight: 500, cursor: 'pointer'
          }}>Annuler</button>
            <button type="button" onClick={validateDraftSticker}
          style={{
            appearance: 'none', border: 'none', background: theme.accent,
            color: theme.accentText, padding: '10px 20px', borderRadius: theme.rMd,
            fontSize: 14, fontWeight: 600, cursor: 'pointer'
          }}>✓ {draftSticker.editId ? 'Enregistrer les modifications' : 'Valider le sticker'}</button>
          </div>
        </div>
      }

      {/* Reprint confirm */}
      <ConfirmModal
        open={!!reprintConfirm}
        icon="🖨"
        title="Réimprimer cette photo ?"
        subtitle={(() => {
          const ph = photos.find((p) => p.id === reprintConfirm?.photoId);
          if (!ph) return '';
          return ph.printed ?
          `Déjà imprimée. Envoie une nouvelle copie en ${galleryTab === 'without' ? 'sans déco' : 'avec déco'}.` :
          `Première impression en ${galleryTab === 'without' ? 'sans déco' : 'avec déco'}.`;
        })()}
        confirmLabel="Oui, imprimer"
        cancelLabel="Annuler"
        onCancel={() => setReprintConfirm(null)}
        onConfirm={() => {
          const id = reprintConfirm.photoId;
          setPhotos((prev) => prev.map((p) => p.id === id ?
          { ...p, printed: true, printedWithDeco: galleryTab !== 'without' } :
          p));
          setReprintConfirm(null);
          showToast('Envoyée à l\'imprimante');
        }} />

      {/* Toast */}
      {toast &&
      <div style={{
        position: 'absolute',
        left: '50%', bottom: 60,
        transform: 'translateX(-50%)',
        padding: '14px 28px',
        background: theme.glass,
        backdropFilter: theme.glassBlur, WebkitBackdropFilter: theme.glassBlur,
        border: `1px solid ${theme.borderStrong}`,
        borderRadius: theme.rPill,
        color: theme.text, fontFamily: theme.fontUI, fontSize: 16, fontWeight: 500,
        zIndex: 80,
        display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
        animation: 'toastIn 0.3s cubic-bezier(.3,.7,.4,1)'
      }}>
          <span style={{ fontSize: 20 }}>🖨</span>
          <span>{toast}</span>
        </div>
      }

      <style>{`
        @keyframes countPulse {
          0% { transform: scale(0.4); opacity: 0; }
          15% { transform: scale(1.15); opacity: 1; }
          80% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
        @keyframes toastIn {
          0% { transform: translate(-50%, 30px); opacity: 0; }
          100% { transform: translate(-50%, 0); opacity: 1; }
        }
        body { background: #000; overscroll-behavior: none; }
        button { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>);

}

const pillBtnStyle = (T) => ({
  appearance: 'none', border: `1px solid ${T.border}`,
  background: T.glass, backdropFilter: T.glassBlur, WebkitBackdropFilter: T.glassBlur,
  color: T.text, padding: '10px 18px', borderRadius: T.rPill,
  fontFamily: T.fontUI, fontSize: 13, cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 8
});

// ─── Review modal ──────────────────────────────────────────────────────────
function ReviewModal({ set, idx, actions, mode, reviewFilter, setReviewFilter, onKeep, onSkip, onBack, onRetakeAll }) {
  const theme = window.__THEME;
  const current = set[idx];
  const isBurst = mode === 'burst';
  const canGoBack = actions.length > 0;

  // Aperçu re-rendu avec le filtre choisi à la validation
  const previewUrl = useMemo(() => {
    if (!current?.baseCanvas) return current?.dataUrl;
    const css = FILTERS.find((f) => f.value === reviewFilter)?.css || 'none';
    return composePhoto(current.baseCanvas, css, current.decoSnapshot, true);
  }, [current, reviewFilter]);

  if (!current) return null;
  const lastAction = actions[actions.length - 1];

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 40,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, maxHeight: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontFamily: theme.fontUI, fontSize: 12, letterSpacing: theme.labelTracking,
            textTransform: theme.labelTransform, color: theme.textMuted
          }}>
            {isBurst ? `Rafale · ${idx + 1} / ${set.length}` : 'Photo'}
          </div>
          <div style={{ fontFamily: theme.fontDisplay, fontSize: 36, fontWeight: 600, color: theme.text, marginTop: 4 }}>
            Tu la gardes ?
          </div>
        </div>

        <div style={{
          background: '#000', borderRadius: theme.rLg, overflow: 'hidden',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
          border: `1px solid ${theme.border}`,
          maxWidth: '70vw', maxHeight: '55vh', aspectRatio: '4/3'
        }}>
          <img src={previewUrl} alt=""
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
        </div>

        {isBurst &&
        <div style={{ display: 'flex', gap: 10 }}>
            {set.map((_, i) => {
            const act = actions[i];
            const fill = i === idx ? theme.accent : act?.type === 'keep' ? theme.text : act?.type === 'skip' ? theme.danger : theme.surface;
            return (
              <div key={i} style={{
                width: 10, height: 10, borderRadius: '50%',
                background: fill,
                opacity: i === idx ? 1 : act ? 0.65 : 0.3,
                border: `1px solid ${theme.border}`
              }} />);

          })}
          </div>
        }

        {/* Filtre — appliqué à la validation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          <div style={{
            fontFamily: theme.fontUI, fontSize: 12, letterSpacing: theme.labelTracking,
            textTransform: theme.labelTransform, color: theme.textMuted
          }}>Filtre</div>
          <FilterRow value={reviewFilter} onChange={setReviewFilter} compact />
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '90vw' }}>
          {canGoBack &&
          <TactileButton onClick={onBack}>
              <span>← Précédent ({lastAction?.type === 'keep' ? 'retirer' : 'reprendre'})</span>
            </TactileButton>
          }
          <TactileButton onClick={onSkip} icon={Icons.x} big danger>
            <span>Refaire</span>
          </TactileButton>
          <TactileButton onClick={() => onKeep('no')} icon={Icons.check} big>
            <span>Garder</span>
          </TactileButton>
          {current.hasDecoration ?
          <>
              <TactileButton onClick={() => onKeep('without-deco')} big>
                <span>🖨 Imprimer sans déco</span>
              </TactileButton>
              <TactileButton onClick={() => onKeep('with-deco')} big primary>
                <span>🖨 Imprimer avec déco</span>
              </TactileButton>
            </> :

          <TactileButton onClick={() => onKeep('without-deco')} big primary>
              <span>🖨 Garder &amp; imprimer</span>
            </TactileButton>
          }
        </div>

        <button type="button" onClick={onRetakeAll}
        style={{
          appearance: 'none', border: 'none', background: 'transparent',
          color: theme.textMuted, fontFamily: theme.fontUI, fontSize: 13,
          textDecoration: 'underline', cursor: 'pointer', padding: 8
        }}>{isBurst ? 'Tout annuler' : 'Annuler la prise'}</button>
      </div>
    </div>);

}

// ─── Gallery drawer (sans suppression) ─────────────────────────────────────
function GalleryDrawer({ open, photos, onClose, onView, galleryTab, onSetTab }) {
  const T = window.__THEME;
  const printedCount = photos.filter((p) => p.printed).length;
  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0,
      width: 460,
      background: T.glass, backdropFilter: T.glassBlur, WebkitBackdropFilter: T.glassBlur,
      borderLeft: `1px solid ${T.border}`,
      transform: open ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform .3s cubic-bezier(.3,.7,.4,1)',
      display: 'flex', flexDirection: 'column',
      zIndex: 20, color: T.text
    }}>
      <div style={{
        padding: '24px 28px 16px',
        borderBottom: `1px solid ${T.border}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <Label>Galerie</Label>
            <div style={{ fontFamily: T.fontDisplay, fontSize: 28, fontWeight: 600, marginTop: 4 }}>
              {photos.length} photo{photos.length !== 1 ? 's' : ''}
            </div>
            <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textMuted, marginTop: 2, letterSpacing: '0.08em' }}>
              {printedCount} IMPRIMÉE{printedCount !== 1 ? 'S' : ''}
            </div>
          </div>
          <button type="button" onClick={onClose}
          style={{
            appearance: 'none', border: 'none', background: T.surface,
            color: T.text, width: 44, height: 44, borderRadius: T.rPill,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
          }}>{Icons.close}</button>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: 4, background: T.surface, borderRadius: T.rMd }}>
          {[
          { id: 'with', label: 'Avec déco' },
          { id: 'without', label: 'Sans déco' }].
          map((tab) =>
          <button key={tab.id} type="button" onClick={() => onSetTab(tab.id)}
          style={{
            flex: 1, appearance: 'none', border: 'none',
            background: galleryTab === tab.id ? T.accent : 'transparent',
            color: galleryTab === tab.id ? T.accentText : T.text,
            padding: '10px 12px', borderRadius: T.rSm,
            fontFamily: T.fontUI, fontSize: 13, fontWeight: 600, cursor: 'pointer'
          }}>{tab.label}</button>
          )}
        </div>
      </div>
      <div style={{
        flex: 1, overflow: 'auto', padding: 20,
        display: 'grid',
        gridTemplateColumns: photos.length <= 2 ? '1fr' :
        photos.length <= 12 ? 'repeat(2, 1fr)' :
        'repeat(3, 1fr)',
        gap: photos.length > 12 ? 8 : 12,
        alignContent: 'flex-start'
      }}>
        {photos.length === 0 &&
        <div style={{
          gridColumn: '1 / -1', textAlign: 'center', color: T.textFaint,
          padding: 40, fontFamily: T.fontUI, fontSize: 15
        }}>
            Aucune photo pour l'instant.<br />Lance ta première capture.
          </div>
        }
        {photos.slice().reverse().map((p, i) => {
          const realIdx = photos.length - 1 - i;
          const thumbUrl = galleryTab === 'without' && p.dataUrlRaw ? p.dataUrlRaw : p.dataUrl;
          return (
            <button key={p.id} type="button" onClick={() => onView(realIdx)}
            style={{
              appearance: 'none', padding: 0, border: 'none',
              aspectRatio: '4/3',
              background: T.surface, borderRadius: T.rSm,
              overflow: 'hidden', position: 'relative',
              boxShadow: `0 0 0 1px ${T.border}`,
              cursor: 'pointer', textAlign: 'left',
              transition: 'transform .15s, box-shadow .15s'
            }}
            onMouseEnter={(e) => {e.currentTarget.style.transform = 'translateY(-2px)';e.currentTarget.style.boxShadow = `0 0 0 1px ${T.borderStrong}, 0 8px 24px rgba(0,0,0,0.3)`;}}
            onMouseLeave={(e) => {e.currentTarget.style.transform = '';e.currentTarget.style.boxShadow = `0 0 0 1px ${T.border}`;}}>
              
              <img src={thumbUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {p.printed &&
              <div style={{
                position: 'absolute', top: 6, right: 6,
                background: '#3a8a4e', color: '#fff',
                width: 26, height: 26, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, boxShadow: '0 2px 6px rgba(0,0,0,0.4)'
              }} title="Imprimée">🖨</div>
              }
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                padding: '8px 10px',
                background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                color: '#fff', fontFamily: T.fontMono, fontSize: 10,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <span>{p.time}</span>
                {p.hasDecoration && galleryTab === 'with' &&
                <span style={{ background: T.accent, color: T.accentText, padding: '2px 6px', borderRadius: T.rSm }}>déco</span>
                }
              </div>
            </button>);

        })}
      </div>
      {photos.length > 0 &&
      <div style={{ padding: '12px 20px 18px', borderTop: `1px solid ${T.border}`, fontSize: 12, color: T.textMuted, fontFamily: T.fontUI, textAlign: 'center' }}>
          Touche une photo pour l'afficher en grand
        </div>
      }
    </div>);

}

// ─── Tweaks panel ──────────────────────────────────────────────────────────
function PhotoboothTweaks({ t, setTweak, onReset }) {
  return (
    <TweaksPanel title="Tweaks PhotoBooth">
      <TweakSection label="Direction visuelle" />
      <TweakSelect label="Thème" value={t.theme}
      options={[
      { value: 'studio', label: 'Studio Pro (sombre)' },
      { value: 'festif', label: 'Festif coloré' },
      { value: 'minimal', label: 'Minimal sobre' }]
      }
      onChange={(v) => setTweak('theme', v)} />
      <TweakColor label="Accent" value={t.accentOverride}
      options={['', '#d4a574', '#ffd23f', '#0a0a0a', '#ff3d8b', '#00d4a6', '#7b5cff']}
      onChange={(v) => setTweak('accentOverride', v)} />

      <TweakSection label="Ergonomie tactile" />
      <TweakSlider label="Taille des boutons" value={t.buttonSize} min={0.85} max={1.4} step={0.05}
      onChange={(v) => setTweak('buttonSize', v)} />

      <TweakSection label="Données" />
      <div style={{ fontSize: 11, color: 'rgba(41,38,27,.55)', lineHeight: 1.5, fontFamily: 'ui-sans-serif', marginBottom: 8 }}>
        Galerie, stickers, textes &amp; réglages sont sauvegardés automatiquement entre les sessions.
      </div>
      <TweakButton label="Vider tout (galerie + réglages)"
      onClick={onReset} secondary />

      <TweakSection label="Info" />
      <div style={{ fontSize: 11, color: 'rgba(41,38,27,.55)', lineHeight: 1.5, fontFamily: 'ui-sans-serif' }}>
        Code admin (déco officielle) : <strong>1234</strong>
      </div>
    </TweaksPanel>);

}

const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(<App />);
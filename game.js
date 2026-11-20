/* =========================================================
   Infinity Craft — игровая логика
   ========================================================= */
(function () {
  'use strict';

  const DATA = window.CRAFT_DATA;
  if (!DATA) {
    console.error('CRAFT_DATA не загружен: проверьте recipes.js');
    return;
  }

  const { ELEMENTS, RECIPES, BASE_ELEMENTS } = DATA;
  // Опции версии (all.html подключает config-all.js).
  const OPTIONS = Object.assign(
    {
      startAllUnlocked: false,
      knownRecipes: false,
      seedBoard: null,
      saveKey: 'infinity-craft.save.v1',
      // Режим «выбери сам»: для пар без рецепта предлагаем выбрать результат.
      proposeUnknown: false,
      proposalsKey: 'infinity-craft.proposals.v1',
    },
    window.CRAFT_OPTIONS || {}
  );
  const SAVE_KEY = OPTIONS.saveKey;
  const SAVE_VERSION = 1;
  const MAX_BOARD = 60;
  const ALL_ELEMENT_IDS = Object.keys(ELEMENTS);
  const ELEMENT_IDS = ALL_ELEMENT_IDS;

  const dom = {
    board: document.getElementById('board'),
    panel: document.querySelector('.panel'),
    boardCounter: document.getElementById('boardCounter'),
    elementsList: document.getElementById('elementsList'),
    panelCount: document.getElementById('panelCount'),
    searchInput: document.getElementById('searchInput'),
    statElements: document.getElementById('statElements'),
    statRecipes: document.getElementById('statRecipes'),
    savePill: document.getElementById('savePill'),
    saveText: document.getElementById('saveText'),
    toasts: document.getElementById('toasts'),
    confettiLayer: document.getElementById('confettiLayer'),
    btnRecipes: document.getElementById('btnRecipes'),
    btnMenu: document.getElementById('btnMenu'),
    btnClear: document.getElementById('btnClear'),
    menu: document.getElementById('menu'),
    menuSound: document.getElementById('menuSound'),
    importFile: document.getElementById('importFile'),
    recipesDialog: document.getElementById('recipesDialog'),
    recipesSubtitle: document.getElementById('recipesSubtitle'),
    recipeSearch: document.getElementById('recipeSearch'),
    recipeList: document.getElementById('recipeList'),
    recipeCount: document.getElementById('recipeCount'),
    confirmDialog: document.getElementById('confirmDialog'),
    confirmIcon: document.getElementById('confirmIcon'),
    confirmTitle: document.getElementById('confirmTitle'),
    confirmText: document.getElementById('confirmText'),
    confirmCancel: document.getElementById('confirmCancel'),
    confirmOk: document.getElementById('confirmOk'),
    proposeDialog: document.getElementById('proposeDialog'),
    proposeSubtitle: document.getElementById('proposeSubtitle'),
    proposeA: document.getElementById('proposeA'),
    proposeB: document.getElementById('proposeB'),
    proposeInput: document.getElementById('proposeInput'),
    proposeGrid: document.getElementById('proposeGrid'),
    proposeNote: document.getElementById('proposeNote'),
    proposeSaveHint: document.getElementById('proposeSaveHint'),
    proposeSkip: document.getElementById('proposeSkip'),
    proposeSave: document.getElementById('proposeSave'),
    proposeApply: document.getElementById('proposeApply'),
    proposeList: document.getElementById('proposeList'),
    proposeCount: document.getElementById('proposeCount'),
    menuProposals: document.getElementById('menuProposals'),
    proposalsDialog: document.getElementById('proposalsDialog'),
    proposalsCount: document.getElementById('proposalsCount'),
    proposalsList: document.getElementById('proposalsList'),
    proposalsCopy: document.getElementById('proposalsCopy'),
    proposalsExport: document.getElementById('proposalsExport'),
    proposeHint: document.getElementById('proposeHint'),
    proposeForm: document.getElementById('proposeForm'),
    renameDialog: document.getElementById('renameDialog'),
    renameSubtitle: document.getElementById('renameSubtitle'),
    renameInput: document.getElementById('renameInput'),
    renameEmoji: document.getElementById('renameEmoji'),
    renameHint: document.getElementById('renameHint'),
    renameForm: document.getElementById('renameForm'),
    renameReset: document.getElementById('renameReset'),
    quickRename: document.getElementById('quickRename'),
    quickRenameInput: document.getElementById('quickRenameInput'),
    editorDialog: document.getElementById('editorDialog'),
    editorRows: document.getElementById('editorRows'),
    editorSearch: document.getElementById('editorSearch'),
    editorCount: document.getElementById('editorCount'),
    btnEditor: document.getElementById('btnEditor'),
  };

  /* ---------------- утилиты ---------------- */

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  const plural = (n, one, few, many) => {
    const n10 = n % 10;
    const n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return one;
    if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
    return many;
  };
  const elementWord = (n) => plural(n, 'элемент', 'элемента', 'элементов');
  const recipeWord = (n) => plural(n, 'рецепт', 'рецепта', 'рецептов');

  const formatTime = (ts) => {
    try {
      return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- база рецептов ---------------- */

  const pairKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  const recipeByPair = new Map();
  const recipeList = [];
  // Исходные названия из базы — для кнопки «Вернуть» в переименовании.
  const BASE_NAMES = {};
  for (const id of ALL_ELEMENT_IDS) {
    if (ELEMENTS[id]) BASE_NAMES[id] = ELEMENTS[id].name;
  }

  for (const raw of RECIPES) {
    if (!ELEMENTS[raw.a] || !ELEMENTS[raw.b] || !ELEMENTS[raw.result]) {
      console.warn('Пропущен рецепт с неизвестным элементом:', raw);
      continue;
    }
    const key = pairKey(raw.a, raw.b);
    if (recipeByPair.has(key)) {
      console.warn('Пропущен дубликат пары:', raw);
      continue;
    }
    const recipe = { a: raw.a, b: raw.b, result: raw.result, key, user: Boolean(raw.user) };
    recipeByPair.set(key, recipe);
    recipeList.push(recipe);
  }

  /* ---------------- состояние ---------------- */

  const state = {
    discovered: BASE_ELEMENTS.slice(),
    board: [],
    settings: { sound: true },
  };
  const foundSet = new Set();

  let uidCounter = 0;
  let zCounter = 10;
  let selectedUid = null;
  let drag = null;
  let panelDrag = null;
  let suppressClickUntil = 0;
  let suppressPanelClickUntil = 0;
  let lastFailNotice = 0;

  let saveTimer = null;
  let lastSavedAt = null;
  let storageBroken = false;
  let status = 'saved';

  const chipEls = new Map(); // uid -> DOM-элемент
  const searchCache = new Map(); // id -> строка поиска

  /* ---------------- звук ---------------- */

  let audioCtx = null;

  function audio() {
    if (!state.settings.sound) return null;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try {
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
      return audioCtx;
    } catch {
      return null;
    }
  }

  function tone(freq, opts) {
    const cfg = Object.assign({ dur: 0.12, type: 'sine', gain: 0.03, delay: 0, slide: 0 }, opts);
    const ctx = audio();
    if (!ctx) return;
    try {
      const t0 = ctx.currentTime + cfg.delay;
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = cfg.type;
      osc.frequency.setValueAtTime(freq, t0);
      if (cfg.slide) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + cfg.slide), t0 + cfg.dur);
      }
      amp.gain.setValueAtTime(0.0001, t0);
      amp.gain.exponentialRampToValueAtTime(cfg.gain, t0 + 0.012);
      amp.gain.exponentialRampToValueAtTime(0.0001, t0 + cfg.dur);
      osc.connect(amp).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + cfg.dur + 0.02);
    } catch {
      /* звук не критичен */
    }
  }

  function playSound(kind) {
    if (!state.settings.sound) return;
    switch (kind) {
      case 'add':
        tone(520, { dur: 0.09, type: 'sine', gain: 0.022, slide: 130 });
        break;
      case 'click':
        tone(430, { dur: 0.05, type: 'triangle', gain: 0.012 });
        break;
      case 'pick':
        tone(300, { dur: 0.045, type: 'triangle', gain: 0.01 });
        break;
      case 'combine':
        tone(392, { dur: 0.1, type: 'sine', gain: 0.022 });
        tone(523.25, { dur: 0.14, type: 'sine', gain: 0.02, delay: 0.07 });
        break;
      case 'discover':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
          tone(f, { dur: 0.16, type: 'sine', gain: 0.024, delay: i * 0.075 })
        );
        break;
      case 'fail':
        tone(150, { dur: 0.12, type: 'sine', gain: 0.02, slide: -50 });
        break;
      case 'remove':
        tone(440, { dur: 0.09, type: 'triangle', gain: 0.016, slide: -170 });
        break;
      case 'propose':
        tone(659.25, { dur: 0.12, type: 'sine', gain: 0.02 });
        tone(880, { dur: 0.18, type: 'sine', gain: 0.016, delay: 0.09 });
        break;
      default:
        break;
    }
  }

  /* ---------------- DOM-помощники ---------------- */

  function makeEmojiCircle(id, className) {
    const def = ELEMENTS[id];
    const span = document.createElement('span');
    span.className = className || 'chip-emoji';
    span.textContent = def.emoji;
    span.setAttribute('aria-hidden', 'true');
    return span;
  }

  function makeMiniChip(id) {
    const def = ELEMENTS[id];
    const chip = document.createElement('span');
    chip.className = 'mini-chip';
    chip.style.setProperty('--h', def.hue);
    chip.append(makeEmojiCircle(id), document.createTextNode(def.name));
    return chip;
  }

  function makeChipElement(id, uid) {
    const def = ELEMENTS[id];
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.dataset.uid = String(uid);
    chip.dataset.element = id;
    chip.style.setProperty('--h', def.hue);
    chip.setAttribute('aria-label', `${def.name}. Перетащите на другой элемент или выберите для соединения`);
    chip.title = def.name;
    const label = document.createElement('span');
    label.className = 'chip-name';
    label.textContent = def.name;
    chip.append(makeEmojiCircle(id), label);

    if (canRename(id)) {
      const renameBtn = document.createElement('span');
      renameBtn.className = 'chip-rename';
      renameBtn.dataset.rename = id;
      renameBtn.setAttribute('role', 'button');
      renameBtn.setAttribute('aria-label', `Изменить название «${def.name}»`);
      renameBtn.title = 'Изменить название';
      renameBtn.textContent = '✏️';
      chip.append(renameBtn);
    }
    return chip;
  }

  function makeGhostChip(id) {
    const def = ELEMENTS[id];
    const ghost = document.createElement('div');
    ghost.className = 'chip chip--ghost';
    ghost.style.setProperty('--h', def.hue);
    ghost.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'chip-name';
    label.textContent = def.name;
    ghost.append(makeEmojiCircle(id), label);
    return ghost;
  }

  function makeSidebarItem(id, highlight) {
    const def = ELEMENTS[id];
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'el-item' + (highlight ? ' just-found' : '');
    item.dataset.element = id;
    item.dataset.search = (def.name + ' ' + id).toLowerCase();
    item.style.setProperty('--h', def.hue);
    item.title = `Перетащите «${def.name}» на стол или нажмите, чтобы добавить`;
    item.setAttribute('aria-label', `Добавить элемент «${def.name}» на стол. Можно перетащить мышью.`);
    item.draggable = false;

    const name = document.createElement('span');
    name.className = 'el-name';
    name.textContent = def.name;

    const plus = document.createElement('span');
    plus.className = 'el-add';
    plus.textContent = '+';
    plus.setAttribute('aria-hidden', 'true');

    if (canRename(id)) {
      item.title = `«${def.name}»: клик — на стол, ✏️ — переименовать`;
      plus.textContent = '✏️';
      plus.className = 'el-add el-rename';
      plus.dataset.rename = id;
      plus.setAttribute('role', 'button');
      plus.setAttribute('aria-label', `Изменить название «${def.name}»`);
      plus.removeAttribute('aria-hidden');
      const addMark = document.createElement('span');
      addMark.className = 'el-add el-add-mark';
      addMark.textContent = '+';
      addMark.setAttribute('aria-hidden', 'true');
      item.append(makeEmojiCircle(id), name, addMark, plus);
      return item;
    }

    item.append(makeEmojiCircle(id), name, plus);
    return item;
  }

  function showToast(opts) {
    const cfg = Object.assign(
      { icon: '💡', title: '', text: '', tone: '', duration: 3200, chips: null, kind: '' },
      opts
    );
    const kind = cfg.kind || (cfg.tone === 'error' ? 'error' : 'info');
    const node = document.createElement('div');
    node.className = 'toast' + (cfg.tone ? ' toast--' + cfg.tone : '');
    node.dataset.kind = kind;

    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.textContent = cfg.icon;
    icon.setAttribute('aria-hidden', 'true');

    const body = document.createElement('div');
    body.className = 'toast-body';

    if (cfg.title) {
      const strong = document.createElement('strong');
      strong.textContent = cfg.title;
      body.append(strong);
    }
    if (cfg.text) {
      const text = document.createElement('span');
      text.className = 'toast-text';
      text.textContent = cfg.text;
      body.append(text);
    }
    if (cfg.chips && cfg.chips.length) {
      const row = document.createElement('div');
      row.className = 'toast-chips';
      cfg.chips.forEach((id, i) => {
        if (i) {
          const op = document.createElement('span');
          op.className = 'mini-op';
          op.textContent = '+';
          row.append(op);
        }
        row.append(makeMiniChip(id));
      });
      body.append(row);
    }

    node.append(icon, body);

    // Оставляем только свежие уведомления одного типа.
    for (const old of Array.from(dom.toasts.children)) {
      if (old.dataset.kind === kind) old.remove();
    }

    dom.toasts.append(node);

    while (dom.toasts.children.length > 2) {
      dom.toasts.firstElementChild.remove();
    }

    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      node.classList.add('is-out');
      setTimeout(() => node.remove(), 240);
    };
    if (cfg.duration > 0) setTimeout(dismiss, cfg.duration);
    return dismiss;
  }

  function confettiAt(x, y) {
    if (reduceMotion) return;
    const colors = ['#ff5a36', '#f0a93b', '#3f9d64', '#4abeb4', '#f53d6b', '#7c6cf0', '#ff8a4c'];
    for (let i = 0; i < 22; i++) {
      const piece = document.createElement('i');
      piece.className = 'confetti';
      const angle = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 130;
      const size = 5 + Math.random() * 6;
      piece.style.left = x + 'px';
      piece.style.top = y + 'px';
      piece.style.width = size + 'px';
      piece.style.height = size * 0.62 + 'px';
      piece.style.background = colors[i % colors.length];
      piece.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
      piece.style.setProperty('--dy', Math.sin(angle) * dist - 30 + 'px');
      piece.style.setProperty('--rot', Math.random() * 720 - 360 + 'deg');
      piece.style.animationDelay = Math.random() * 0.06 + 's';
      dom.confettiLayer.append(piece);
      setTimeout(() => piece.remove(), 1300);
    }
  }

  /* ---------------- позиционирование ---------------- */

  function boardRect() {
    return dom.board.getBoundingClientRect();
  }

  function pointerInPanel(x, y) {
    const rect = dom.panel.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  function clampToBoard(x, y, el) {
    const rect = boardRect();
    if (!rect.width || !rect.height) return { x: clamp(x, 0.05, 0.95), y: clamp(y, 0.05, 0.95) };
    const w = el.offsetWidth || 110;
    const h = el.offsetHeight || 40;
    const padX = Math.min(0.46, (w / 2 + 8) / rect.width);
    const padY = Math.min(0.46, (h / 2 + 8) / rect.height);
    return {
      x: clamp(x, padX, 1 - padX),
      y: clamp(y, padY, 1 - padY),
    };
  }

  function applyChipPosition(el, data) {
    el.style.left = (data.x * 100).toFixed(3) + '%';
    el.style.top = (data.y * 100).toFixed(3) + '%';
  }

  function bringToFront(uid) {
    const el = chipEls.get(uid);
    if (!el) return;
    zCounter += 1;
    el.style.zIndex = String(zCounter);
  }

  function clampAllChips(persist) {
    let changed = false;
    for (const item of state.board) {
      const el = chipEls.get(item.uid);
      if (!el) continue;
      const next = clampToBoard(item.x, item.y, el);
      if (next.x !== item.x || next.y !== item.y) {
        item.x = next.x;
        item.y = next.y;
        applyChipPosition(el, item);
        changed = true;
      }
    }
    if (changed && persist) scheduleSave();
  }

  function findFreeSpot() {
    const rect = boardRect();
    const existing = state.board;
    let best = { x: 0.5, y: 0.5 };
    let bestDist = -1;

    for (let attempt = 0; attempt < 45; attempt++) {
      const candidate = {
        x: 0.12 + Math.random() * 0.76,
        y: 0.12 + Math.random() * 0.76,
      };
      let dist = Infinity;
      for (const item of existing) {
        const dx = (item.x - candidate.x) * rect.width;
        const dy = (item.y - candidate.y) * rect.height;
        dist = Math.min(dist, Math.hypot(dx, dy));
      }
      if (dist > bestDist) {
        bestDist = dist;
        best = candidate;
      }
      if (dist > 165) break;
    }
    return best;
  }

  // Результат крафта появляется между ингредиентами, но не поверх других фишек.
  function findResultSpot(x, y) {
    const rect = boardRect();
    const minDist = Math.max(72, Math.min(128, rect.width * 0.14));
    const offsets = [
      [0, 0],
      [0.07, 0],
      [-0.07, 0],
      [0, 0.08],
      [0, -0.08],
      [0.09, 0.07],
      [-0.09, 0.07],
      [0.09, -0.07],
      [-0.09, -0.07],
      [0.15, 0],
      [-0.15, 0],
      [0, 0.15],
      [0, -0.15],
    ];

    for (const [ox, oy] of offsets) {
      const cx = clamp(x + ox, 0.06, 0.94);
      const cy = clamp(y + oy, 0.06, 0.94);
      let free = true;
      for (const item of state.board) {
        const dx = (item.x - cx) * rect.width;
        const dy = (item.y - cy) * rect.height;
        if (Math.hypot(dx, dy) < minDist) {
          free = false;
          break;
        }
      }
      if (free) return { x: cx, y: cy };
    }
    return { x, y };
  }

  /* ---------------- элементы на столе ---------------- */

  function createBoardChip(id, x, y, opts) {
    const cfg = Object.assign({ animate: false }, opts);
    const def = ELEMENTS[id];
    if (!def) return null;

    uidCounter += 1;
    const uid = uidCounter;
    const data = { uid, id, x, y };

    const el = makeChipElement(id, uid);
    zCounter += 1;
    el.style.zIndex = String(zCounter);
    dom.board.append(el);

    const pos = clampToBoard(x, y, el);
    data.x = pos.x;
    data.y = pos.y;
    applyChipPosition(el, data);
    if (cfg.animate) el.classList.add('is-new');

    chipEls.set(uid, el);
    state.board.push(data);
    updateBoardState();
    return data;
  }

  function bumpChip(el) {
    if (!el) return;
    el.classList.remove('is-bump');
    void el.offsetWidth;
    el.classList.add('is-bump');
    setTimeout(() => el.classList.remove('is-bump'), 380);
  }

  function restorePosition(data, el, x, y) {
    data.x = x;
    data.y = y;
    if (!el) return;
    el.classList.add('is-returning');
    applyChipPosition(el, data);
    setTimeout(() => el.classList.remove('is-returning'), 280);
  }

  function updateBoardState() {
    dom.board.classList.toggle('is-empty', state.board.length === 0);
    dom.boardCounter.textContent = `${state.board.length} на столе`;
  }

  function updateStats() {
    const totalElements = ALL_ELEMENT_IDS.length;
    const totalRecipes = recipeList.length;
    dom.statElements.textContent = String(state.discovered.length);
    dom.statRecipes.textContent = String(foundSet.size);
    dom.panelCount.textContent = String(state.discovered.length);

    const elStat = dom.statElements.closest('.stat');
    if (elStat) {
      elStat.title = OPTIONS.startAllUnlocked
        ? `Все ${totalElements} элементов открыты`
        : `Открыто ${state.discovered.length} из ${totalElements} элементов`;
    }
    const recStat = dom.statRecipes.closest('.stat');
    if (recStat) recStat.title = `Открыто ${foundSet.size} из ${totalRecipes} рецептов`;
  }

  /* ---------------- панель элементов ---------------- */

  function renderSidebar() {
    dom.elementsList.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (const id of state.discovered) {
      frag.append(makeSidebarItem(id, false));
    }
    dom.elementsList.append(frag);
    applyFilter();
  }

  function addSidebarItem(id, highlight) {
    const item = makeSidebarItem(id, highlight);
    const empty = dom.elementsList.querySelector('.list-empty');
    if (empty) dom.elementsList.insertBefore(item, empty);
    else dom.elementsList.append(item);
    applyFilter();
    item.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  function applyFilter() {
    const query = dom.searchInput.value.trim().toLowerCase();
    let visible = 0;
    for (const item of dom.elementsList.querySelectorAll('.el-item')) {
      const match = !query || (item.dataset.search || '').includes(query);
      item.hidden = !match;
      if (match) visible += 1;
    }

    let empty = dom.elementsList.querySelector('.list-empty');
    if (visible === 0) {
      if (!empty) {
        empty = document.createElement('div');
        empty.className = 'list-empty';
        dom.elementsList.append(empty);
      }
      empty.hidden = false;
      empty.textContent = query
        ? `По запросу «${dom.searchInput.value.trim()}» ничего не нашлось`
        : 'Пока нет элементов';
    } else if (empty) {
      empty.hidden = true;
    }
  }

  function addFromPanel(id) {
    if (!ELEMENTS[id]) return;
    if (state.board.length >= MAX_BOARD) {
      showToast({
        icon: '🧺',
        title: 'Стол переполнен',
        text: `На столе уже ${MAX_BOARD} элементов. Очистите стол или соедините что-нибудь.`,
        tone: 'error',
      });
      return;
    }
    const spot = findFreeSpot();
    const created = createBoardChip(id, spot.x, spot.y, { animate: true });
    if (!created) return;
    bringToFront(created.uid);
    playSound('add');
    scheduleSave();
  }

  /* ---------------- выбор и соединение ---------------- */

  function clearSelection() {
    if (selectedUid !== null) {
      const el = chipEls.get(selectedUid);
      if (el) el.classList.remove('is-selected');
      selectedUid = null;
    }
  }

  function selectChip(uid) {
    const data = state.board.find((c) => c.uid === uid);
    if (!data) return;

    if (selectedUid === uid) {
      clearSelection();
      return;
    }

    if (selectedUid !== null) {
      const first = state.board.find((c) => c.uid === selectedUid);
      if (first) {
        const ok = attemptCombine(first, data, 'click');
        if (ok) return;
        if (OPTIONS.proposeUnknown) {
          openProposal(first, data);
          return;
        }
        bumpChip(chipEls.get(uid));
        playSound('fail');
        notifyFailure();
        return;
      }
      selectedUid = null;
    }

    clearSelection();
    selectedUid = uid;
    const el = chipEls.get(uid);
    if (el) el.classList.add('is-selected');
    bringToFront(uid);
    playSound('click');
  }

  function notifyFailure() {
    const now = Date.now();
    if (now - lastFailNotice < 10000) return;
    lastFailNotice = now;
    showToast({
      icon: '🤷',
      title: 'Эта пара не соединяется',
      text: 'Попробуйте другие элементы — возможно, для этой пары пока нет рецепта.',
    });
  }

  function attemptCombine(a, b, source) {
    if (!a || !b || a.uid === b.uid) return false;
    const found = recipeByPair.get(pairKey(a.id, b.id));
    const recipe = found || customRecipeFor(a.id, b.id);
    if (!recipe) return false;

    const elA = chipEls.get(a.uid);
    const elB = chipEls.get(b.uid);
    const spot = findResultSpot((a.x + b.x) / 2, (a.y + b.y) / 2);

    const isNewElement = !state.discovered.includes(recipe.result);
    const isNewRecipe = !foundSet.has(recipe.key);

    state.board = state.board.filter((c) => c.uid !== a.uid && c.uid !== b.uid);
    chipEls.delete(a.uid);
    chipEls.delete(b.uid);
    clearSelection();

    for (const el of [elA, elB]) {
      if (!el) continue;
      el.classList.remove('is-target', 'is-selected', 'is-dragging');
      el.classList.add('is-merging');
      setTimeout(() => el.remove(), 220);
    }

    if (isNewElement) state.discovered.push(recipe.result);
    if (isNewRecipe) {
      foundSet.add(recipe.key);
      // Пары, добавленные из recipes-user.js, сразу видны в книге рецептов.
      if (recipe.user) scheduleSave();
    }

    const result = createBoardChip(recipe.result, spot.x, spot.y, { animate: true });
    if (result) {
      bringToFront(result.uid);
      if (recipe.custom && OPTIONS.proposeUnknown) {
        // Свой рецепт: результат остаётся на столе и не добавляется в панель.
        playSound('combine');
        updateStats();
        scheduleSave();
        return true;
      }
      if (isNewElement) {
        const el = chipEls.get(result.uid);
        if (el) {
          el.classList.add('is-discovered');
          setTimeout(() => el.classList.remove('is-discovered'), 1200);
        }
      }
      updateStats();
      if (isNewElement) {
        addSidebarItem(recipe.result, true);
        playSound('discover');
        const rect = boardRect();
        confettiAt(rect.left + result.x * rect.width, rect.top + result.y * rect.height);
        showToast({
          icon: ELEMENTS[recipe.result].emoji,
          title: 'Новое открытие!',
          text: `«${ELEMENTS[recipe.result].name}» добавлен в коллекцию`,
          tone: 'gold',
          duration: 4000,
          kind: 'discovery',
        });
      } else {
        playSound('combine');
        if (isNewRecipe) {
          showToast({
            icon: '🔗',
            title: 'Новый рецепт',
            text: `${ELEMENTS[recipe.a].name} + ${ELEMENTS[recipe.b].name} = ${ELEMENTS[recipe.result].name}`,
            duration: 3200,
            kind: 'recipe',
          });
        }
      }
      scheduleSave();
    }

    void source;
    return true;
  }

  /* ---------------- режим «выбери сам» (all.html) ---------------- */

  let proposals = [];
  let proposalsStorageBroken = false;
  let names = {};
  let renames = {};
  let userRenamedIds = new Set();
  let pendingProposition = null;
  let selectedPropositionId = null;
  let propositionIdCounter = 0;

  function uid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    propositionIdCounter += 1;
    return 'p-' + Date.now().toString(36) + '-' + propositionIdCounter;
  }

  // Внутренний id для придуманного элемента. Имя в нём НЕ хранится —
  // отображаемое название всегда берётся из resultName / поля элемента.
  function makeElementKey() {
    let key;
    do {
      key = 'custom:' + Math.random().toString(36).slice(2, 8);
    } while (ELEMENTS[key] || ALL_ELEMENT_IDS.includes(key));
    return key;
  }

  // Старые элементы могли получить имя из своего id — убираем только хвост id.
  // Регистр и знаки препинания не трогаем никогда.
  const LEGACY_SLUG = /^custom:(.*)-([a-z0-9]{4,8})$/i;

  function elementHashTail(id) {
    const legacy = LEGACY_SLUG.exec(id);
    return legacy ? legacy[2] : '';
  }

  function stripHashFromName(id, value) {
    const name = String(value || '').trim();
    const tail = elementHashTail(id);
    if (!tail) return name;
    if (name.endsWith(' ' + tail)) return name.slice(0, -(tail.length + 1)).trimEnd();
    if (name.endsWith(tail)) return name.slice(0, -tail.length).trimEnd();
    return name;
  }

  function repairElementName(id, item) {
    const def = ELEMENTS[id];
    if (!def) return;
    const tail = elementHashTail(id);

    // Явное переименование игроком важнее всего, если в нём нет хвоста id.
    const explicit = userRenamedIds.has(id) ? names[id] : '';
    const explicitClean = explicit && !(tail && explicit.endsWith(tail)) ? explicit : '';

    const fromItem = item
      ? stripHashFromName(id, item.originalName || item.resultName || '')
      : '';
    const next = explicitClean || fromItem;
    if (!next) return;

    if (def.name !== next) {
      def.originalName = def.originalName || def.name;
      def.name = next;
      def.repaired = true;
    }
  }

  function loadProposals() {
    if (!OPTIONS.proposeUnknown) return [];
    let raw = null;
    try {
      raw = localStorage.getItem(OPTIONS.proposalsKey);
    } catch {
      proposalsStorageBroken = true;
      return [];
    }
    if (!raw) return [];
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return [];
    }
    if (!data || !Array.isArray(data.items)) return [];
    // Имена, изменённые игроком, хранятся рядом с рецептами.
    const renamed = data.renamed && typeof data.renamed === 'object' ? data.renamed : {};
    userRenamedIds = new Set();
    for (const [id, value] of Object.entries(renamed)) {
      if (typeof value === 'string' && value) {
        names[id] = value;
        userRenamedIds.add(id);
      }
    }
    return data.items
      .filter((item) => item && typeof item.a === 'string' && typeof item.b === 'string' && typeof item.result === 'string')
      .map((item) => {
        // Элементы, созданные в прошлых сессиях, восстанавливаем по id.
        for (const id of [item.a, item.b, item.result]) {
          if (!ELEMENTS[id]) {
            const legacy = LEGACY_SLUG.exec(id);
            const fallback = legacy ? legacy[1].replace(/-/g, ' ').trim() : id.replace(/^custom:/, '');
            ELEMENTS[id] = { name: fallback, emoji: '✨', hue: 280, custom: true };
            if (!ALL_ELEMENT_IDS.includes(id)) {
              ALL_ELEMENT_IDS.push(id);
            }
          }
          if (ELEMENTS[id].custom) repairElementName(id, item);
        }
        return item;
      })
      .filter((item) => ELEMENTS[item.a] && ELEMENTS[item.b] && ELEMENTS[item.result]);
  }

  function saveProposals() {
    if (!OPTIONS.proposeUnknown) return;
    try {
      const renamed = {};
      for (const id of ALL_ELEMENT_IDS) {
        const def = ELEMENTS[id];
        if (def && def.userRenamed) renamed[id] = def.name;
      }
      const payload = { version: 1, items: proposals };
      if (Object.keys(renamed).length) payload.renamed = renamed;
      localStorage.setItem(OPTIONS.proposalsKey, JSON.stringify(payload));
      proposalsStorageBroken = false;
    } catch {
      proposalsStorageBroken = true;
      setProposeHint('Не удалось сохранить предложение — проверьте настройки браузера.', true);
    }
  }

  // Применяет сохранённые переименования (в т.ч. для элементов из recipes-user.js).
  function applyRenamedNames() {
    const all = Object.assign({}, names, renames);
    for (const [id, value] of Object.entries(all)) {
      if (!value || !ELEMENTS[id]) continue;
      // Не затираем имя, если в старом сохранении остался служебный хвост id:
      // настоящее имя уже восстановлено из resultName с регистром и знаками.
      const tail = elementHashTail(id);
      if (tail && value.endsWith(tail)) continue;
      ELEMENTS[id].originalName = ELEMENTS[id].originalName || ELEMENTS[id].name;
      ELEMENTS[id].name = value;
      ELEMENTS[id].renamed = true;
      ELEMENTS[id].userRenamed = true;
    }
  }

  function customRecipeFor(a, b) {
    if (!OPTIONS.proposeUnknown || !proposals.length) return null;
    const k = pairKey(a, b);
    const item = proposals.find((p) => pairKey(p.a, p.b) === k);
    if (!item) return null;
    return { a: item.a, b: item.b, result: item.result, key: k, custom: true };
  }

  // Нормализация только для поиска и проверки «это тот же элемент».
  // Само название, введённое игроком, никогда не меняется.
  function normName(value) {
    return String(value)
      .normalize('NFKC')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/'/g, '')
      .replace(/[^a-zа-я0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function findElementIdByName(name) {
    const target = normName(name);
    if (!target) return null;
    for (const id of ALL_ELEMENT_IDS) {
      if (normName(ELEMENTS[id].name) === target) return id;
    }
    return null;
  }

  function proposalsForPair(a, b) {
    const k = pairKey(a, b);
    return proposals
      .filter((p) => pairKey(p.a, p.b) === k)
      .sort((x, y) => (y.savedAt || 0) - (x.savedAt || 0));
  }

  function setProposeHint(text, isError) {
    if (!dom.proposeSaveHint) return;
    dom.proposeSaveHint.textContent = text;
    dom.proposeSaveHint.classList.toggle('is-error', Boolean(isError));
  }

  function refreshApplyButton() {
    if (!dom.proposeApply) return;
    const used = pendingProposition ? proposalsForPair(pendingProposition.a.id, pendingProposition.b.id).length : 0;
    dom.proposeApply.disabled = proposals.length === 0;
    dom.proposeApply.textContent = proposals.length
      ? `✅ Использовать все мои предложения (${proposals.length})`
      : '✅ Применить мои предложения';
    if (used && dom.proposeNote) {
      dom.proposeNote.textContent = `Для этой пары уже есть ваше предложение (${used}) — можно выбрать его ниже.`;
    }
  }

  function closeProposal() {
    pendingProposition = null;
    if (dom.proposeDialog && dom.proposeDialog.open) dom.proposeDialog.close();
  }

  function openProposal(a, b) {
    if (!OPTIONS.proposeUnknown || !dom.proposeDialog) return;
    if (!a || !b || a.uid === b.uid) return;
    if (recipeByPair.get(pairKey(a.id, b.id))) return false;

    pendingProposition = { a, b };
    selectedPropositionId = null;
    renderProposals();

    dom.proposeA.replaceChildren(makeMiniChip(a.id));
    dom.proposeB.replaceChildren(makeMiniChip(b.id));
    dom.proposeSubtitle.textContent = `${ELEMENTS[a.id].name} + ${ELEMENTS[b.id].name}`;
    dom.proposeInput.value = '';
    setProposeHint('');

    if (dom.proposeNote) {
      const used = proposalsForPair(a.id, b.id).length;
      dom.proposeNote.textContent = used
        ? `Для этой пары уже есть ${used} ваше предложение — оно показано ниже.`
        : 'Этого рецепта пока нет. Что получится в этом случае?';
    }

    renderSuggestions('');
    refreshApplyButton();

    if (!dom.proposeDialog.open) dom.proposeDialog.showModal();
    playSound('propose');
    setTimeout(() => {
      if (dom.proposeDialog.open) dom.proposeInput.focus();
    }, 80);
    return true;
  }

  function renderSuggestions(query) {
    if (!dom.proposeGrid) return;
    const q = normName(query);
    let list = ALL_ELEMENT_IDS.slice();

    if (q) {
      const exact = list.filter((id) => normName(ELEMENTS[id].name) === q);
      const starts = list.filter((id) => normName(ELEMENTS[id].name).startsWith(q));
      const contains = list.filter((id) => normName(ELEMENTS[id].name).includes(q));
      list = [...new Set([...exact, ...starts, ...contains])];
    }

    // Сначала — ваши прежние предложения для этой пары.
    if (pendingProposition) {
      const mine = proposalsForPair(pendingProposition.a.id, pendingProposition.b.id).map((p) => p.result);
      list = [...new Set([...mine, ...list])];
    }

    dom.proposeGrid.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (const id of list.slice(0, q ? 40 : 60)) {
      const def = ELEMENTS[id];
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'propose-chip';
      chip.dataset.element = id;
      chip.style.setProperty('--h', def.hue);
      chip.setAttribute('role', 'option');
      chip.setAttribute('aria-selected', 'false');
      chip.append(makeEmojiCircle(id), document.createTextNode(def.name));
      frag.append(chip);
    }
    dom.proposeGrid.append(frag);
  }

  function chooseSuggestion(id) {
    if (!dom.proposeGrid || !dom.proposeInput) return;
    // Если вы уже начали писать сами — не подменяем текст, только отмечаем выбор.
    if (!dom.proposeInput.value.trim()) dom.proposeInput.value = ELEMENTS[id].name;
    setProposeHint('');
    dom.proposeGrid.querySelectorAll('.propose-chip').forEach((chip) => {
      const on = chip.dataset.element === id;
      chip.classList.toggle('is-selected', on);
      chip.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    dom.proposeSave.focus();
  }

  function submitProposal() {
    if (!pendingProposition) return;
    const pairState = pendingProposition;
    const text = dom.proposeInput.value.trim();
    if (!text) {
      setProposeHint('Введите название или выберите элемент из списка.', true);
      dom.proposeInput.focus();
      return;
    }
    const { a, b } = pairState;
    const pair = pairKey(a.id, b.id);

    // Существующий элемент распознаётся без учёта регистра и й/ё.
    const selectedChip = dom.proposeGrid ? dom.proposeGrid.querySelector('.propose-chip.is-selected') : null;
    const matched = selectedChip ? selectedChip.dataset.element : findElementIdByName(text);

    let resultId = matched;
    let isNewElement = false;
    if (!resultId) {
      // Название сохраняется ровно так, как написал игрок; внутренний id — случайный.
      const customKey = makeElementKey();
      ELEMENTS[customKey] = { name: text, emoji: '✨', hue: 280, custom: true };
      ALL_ELEMENT_IDS.push(customKey);
      resultId = customKey;
      isNewElement = true;
    }

    // В версии «все элементы» придуманный элемент сразу появляется в панели.
    if (isNewElement && OPTIONS.startAllUnlocked && !state.discovered.includes(resultId)) {
      state.discovered.push(resultId);
      addSidebarItem(resultId, true);
    }

    proposals = proposals.filter((p) => pairKey(p.a, p.b) !== pair);
    proposals.unshift({
      id: uid(),
      a: a.id,
      b: b.id,
      result: resultId,
      resultName: ELEMENTS[resultId].name,
      originalName: isNewElement ? text : undefined,
      isNew: isNewElement,
      createdAt: Date.now(),
    });
    saveProposals();
    setProposeHint(
      proposalsStorageBroken
        ? 'Рецепт записан, но браузер запретил сохранение — скопируйте его через «Мои рецепты».'
        : `Записано: ${ELEMENTS[a.id].name} + ${ELEMENTS[b.id].name} = ${ELEMENTS[resultId].name}`
    );

    closeProposal();
    const ok = attemptCombine(a, b, 'proposal');
    if (ok) {
      showToast({
        icon: '📝',
        title: 'Ваш рецепт сохранён',
        text: `${ELEMENTS[a.id].name} + ${ELEMENTS[b.id].name} = ${ELEMENTS[resultId].name} · в списке рецептов: ${proposals.length}`,
        tone: 'gold',
        duration: 4000,
        kind: 'proposal',
      });
    }
  }

  function skipProposal() {
    const label = pendingProposition
      ? `${ELEMENTS[pendingProposition.a.id].name} + ${ELEMENTS[pendingProposition.b.id].name} — это остаётся так.`
      : '';
    closeProposal();
    if (label) setProposeHint('');
    playSound('click');
  }

  function applyProposals() {
    if (!proposals.length) return;
    const container = dom.recipesDialog;
    if (container && container.open) container.close();
    proposals
      .slice()
      .sort((x, y) => (x.createdAt || 0) - (y.createdAt || 0))
      .forEach((p) => {
        const rec = customRecipeFor(p.a, p.b);
        if (!rec) return;
        const a = state.board.find((c) => c.id === p.a);
        const b = state.board.find((c) => c.id === p.b && (!a || c.uid !== a.uid));
        if (!a || !b) return;
        attemptCombine(a, b, 'apply');
      });
    showToast({
      icon: '✅',
      title: 'Предложения применены',
      text: `В книге рецептов теперь ${proposals.length} ваших рецептов.`,
      duration: 3200,
    });
    scheduleSave();
  }

  function renderProposals() {
    const list = dom.proposalsList;
    if (!list) return;
    dom.proposalsCount.textContent = String(proposals.length);
    list.innerHTML = '';

    if (!proposals.length) {
      const empty = document.createElement('div');
      empty.className = 'recipes-empty';
      empty.innerHTML =
        '<b>Пока ни одного вашего крафта</b>Соедините пару без рецепта — игра предложит выбрать результат.';
      list.append(empty);
      const inline = dom.proposeList;
      if (inline && inline !== list) {
        inline.innerHTML = '';
        inline.append(empty.cloneNode(true));
      }
      if (dom.proposeCount) dom.proposeCount.textContent = '0';
      return;
    }

    if (dom.proposeCount) dom.proposeCount.textContent = String(proposals.length);

    const ordered = proposals.slice().sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0));

    // Полный список — в окне «Мои рецепты».
    for (const p of ordered) list.append(makeProposalRow(p, () => { renderProposals(); refreshApplyButton(); }));

    // Краткий список — прямо в окне выбора результата (последние 3).
    const inline = dom.proposeList;
    if (inline && inline !== list) {
      inline.innerHTML = '';
      for (const p of ordered.slice(0, 3)) {
        inline.append(makeProposalRow(p, () => { renderProposals(); refreshApplyButton(); }, true));
      }
    }
  }

  function makeProposalRow(p, onChange, compact) {
    const row = document.createElement('div');
    row.className = 'proposal-row';
    row.dataset.search = [ELEMENTS[p.a].name, ELEMENTS[p.b].name, ELEMENTS[p.result].name].join(' ').toLowerCase();

    const chips = document.createElement('div');
    chips.className = 'proposal-row-chips';
    chips.append(makeMiniChip(p.a));
    const plus = document.createElement('span');
    plus.className = 'mini-op';
    plus.textContent = '+';
    const arrow = document.createElement('span');
    arrow.className = 'recipe-arrow';
    arrow.textContent = '→';
    chips.append(plus, makeMiniChip(p.b), arrow, makeMiniChip(p.result));

    const actions = document.createElement('div');
    actions.className = 'proposal-row-actions';

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn btn--tiny';
    copyBtn.textContent = '📋';
    copyBtn.title = 'Скопировать рецепт';
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const text = `${ELEMENTS[p.a].name} + ${ELEMENTS[p.b].name} = ${ELEMENTS[p.result].name}`;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          () => showToast({ icon: '📋', title: 'Рецепт скопирован', text, duration: 2200 }),
          () => showToast({ icon: '📋', title: 'Рецепт', text, duration: 4000 })
        );
      } else {
        showToast({ icon: '📋', title: 'Рецепт', text, duration: 4000 });
      }
    });

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn--tiny';
    delBtn.textContent = '🗑';
    delBtn.title = 'Удалить предложение';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      proposals = proposals.filter((x) => x.id !== p.id);
      saveProposals();
      if (typeof onChange === 'function') onChange();
      showToast({ icon: '🗑', title: 'Предложение удалено', duration: 1800 });
    });

    actions.append(copyBtn);
    if (!compact) actions.append(delBtn);
    row.append(chips, actions);
    return row;
  }

  function confirmTestMarker() {
    const inline = dom.proposeList;
    if (inline && inline !== dom.proposalsList) {
      const count = dom.proposalsList ? dom.proposalsList.querySelectorAll('.proposal-row').length : -1;
      if (inline.dataset.count !== String(count)) inline.dataset.count = String(count);
    }
  }

  function openEditorDialog() {
    if (!dom.editorDialog) return;
    dom.editorSearch.value = '';
    renderEditor();
    if (!dom.editorDialog.open) dom.editorDialog.showModal();
    setTimeout(() => dom.editorSearch && dom.editorSearch.focus(), 60);
  }

  function renderEditor() {
    const rows = dom.editorRows;
    if (!rows) return;
    const query = normName(dom.editorSearch.value);
    rows.innerHTML = '';
    const frag = document.createDocumentFragment();
    let count = 0;

    for (const id of state.discovered) {
      const def = ELEMENTS[id];
      if (!def) continue;
      if (query && !normName(def.name).includes(query) && !normName(id).includes(query)) continue;
      count += 1;

      const row = document.createElement('div');
      row.className = 'editor-row';

      const main = document.createElement('button');
      main.type = 'button';
      main.className = 'editor-main';
      main.dataset.element = id;
      main.title = `Переименовать «${def.name}»`;

      const circle = makeEmojiCircle(id, 'chip-emoji');
      circle.textContent = def.emoji;

      const name = document.createElement('span');
      name.className = 'editor-name';
      name.textContent = def.name;

      main.append(circle, name);

      const note = document.createElement('span');
      note.className = 'editor-note';
      if (def.custom || def.user) note.textContent = 'свой';
      else if (def.renamed) note.textContent = 'изменено';
      if (note.textContent) main.append(note);

      main.addEventListener('click', () => openRenameDialog(id));

      row.append(main);
      frag.append(row);
    }

    if (dom.editorCount) dom.editorCount.textContent = `${count} из ${state.discovered.length}`;
    if (!count) {
      const empty = document.createElement('div');
      empty.className = 'recipes-empty';
      empty.innerHTML = '<b>Ничего не нашлось</b>Попробуйте другой запрос.';
      frag.append(empty);
    }
    rows.append(frag);
  }

  function openProposalsDialog() {
    if (!dom.proposalsDialog) return;
    renderProposals();
    if (!dom.proposalsDialog.open) dom.proposalsDialog.showModal();
  }

  function proposalsAsText() {
    return proposals
      .slice()
      .sort((x, y) => (x.createdAt || 0) - (y.createdAt || 0))
      .map((p) => `${ELEMENTS[p.a].name} + ${ELEMENTS[p.b].name} = ${ELEMENTS[p.result].name}`)
      .join('\n');
  }

  function copyProposals() {
    if (!proposals.length) {
      showToast({ icon: '📝', title: 'Пока нечего копировать', text: 'Сначала предложите пару рецептов.', duration: 2600 });
      return;
    }
    const text = proposalsAsText();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => showToast({ icon: '📋', title: 'Все рецепты скопированы', text: `${proposals.length} строк`, duration: 2600 }),
        () => showToast({ icon: '📋', title: 'Ваши рецепты', text, duration: 6000 })
      );
    } else {
      showToast({ icon: '📋', title: 'Ваши рецепты', text, duration: 6000 });
    }
  }

  /* ---------------- переименование элементов (all.html) ---------------- */

  let renamingId = null;

  /* ---------------- быстрый переименовщик (кнопка ✏️ / Alt+клик) ---------------- */

  // Клавиша переименования на фишке и в панели (только в режиме «выбери сам»).
  let quickRenameId = null;

  function beginQuickRename(id) {
    if (!canRename(id)) {
      showToast({ icon: '🔒', title: 'Это название нельзя менять', text: 'Переименование доступно в версии «все элементы».', duration: 2600 });
      return false;
    }
    endQuickRename(false);
    quickRenameId = id;
    pendingProposition = null;
    renderQuickRename();
    return true;
  }

  function endQuickRename(commit) {
    if (!quickRenameId) return;
    const id = quickRenameId;
    const input = dom.quickRenameInput;
    quickRenameId = null;
    if (commit && input) {
      const value = input.value.trim();
      if (value && ELEMENTS[id]) {
        const def = ELEMENTS[id];
        if (value !== def.name) {
          def.originalName = def.originalName || def.name;
          def.name = value;
          def.renamed = true;
          def.userRenamed = true;
          names[id] = value;
          userRenamedIds.add(id);
          const proposal = proposals.find((p) => p.result === id);
          if (proposal) {
            proposal.resultName = value;
            if (!proposal.originalName) proposal.originalName = def.originalName;
            saveProposals();
          }
          renderSidebar();
          renderProposals();
          refreshChipLabels(id);
          renderRecipes();
          scheduleSave();
        }
      }
    }
    dom.quickRename.hidden = true;
    dom.quickRenameInput.value = '';
  }

  function renderQuickRename() {
    if (!quickRenameId || !ELEMENTS[quickRenameId]) {
      dom.quickRename.hidden = true;
      return;
    }
    dom.quickRename.hidden = false;
    dom.quickRenameInput.value = ELEMENTS[quickRenameId].name;
    dom.quickRenameInput.focus();
    dom.quickRenameInput.select();
  }

  function canRename(id) {
    const def = ELEMENTS[id];
    if (!def) return false;
    if (def.nameLocked) return false;
    // Переименование — только в all-версии; в основной игре это админская функция.
    return Boolean(OPTIONS.startAllUnlocked) && state.discovered.includes(id);
  }

  function refreshChipLabels(id) {
    for (const el of chipEls.values()) {
      if (el.dataset.element !== id) continue;
      const label = el.querySelector('.chip-name');
      if (label) label.textContent = ELEMENTS[id].name;
      const emoji = el.querySelector('.chip-emoji');
      if (emoji) emoji.textContent = ELEMENTS[id].emoji;
      el.title = ELEMENTS[id].name;
    }
  }

  function openRenameDialog(id) {
    if (!dom.renameDialog || !canRename(id)) return;
    renamingId = id;
    dom.renameSubtitle.textContent = `Нынешнее название: «${ELEMENTS[id].name}»`;
    dom.renameInput.value = ELEMENTS[id].name;
    dom.renameEmoji.value = ELEMENTS[id].emoji;
    dom.renameHint.textContent = '';
    dom.renameHint.classList.remove('is-error');
    const def = ELEMENTS[id];
    const proposal = proposals.find((p) => p.result === id);
    const stored = def.originalName || (proposal && (proposal.originalName || proposal.resultName)) || '';
    if (stored && stored !== def.name) {
      dom.renameHint.textContent = `Сохранённое исходное название: «${stored}». Можно вернуть его кнопкой ниже.`;
    }
    if (!dom.renameDialog.open) dom.renameDialog.showModal();
    setTimeout(() => {
      if (!dom.renameDialog.open) return;
      dom.renameInput.focus();
      dom.renameInput.select();
    }, 60);
  }

  function submitRename() {
    if (!renamingId) return;
    const id = renamingId;
    // Название берётся дословно: регистр, знаки и эмодзи не трогаем.
    const name = dom.renameInput.value.trim();
    if (!name) {
      dom.renameHint.textContent = 'Название не может быть пустым.';
      dom.renameHint.classList.add('is-error');
      dom.renameInput.focus();
      return;
    }
    const emoji = dom.renameEmoji.value.trim();
    const def = ELEMENTS[id];
    const renamed = def.name !== name;
    if (def.name === name && (emoji || '') === def.emoji) {
      renamingId = null;
      if (dom.renameDialog.open) dom.renameDialog.close();
      return;
    }
    def.originalName = def.originalName || def.name;
    def.name = name;
    if (emoji) {
      def.emoji = emoji;
    }
    def.renamed = true;
    def.userRenamed = true;
    // Новое имя сохраняется и в настройках all-версии — так оно переживёт перезагрузку.
    names[id] = name;
    userRenamedIds.add(id);

    const proposal = proposals.find((p) => p.result === id);
    if (proposal) {
      proposal.resultName = name;
      if (!proposal.originalName) proposal.originalName = def.originalName;
      saveProposals();
    }

    renamingId = null;
    if (dom.renameDialog.open) dom.renameDialog.close();
    renderSidebar();
    renderProposals();
    refreshChipLabels(id);
    renderRecipes();
    scheduleSave();
    if (renamed) {
      showToast({
        icon: '✏️',
        title: 'Название изменено',
        text: `Теперь элемент называется «${name}»`,
        duration: 2600,
        kind: 'rename',
      });
    }
  }

  function resetRename() {
    if (!renamingId) return;
    const id = renamingId;
    const def = ELEMENTS[id];
    const proposal = proposals.find((p) => p.result === id);
    const candidates = [
      def.originalName,
      proposal && proposal.originalName,
      proposal && proposal.resultName,
      BASE_NAMES[id],
    ];
    let original = '';
    for (const value of candidates) {
      if (!value) continue;
      const tail = elementHashTail(id);
      if (tail && value.endsWith(tail)) continue; // это служебное имя из id
      original = value;
      break;
    }
    dom.renameInput.value = original || def.name;
    dom.renameHint.textContent = original
      ? 'Вернули исходное название — нажмите «Сохранить», чтобы применить.'
      : 'Исходное название не сохранилось — введите его заново, теперь оно сохранится дословно.';
    dom.renameHint.classList.remove('is-error');
  }

  function exportProposals() {
    if (!proposals.length) {
      showToast({ icon: '📝', title: 'Пока нечего экспортировать', duration: 2200 });
      return;
    }
    try {
      const payload = JSON.stringify({ version: 1, items: proposals }, null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = 'infinity-craft-proposals.json';
      link.href = url;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      showToast({ icon: '📤', title: 'Предложения выгружены', text: 'Файл infinity-craft-proposals.json', duration: 3000 });
    } catch {
      showToast({ icon: '⚠️', title: 'Не удалось выгрузить', text: 'Попробуйте ещё раз.', tone: 'error' });
    }
  }

  function setProposalsStatus(text, isError) {
    if (!dom.proposeHint) return;
    dom.proposeHint.textContent = text;
    dom.proposeHint.classList.toggle('is-error', Boolean(isError));
  }

  /* ---------------- перетаскивание ---------------- */

  function startDrag(e) {
    if (drag) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const chip = e.target.closest('.chip');
    if (!chip) return;
    const uid = Number(chip.dataset.uid);
    const data = state.board.find((c) => c.uid === uid);
    if (!data) return;

    const rect = boardRect();
    const centerX = rect.left + data.x * rect.width;
    const centerY = rect.top + data.y * rect.height;

    drag = {
      uid,
      el: chip,
      data,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      grabDX: e.clientX - centerX,
      grabDY: e.clientY - centerY,
      origX: data.x,
      origY: data.y,
      moved: false,
      targetUid: null,
      overPanel: false,
    };

    try {
      chip.setPointerCapture(e.pointerId);
    } catch {
      /* не критично */
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
  }

  function onPointerMove(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;

    if (!drag.moved) {
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (Math.hypot(dx, dy) < 5) return;
      drag.moved = true;
      drag.el.classList.add('is-dragging');
      drag.el.classList.remove('is-selected');
      clearSelection();
      bringToFront(drag.uid);
      playSound('pick');
    }

    const rect = boardRect();
    if (!rect.width || !rect.height) return;

    const centerX = e.clientX - drag.grabDX;
    const centerY = e.clientY - drag.grabDY;
    const pos = clampToBoard(
      (centerX - rect.left) / rect.width,
      (centerY - rect.top) / rect.height,
      drag.el
    );
    drag.data.x = pos.x;
    drag.data.y = pos.y;
    applyChipPosition(drag.el, drag.data);

    const overPanel = pointerInPanel(e.clientX, e.clientY);
    if (overPanel !== drag.overPanel) {
      drag.overPanel = overPanel;
      dom.panel.classList.toggle('is-remove-target', overPanel);
    }

    if (overPanel) {
      if (drag.targetUid !== null) {
        const target = chipEls.get(drag.targetUid);
        if (target) target.classList.remove('is-target');
        drag.targetUid = null;
      }
    } else {
      updateDropTarget();
    }
  }

  function updateDropTarget() {
    if (!drag) return;
    const moving = drag.el.getBoundingClientRect();
    let bestUid = null;
    let bestArea = 0;

    for (const item of state.board) {
      if (item.uid === drag.uid) continue;
      const other = chipEls.get(item.uid);
      if (!other) continue;
      const rect = other.getBoundingClientRect();
      const overlapW = Math.min(moving.right, rect.right) - Math.max(moving.left, rect.left);
      const overlapH = Math.min(moving.bottom, rect.bottom) - Math.max(moving.top, rect.top);
      if (overlapW <= 0 || overlapH <= 0) continue;
      const area = overlapW * overlapH;
      const ratio = area / Math.min(moving.width * moving.height, rect.width * rect.height);
      if (ratio > 0.16 && area > bestArea) {
        bestArea = area;
        bestUid = item.uid;
      }
    }

    if (bestUid !== drag.targetUid) {
      if (drag.targetUid !== null) {
        const prev = chipEls.get(drag.targetUid);
        if (prev) prev.classList.remove('is-target');
      }
      if (bestUid !== null) {
        const next = chipEls.get(bestUid);
        if (next) next.classList.add('is-target');
      }
      drag.targetUid = bestUid;
    }
  }

  function cleanupDrag() {
    if (!drag) return;
    const d = drag;
    drag = null;

    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerCancel);

    d.el.classList.remove('is-dragging');
    dom.panel.classList.remove('is-remove-target');
    if (d.targetUid !== null) {
      const target = chipEls.get(d.targetUid);
      if (target) target.classList.remove('is-target');
    }
    try {
      if (d.el.hasPointerCapture(d.pointerId)) d.el.releasePointerCapture(d.pointerId);
    } catch {
      /* не критично */
    }
  }

  function onPointerUp(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const d = drag;
    const overPanel = pointerInPanel(e.clientX, e.clientY);
    cleanupDrag();

    if (!d.moved) return;
    suppressClickUntil = performance.now() + 400;

    if (overPanel) {
      removeChipToPanel(d);
      return;
    }

    if (d.targetUid !== null) {
      const target = state.board.find((c) => c.uid === d.targetUid);
      if (target) {
        const ok = attemptCombine(d.data, target, 'drag');
        if (ok) return;
        if (OPTIONS.proposeUnknown) {
          openProposal(d.data, target);
          return;
        }
        restorePosition(d.data, d.el, d.origX, d.origY);
        bumpChip(d.el);
        bumpChip(chipEls.get(target.uid));
        playSound('fail');
        notifyFailure();
        return;
      }
    }

    scheduleSave();
  }

  function removeChipToPanel(d) {
    const el = d.el;
    state.board = state.board.filter((c) => c.uid !== d.data.uid);
    chipEls.delete(d.data.uid);
    if (selectedUid === d.data.uid) clearSelection();

    el.classList.remove('is-dragging', 'is-target', 'is-selected');
    el.classList.add('is-removing');
    setTimeout(() => el.remove(), 230);

    updateBoardState();
    playSound('remove');
    scheduleSave();
  }

  function onPointerCancel(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const d = drag;
    cleanupDrag();
    if (d.moved) restorePosition(d.data, d.el, d.origX, d.origY);
  }

  /* ---------------- перетаскивание из панели ---------------- */

  function pointerInBoard(x, y) {
    const rect = boardRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  function pointerToBoardFraction(x, y) {
    const rect = boardRect();
    return {
      x: clamp((x - rect.left) / rect.width, 0, 1),
      y: clamp((y - rect.top) / rect.height, 0, 1),
    };
  }

  function startPanelDrag(e) {
    if (panelDrag) return;
    if (e.pointerType === 'touch') return; // на телефоне элемент добавляется тапом
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const item = e.target.closest('.el-item');
    if (!item) return;
    const id = item.dataset.element;
    if (!ELEMENTS[id]) return;

    panelDrag = {
      item,
      id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
      ghost: null,
      overBoard: false,
    };

    try {
      item.setPointerCapture(e.pointerId);
    } catch {
      /* не критично */
    }

    window.addEventListener('pointermove', onPanelDragMove);
    window.addEventListener('pointerup', onPanelDragUp);
    window.addEventListener('pointercancel', onPanelDragCancel);
  }

  function onPanelDragMove(e) {
    if (!panelDrag || e.pointerId !== panelDrag.pointerId) return;
    const d = panelDrag;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;

    if (!d.active) {
      if (Math.hypot(dx, dy) < 5) return;
      d.active = true;
      d.item.classList.add('is-drag-source');
      document.body.classList.add('is-panel-dragging');
      d.ghost = makeGhostChip(d.id);
      document.body.append(d.ghost);
      playSound('pick');
    }

    d.ghost.style.left = e.clientX + 'px';
    d.ghost.style.top = e.clientY + 'px';

    const over = pointerInBoard(e.clientX, e.clientY);
    if (over !== d.overBoard) {
      d.overBoard = over;
      dom.board.classList.toggle('is-drop-target', over);
    }
  }

  function onPanelDragUp(e) {
    if (!panelDrag || e.pointerId !== panelDrag.pointerId) return;
    const d = panelDrag;
    const over = pointerInBoard(e.clientX, e.clientY);
    finishPanelDrag({ removeGhost: false });

    if (!d.active) {
      if (d.ghost) d.ghost.remove();
      return;
    }

    suppressPanelClickUntil = performance.now() + 400;

    if (over) {
      const spot = pointerToBoardFraction(e.clientX, e.clientY);
      const created = createBoardChip(d.id, spot.x, spot.y, { animate: true });
      if (created) {
        bringToFront(created.uid);
        playSound('add');
        scheduleSave();
      }
      if (d.ghost) d.ghost.remove();
      return;
    }

    // Отпустили вне стола — фишка «улетает» обратно в панель.
    if (d.ghost) {
      const ghost = d.ghost;
      const itemRect = d.item.getBoundingClientRect();
      ghost.style.transition = 'left .22s ease, top .22s ease, opacity .22s ease, transform .22s ease';
      ghost.style.left = itemRect.left + itemRect.width / 2 + 'px';
      ghost.style.top = itemRect.top + itemRect.height / 2 + 'px';
      ghost.style.opacity = '0';
      ghost.style.transform = 'translate(-50%, -50%) scale(0.7)';
      setTimeout(() => ghost.remove(), 260);
    }
  }

  function onPanelDragCancel(e) {
    if (!panelDrag || e.pointerId !== panelDrag.pointerId) return;
    if (panelDrag.active) suppressPanelClickUntil = performance.now() + 400;
    finishPanelDrag();
  }

  function finishPanelDrag(opts) {
    const cfg = Object.assign({ removeGhost: true }, opts);
    const d = panelDrag;
    if (!d) return;
    panelDrag = null;

    window.removeEventListener('pointermove', onPanelDragMove);
    window.removeEventListener('pointerup', onPanelDragUp);
    window.removeEventListener('pointercancel', onPanelDragCancel);

    d.item.classList.remove('is-drag-source');
    document.body.classList.remove('is-panel-dragging');
    dom.board.classList.remove('is-drop-target');
    if (cfg.removeGhost && d.ghost) d.ghost.remove();
    try {
      if (d.item.hasPointerCapture(d.pointerId)) d.item.releasePointerCapture(d.pointerId);
    } catch {
      /* не критично */
    }
  }

  /* ---------------- сохранения ---------------- */

  function snapshot() {
    return {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      discovered: state.discovered.slice(),
      board: state.board.map((c) => ({
        id: c.id,
        x: Number(c.x.toFixed(4)),
        y: Number(c.y.toFixed(4)),
      })),
      foundRecipes: Array.from(foundSet),
      settings: { sound: !!state.settings.sound },
      // Пользовательские названия элементов — только в all-версии.
      ...(OPTIONS.startAllUnlocked ? { names } : {}),
    };
  }

  function setSaveStatus(next, ts) {
    status = next;
    dom.savePill.dataset.state = next;
    if (next === 'saving') {
      dom.saveText.textContent = 'Сохранение…';
      dom.savePill.title = 'Сохраняем игру…';
    } else if (next === 'error') {
      dom.saveText.textContent = 'Не сохранено';
      dom.savePill.title = 'Не удалось сохранить. Попробуйте экспорт из меню.';
    } else {
      const stamp = ts || lastSavedAt;
      dom.saveText.textContent = stamp ? `Сохранено · ${formatTime(stamp)}` : 'Сохранено';
      dom.savePill.title = 'Игра сохранена в браузере. Нажмите, чтобы сохранить сейчас.';
    }
  }

  function saveNow(opts) {
    const cfg = Object.assign({ silent: false }, opts);
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }

    if (storageBroken) {
      setSaveStatus('error');
      if (!cfg.silent) {
        showToast({
          icon: '🔒',
          title: 'Сохранение недоступно',
          text: 'Браузер запретил localStorage. Скачайте резервную копию через меню → «Экспорт».',
          tone: 'error',
          duration: 6000,
        });
      }
      return false;
    }

    try {
      const payload = snapshot();
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
      lastSavedAt = payload.savedAt;
      setSaveStatus('saved', lastSavedAt);
      if (!cfg.silent) {
        showToast({
          icon: '💾',
          title: 'Игра сохранена',
          text: `Локально · ${formatTime(lastSavedAt)}`,
          duration: 2200,
        });
      }
      return true;
    } catch (err) {
      console.warn('Не удалось сохранить:', err);
      setSaveStatus('error');
      if (!cfg.silent) {
        showToast({
          icon: '⚠️',
          title: 'Не удалось сохранить',
          text: 'Проверьте настройки браузера или выгрузите сохранение через меню.',
          tone: 'error',
        });
      }
      return false;
    }
  }

  function scheduleSave() {
    if (storageBroken) {
      setSaveStatus('error');
      return;
    }
    setSaveStatus('saving');
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveNow({ silent: true }), 400);
  }

  function normalizeSave(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('Пустой файл сохранения');

    const discovered = [];
    if (Array.isArray(raw.discovered)) {
      for (const id of raw.discovered) {
        if (typeof id === 'string' && ELEMENTS[id] && !discovered.includes(id)) discovered.push(id);
      }
    }
    for (const id of BASE_ELEMENTS) {
      if (!discovered.includes(id)) discovered.unshift(id);
    }
    // «Все элементы»: база всегда полная.
    if (OPTIONS.startAllUnlocked) {
      for (const id of ALL_ELEMENT_IDS) {
        if (ELEMENTS[id] && !ELEMENTS[id].custom && !discovered.includes(id)) discovered.push(id);
      }
    }
    // Ваши придуманные элементы (из «Мои рецепты») тоже открыты сразу.
    if (OPTIONS.startAllUnlocked && OPTIONS.proposeUnknown) {
      for (const p of proposals) {
        for (const id of [p.a, p.b, p.result]) {
          if (ELEMENTS[id] && ELEMENTS[id].custom && !discovered.includes(id)) discovered.push(id);
        }
      }
    }

    const board = [];
    if (Array.isArray(raw.board)) {
      for (const item of raw.board.slice(0, 150)) {
        if (!item || typeof item !== 'object' || !ELEMENTS[item.id]) continue;
        const x = Number(item.x);
        const y = Number(item.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        board.push({ id: item.id, x: clamp(x, 0, 1), y: clamp(y, 0, 1) });
      }
    }
    for (const item of board) {
      if (!discovered.includes(item.id)) discovered.push(item.id);
    }

    const found = [];
    if (Array.isArray(raw.foundRecipes)) {
      for (const key of raw.foundRecipes) {
        if (typeof key === 'string' && recipeByPair.has(key) && !found.includes(key)) found.push(key);
      }
    }

    // После обновления базы рецептов старые ключи могут указывать на другой
    // результат. Оставляем только те рецепты, чьи результаты уже открыты.
    const validFound = found.filter((key) => ELEMENTS[recipeByPair.get(key).result]);
    const consistentFound = OPTIONS.knownRecipes
      ? recipeList.map((recipe) => recipe.key)
      : validFound.filter((key) => discovered.includes(recipeByPair.get(key).result));

    const savedNames = {};
    if (raw.names && typeof raw.names === 'object') {
      for (const [id, value] of Object.entries(raw.names)) {
        if (ELEMENTS[id] && typeof value === 'string' && value) savedNames[id] = value;
      }
    }

    return {
      discovered,
      board,
      found: consistentFound,
      settings: { sound: !raw.settings || raw.settings.sound !== false },
      savedAt: Number.isFinite(Number(raw.savedAt)) ? Number(raw.savedAt) : null,
      names: savedNames,
    };
  }

  function readSave() {
    let raw = null;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch {
      storageBroken = true;
      return { save: null, error: null };
    }
    if (!raw) return { save: null, error: null };
    try {
      return { save: normalizeSave(JSON.parse(raw)), error: null };
    } catch (err) {
      return { save: null, error: err };
    }
  }

  function clearChipsDom() {
    for (const el of chipEls.values()) el.remove();
    chipEls.clear();
    dom.board.querySelectorAll('.chip').forEach((el) => el.remove());
  }

  function resetTransient() {
    clearSelection();
    drag = null;
    uidCounter = 0;
    zCounter = 10;
  }

  function applySave(save) {
    resetTransient();
    clearChipsDom();
    state.discovered = save.discovered.slice();
    // В версии «все элементы» новые элементы из recipes-user.js должны появиться
    // и в старом сохранении, а не только после сброса. В обычной версии
    // коллекция остаётся такой, какой её оставил игрок.
    if (OPTIONS.startAllUnlocked) {
      for (const id of ALL_ELEMENT_IDS) {
        if (ELEMENTS[id] && !state.discovered.includes(id)) state.discovered.push(id);
      }
    }
    state.board = [];
    foundSet.clear();
    save.found.forEach((key) => foundSet.add(key));
    // Старые автооткрытые элементы из recipes-user.js убираем, если игрок
    // их ещё не скрафтил: сброс и обычная игра должны начинаться с 4 стихий.
    if (!OPTIONS.startAllUnlocked) {
      const crafted = new Set();
      for (const key of foundSet) {
        const recipe = recipeByPair.get(key);
        if (!recipe) continue;
        // Оставляем и результат, и ингредиенты: если элемент уже использовали
        // в крафте, он не должен пропасть из коллекции.
        crafted.add(recipe.result);
        crafted.add(recipe.a);
        crafted.add(recipe.b);
      }
      state.discovered = state.discovered.filter((id) => !ELEMENTS[id]?.user || crafted.has(id));
    }
    if (save.settings) state.settings = { sound: save.settings.sound !== false };
    // Названия элементов, изменённые игроком, — только в all-версии.
    if (OPTIONS.startAllUnlocked && save.names) {
      names = Object.assign({}, names, save.names);
      applyRenamedNames();
    }

    for (const item of save.board) {
      createBoardChip(item.id, item.x, item.y, { animate: false });
    }

    renderSidebar();
    updateStats();
    updateBoardState();
    updateSoundLabel();
    lastSavedAt = save.savedAt || Date.now();
    setSaveStatus('saved', lastSavedAt);
  }

  function startFresh(opts) {
    const cfg = Object.assign({ save: true }, opts);
    resetTransient();
    clearChipsDom();
    state.discovered = OPTIONS.startAllUnlocked ? ALL_ELEMENT_IDS.slice() : BASE_ELEMENTS.slice();
    state.board = [];
    foundSet.clear();
    if (OPTIONS.knownRecipes) recipeList.forEach((recipe) => foundSet.add(recipe.key));
    const seed = (OPTIONS.seedBoard || BASE_ELEMENTS).filter((id) => ELEMENTS[id]);
    const layout = [
      { x: 0.36, y: 0.38 },
      { x: 0.64, y: 0.38 },
      { x: 0.36, y: 0.64 },
      { x: 0.64, y: 0.64 },
    ];
    seed.forEach((id, i) => {
      const spot = layout[i] || { x: 0.2 + Math.random() * 0.6, y: 0.2 + Math.random() * 0.6 };
      createBoardChip(id, spot.x, spot.y, { animate: true });
    });

    renderSidebar();
    updateStats();
    updateBoardState();
    updateSoundLabel();
    lastSavedAt = Date.now();
    setSaveStatus('saved', lastSavedAt);
    if (cfg.save) saveNow({ silent: true });
  }

  /* ---------------- кнопки меню ---------------- */

  function clearBoard() {
    if (state.board.length === 0) {
      showToast({ icon: '🧹', title: 'Стол уже пуст', text: 'Добавьте элементы из панели справа.' });
      return;
    }
    clearSelection();
    clearChipsDom();
    state.board = [];
    updateBoardState();
    updateStats();
    scheduleSave();
    showToast({
      icon: '🧹',
      title: 'Стол очищен',
      text: 'Все открытые элементы остались в коллекции.',
      duration: 2600,
    });
  }

  function resetGame() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* не критично */
    }
    startFresh({ save: false });
    saveNow({ silent: true });
    showToast({
      icon: '♻️',
      title: OPTIONS.startAllUnlocked ? 'Стол сброшен' : 'Прогресс сброшен',
      text: OPTIONS.startAllUnlocked
        ? 'Все элементы по-прежнему открыты — можно начинать заново.'
        : 'Начинаем заново с четырёх стихий.',
      duration: 3000,
    });
  }

  function exportSave() {
    try {
      const payload = JSON.stringify(snapshot(), null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const now = new Date();
      const stamp =
        now.getFullYear() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0') +
        '-' +
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0');
      link.download = `infinity-craft-save-${stamp}.json`;
      link.href = url;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      showToast({
        icon: '📤',
        title: 'Сохранение выгружено',
        text: 'Файл JSON можно импортировать в другом браузере.',
        duration: 3200,
      });
    } catch (err) {
      console.warn(err);
      showToast({ icon: '⚠️', title: 'Не удалось выгрузить', text: 'Попробуйте ещё раз.', tone: 'error' });
    }
  }

  function importSaveFile(file) {
    if (!file) return;
    file
      .text()
      .then((text) => {
        const save = normalizeSave(JSON.parse(text));
        askConfirm({
          icon: '📥',
          title: 'Импортировать сохранение?',
          text: `В файле ${save.discovered.length} ${elementWord(save.discovered.length)} и ${save.found.length} ${recipeWord(
            save.found.length
          )}. Текущий прогресс будет заменён.`,
          confirmLabel: 'Импортировать',
          danger: false,
          onConfirm: () => {
            applySave(save);
            saveNow({ silent: true });
            showToast({
              icon: '✅',
              title: 'Сохранение загружено',
              text: `Элементов: ${state.discovered.length}, рецептов: ${foundSet.size}.`,
              tone: 'gold',
            });
          },
        });
      })
      .catch((err) => {
        console.warn(err);
        showToast({
          icon: '⚠️',
          title: 'Файл не подходит',
          text: 'Нужен JSON-файл, созданный кнопкой «Экспорт сохранения».',
          tone: 'error',
        });
      })
      .finally(() => {
        dom.importFile.value = '';
      });
  }

  function toggleSound() {
    state.settings.sound = !state.settings.sound;
    updateSoundLabel();
    if (state.settings.sound) playSound('click');
    scheduleSave();
  }

  function updateSoundLabel() {
    dom.menuSound.textContent = state.settings.sound ? '🔊 Звук: вкл' : '🔇 Звук: выкл';
  }

  function openMenu() {
    const rect = dom.btnMenu.getBoundingClientRect();
    dom.menu.hidden = false;
    dom.menu.style.top = Math.round(rect.bottom + 8) + 'px';
    dom.menu.style.right = Math.max(10, Math.round(window.innerWidth - rect.right)) + 'px';
    dom.btnMenu.setAttribute('aria-expanded', 'true');
    updateSoundLabel();
  }

  function closeMenu() {
    if (dom.menu.hidden) return;
    dom.menu.hidden = true;
    dom.btnMenu.setAttribute('aria-expanded', 'false');
  }

  /* ---------------- модальные окна ---------------- */

  function openRecipes() {
    dom.recipeSearch.value = '';
    renderRecipes();
    if (!dom.recipesDialog.open) dom.recipesDialog.showModal();
  }

  function renderRecipes() {
    const query = dom.recipeSearch.value.trim().toLowerCase();
    const found = recipeList
      .filter((r) => foundSet.has(r.key))
      .sort((x, y) =>
        ELEMENTS[x.result].name.localeCompare(ELEMENTS[y.result].name, 'ru') ||
        ELEMENTS[x.a].name.localeCompare(ELEMENTS[y.a].name, 'ru')
      );

    dom.recipeList.innerHTML = '';
    let visible = 0;

    const rowFor = (recipe) => {
      const row = document.createElement('div');
      row.className = 'recipe-row';
      row.dataset.search = [
        ELEMENTS[recipe.a].name,
        ELEMENTS[recipe.b].name,
        ELEMENTS[recipe.result].name,
      ]
        .join(' ')
        .toLowerCase();

      const left = makeMiniChip(recipe.a);
      const plus = document.createElement('span');
      plus.className = 'mini-op';
      plus.textContent = '+';
      const right = makeMiniChip(recipe.b);
      const arrow = document.createElement('span');
      arrow.className = 'recipe-arrow';
      arrow.textContent = '→';
      const result = makeMiniChip(recipe.result);

      row.append(left, plus, right, arrow, result);
      return row;
    };

    const appendRow = (recipe) => {
      const row = rowFor(recipe);
      if (query && !row.dataset.search.includes(query)) {
        row.hidden = true;
      } else {
        visible += 1;
      }
      dom.recipeList.append(row);
    };

    // В версии «все элементы» при поиске показываем и ещё не открытые
    // комбинации — так каждый крафт можно найти сразу.
    const notFound = OPTIONS.knownRecipes && query
      ? recipeList.filter((r) => !foundSet.has(r.key))
      : [];

    if (query && notFound.length) {
      const openFor = (list) => {
        for (const recipe of list) appendRow(recipe);
      };
      const matchingNotFound = notFound
        .filter((recipe) =>
          [ELEMENTS[recipe.a].name, ELEMENTS[recipe.b].name, ELEMENTS[recipe.result].name]
            .join(' ')
            .toLowerCase()
            .includes(query)
        )
        .sort((x, y) =>
          ELEMENTS[x.result].name.localeCompare(ELEMENTS[y.result].name, 'ru') ||
          ELEMENTS[x.a].name.localeCompare(ELEMENTS[y.a].name, 'ru')
        );

      openFor(found);

      if (matchingNotFound.length) {
        const divider = document.createElement('p');
        divider.className = 'recipe-divider';
        divider.textContent = `Ещё не открыто: ${matchingNotFound.length}`;
        dom.recipeList.append(divider);
        for (const recipe of matchingNotFound) {
          const row = rowFor(recipe);
          row.classList.add('is-unfound');
          dom.recipeList.append(row);
          visible += 1;
        }
      }
    } else {
      found.forEach(appendRow);
    }

    if (found.length === 0 && visible === 0) {
      const empty = document.createElement('div');
      empty.className = 'recipes-empty';
      empty.innerHTML = '<b>Пока ни одного рецепта</b>Соедините два элемента на столе — и комбинация появится здесь.';
      dom.recipeList.append(empty);
    } else if (visible === 0) {
      const empty = document.createElement('div');
      empty.className = 'recipes-empty';
      empty.innerHTML = '<b>Ничего не нашлось</b>Попробуйте другой запрос.';
      dom.recipeList.append(empty);
    }

    dom.recipesSubtitle.textContent = `${foundSet.size} из ${recipeList.length} ${recipeWord(
      recipeList.length
    )} открыто`;

    const remaining = recipeList.length - foundSet.size;
    if (remaining > 0) {
      dom.recipeCount.textContent = `Ещё ${remaining} ${recipeWord(remaining)} ${plural(
        remaining,
        'ждёт',
        'ждут',
        'ждут'
      )} своего часа`;
    } else {
      dom.recipeCount.textContent = 'Все рецепты открыты — вы настоящий мастер!';
    }
  }

  function askConfirm(opts) {
    const cfg = Object.assign(
      { icon: '⚠️', title: 'Подтвердите действие', text: '', confirmLabel: 'Подтвердить', danger: true, onConfirm: null },
      opts
    );
    dom.confirmIcon.textContent = cfg.icon;
    dom.confirmTitle.textContent = cfg.title;
    dom.confirmText.textContent = cfg.text;
    dom.confirmOk.textContent = cfg.confirmLabel;
    dom.confirmOk.className = 'btn ' + (cfg.danger ? 'btn--danger' : 'btn--primary');

    if (dom.confirmDialog.open) {
      confirmCallback = cfg.onConfirm;
      return;
    }
    confirmCallback = cfg.onConfirm;
    dom.confirmDialog.showModal();
  }

  let confirmCallback = null;

  /* ---------------- события ---------------- */

  function bindEvents() {
    /* панель */
    dom.elementsList.addEventListener('pointerdown', startPanelDrag);

    /* предложение рецепта (all.html) */
    if (OPTIONS.proposeUnknown && dom.proposeDialog) {
      dom.proposeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        submitProposal();
      });

      dom.proposeInput.addEventListener('input', () => {
        setProposeHint('');
        renderSuggestions(dom.proposeInput.value);
      });

      dom.proposeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitProposal();
        }
      });

      dom.proposeGrid.addEventListener('click', (e) => {
        const chip = e.target.closest('.propose-chip');
        if (chip) chooseSuggestion(chip.dataset.element);
      });

      dom.proposeSkip.addEventListener('click', skipProposal);
      dom.proposeApply.addEventListener('click', applyProposals);
      if (dom.proposalsCopy) dom.proposalsCopy.addEventListener('click', copyProposals);
      if (dom.proposalsExport) dom.proposalsExport.addEventListener('click', exportProposals);
    }

    /* переименование (доступно в обеих версиях) */
    if (dom.renameForm) {
      dom.renameForm.addEventListener('submit', (e) => {
        e.preventDefault();
        submitRename();
      });
      dom.renameReset.addEventListener('click', resetRename);
      dom.renameDialog.addEventListener('close', () => {
        renamingId = null;
      });
    }

    if (dom.editorDialog) {
      dom.editorSearch.addEventListener('input', renderEditor);
    }

    if (dom.quickRename) {
      dom.quickRename.addEventListener('submit', (e) => {
        e.preventDefault();
        endQuickRename(true);
      });
      dom.quickRenameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          endQuickRename(false);
        }
      });
      const quickCancel = document.getElementById('quickRenameCancel');
      if (quickCancel) quickCancel.addEventListener('click', () => endQuickRename(false));
    }

    if (dom.btnEditor) dom.btnEditor.addEventListener('click', openEditorDialog);

    if (dom.proposeDialog) {
      dom.proposeDialog.addEventListener('close', () => {
        pendingProposition = null;
        clearSelection();
      });
    }

    if (dom.proposalsDialog) {
      dom.proposalsDialog.addEventListener('close', () => {
        dom.btnMenu.focus({ preventScroll: true });
      });
    }

    dom.elementsList.addEventListener('click', (e) => {
      if (performance.now() < suppressPanelClickUntil) return;
      const item = e.target.closest('.el-item');
      if (!item) return;
      const renameHit = e.target.closest('[data-rename]');
      if (renameHit) {
        e.stopPropagation();
        openRenameDialog(renameHit.dataset.rename);
        return;
      }
      const id = item.dataset.element;
      if (id) addFromPanel(id);
    });

    dom.searchInput.addEventListener('input', applyFilter);

    /* стол */
    dom.board.addEventListener('pointerdown', startDrag);

    dom.board.addEventListener('click', (e) => {
      if (performance.now() < suppressClickUntil) return;
      const renameHit = e.target.closest('[data-rename]');
      if (renameHit) {
        e.stopPropagation();
        clearSelection();
        openRenameDialog(renameHit.dataset.rename);
        return;
      }
      const chip = e.target.closest('.chip');
      if (!chip) {
        clearSelection();
        return;
      }
      const uid = Number(chip.dataset.uid);
      if (uid) selectChip(uid);
    });

    /* кнопки */
    dom.btnRecipes.addEventListener('click', openRecipes);
    dom.btnClear.addEventListener('click', () => {
      if (!state.board.length) {
        showToast({ icon: '🧹', title: 'Стол уже пуст', text: 'Добавьте элементы из панели справа.' });
        return;
      }
      askConfirm({
        icon: '🧹',
        title: 'Очистить стол?',
        text: 'Элементы на столе исчезнут, но останутся в коллекции. Открытые рецепты сохранятся.',
        confirmLabel: 'Очистить',
        danger: false,
        onConfirm: clearBoard,
      });
    });

    dom.savePill.addEventListener('click', () => saveNow());

    /* меню */
    dom.btnMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      if (dom.menu.hidden) openMenu();
      else closeMenu();
    });

    dom.menu.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      closeMenu();
      switch (action) {
        case 'save':
          saveNow();
          break;
        case 'export':
          exportSave();
          break;
        case 'import':
          dom.importFile.value = '';
          dom.importFile.click();
          break;
        case 'sound':
          toggleSound();
          break;
        case 'proposals':
          openProposalsDialog();
          break;
        case 'editor':
          openEditorDialog();
          break;
        case 'clear':
          dom.btnClear.click();
          break;
        case 'reset':
          askConfirm({
            icon: '♻️',
            title: 'Сбросить весь прогресс?',
            text: 'Все открытые элементы, рецепты и элементы на столе будут удалены. Это действие нельзя отменить.',
            confirmLabel: 'Сбросить всё',
            danger: true,
            onConfirm: resetGame,
          });
          break;
        default:
          break;
      }
    });

    document.addEventListener('click', (e) => {
      if (dom.menu.hidden) return;
      if (dom.menu.contains(e.target) || dom.btnMenu.contains(e.target)) return;
      closeMenu();
    });

    window.addEventListener('resize', closeMenu);

    /* модальные окна */
    document.querySelectorAll('[data-close]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dialog = btn.closest('dialog');
        if (dialog) dialog.close();
      });
    });

    document.querySelectorAll('dialog').forEach((dialog) => {
      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) dialog.close();
      });
    });

    dom.recipesDialog.addEventListener('close', () => {
      dom.btnRecipes.focus({ preventScroll: true });
    });

    dom.confirmDialog.addEventListener('close', () => {
      confirmCallback = null;
    });

    dom.confirmOk.addEventListener('click', () => {
      const cb = confirmCallback;
      confirmCallback = null;
      dom.confirmDialog.close();
      if (typeof cb === 'function') cb();
    });

    dom.confirmCancel.addEventListener('click', () => {
      confirmCallback = null;
      dom.confirmDialog.close();
    });

    dom.recipeSearch.addEventListener('input', renderRecipes);

    /* импорт */
    dom.importFile.addEventListener('change', () => {
      const file = dom.importFile.files && dom.importFile.files[0];
      importSaveFile(file);
    });

    /* клавиатура */
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (panelDrag) {
          suppressPanelClickUntil = performance.now() + 400;
          finishPanelDrag();
          return;
        }
        if (drag) {
          const d = drag;
          cleanupDrag();
          if (d.moved) restorePosition(d.data, d.el, d.origX, d.origY);
          return;
        }
        closeMenu();
        clearSelection();
        return;
      }

      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = document.activeElement && document.activeElement.tagName;
        const inDialog = document.querySelector('dialog[open]');
        if (inDialog) return;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        dom.searchInput.focus();
      }
    });

    /* сохранение при уходе */
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !storageBroken) saveNow({ silent: true });
    });

    window.addEventListener('beforeunload', () => {
      if (storageBroken) return;
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot()));
      } catch {
        /* не критично */
      }
    });

    /* пересчёт позиций */
    let resizeRaf = null;
    const onResize = () => {
      if (resizeRaf) return;
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = null;
        clampAllChips(true);
      });
    };
    if ('ResizeObserver' in window) {
      new ResizeObserver(onResize).observe(dom.board);
    } else {
      window.addEventListener('resize', onResize);
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => clampAllChips(false)).catch(() => {});
    }
  }

  /* ---------------- запуск ---------------- */

  function boot() {
    try {
      localStorage.setItem('__infinity_craft_probe__', '1');
      localStorage.removeItem('__infinity_craft_probe__');
    } catch {
      storageBroken = true;
    }

    bindEvents();

    const { save, error } = readSave();

    if (save) {
      applySave(save);
      setSaveStatus('saved', save.savedAt);
    } else {
      startFresh({ save: !storageBroken });
      setSaveStatus(storageBroken ? 'error' : 'saved', lastSavedAt);
    }

    updateStats();
    updateBoardState();
    updateSoundLabel();

    requestAnimationFrame(() => clampAllChips(false));

    if (storageBroken) {
      setTimeout(() => {
        showToast({
          icon: '🔒',
          title: 'Сохранения отключены',
          text: 'Браузер не разрешил localStorage. Прогресс можно сохранить вручную через меню → «Экспорт».',
          tone: 'error',
          duration: 7000,
        });
      }, 700);
    } else if (error) {
      setTimeout(() => {
        showToast({
          icon: '⚠️',
          title: 'Сохранение не прочиталось',
          text: 'Похоже, файл в браузере повреждён. Начали новую игру — старое сохранение заменено.',
          tone: 'error',
          duration: 6000,
        });
      }, 600);
    } else if (!save) {
      setTimeout(() => {
        showToast(
          OPTIONS.startAllUnlocked
            ? {
                icon: '🎁',
                title: 'Здесь открыто всё!',
                text: `Все ${ELEMENT_IDS.length} элементов и ${recipeList.length} рецептов доступны сразу. Перетаскивайте и экспериментируйте.`,
                duration: 6500,
              }
            : {
                icon: '👋',
                title: 'Добро пожаловать в мастерскую!',
                text: 'Перетащите Огонь на Воду — получится Пар. Или выберите два элемента по очереди.',
                duration: 6500,
              }
        );
      }, 800);
    }

    if (new URLSearchParams(location.search).has('debug')) {
      window.__infinityCraft = {
        getState() {
          return {
            discovered: state.discovered.slice(),
            board: state.board.map((c) => ({ uid: c.uid, id: c.id, x: c.x, y: c.y })),
            found: Array.from(foundSet),
            options: OPTIONS,
            savedAt: lastSavedAt,
            status,
            settings: { ...state.settings },
            totals: { elements: ALL_ELEMENT_IDS.length, recipes: recipeList.length },
            proposals: proposals.length,
            storageBroken,
            proposalsStorageBroken,
            dialogOpen: dom.proposeDialog ? dom.proposeDialog.open : false,
            panelItems: document.querySelectorAll('.el-item').length,
          };
        },
        add(id) {
          addFromPanel(id);
          return state.board.length;
        },
        combineByElement(a, b) {
          const first = state.board.find((c) => c.id === a);
          const second = state.board.find((c) => c.id === b && c !== first);
          if (!first || !second) return false;
          return attemptCombine(first, second, 'debug');
        },
        save() {
          return saveNow({ silent: true });
        },
        // ── режим предложений (all.html) ──
        proposals() {
          return proposals.map((p) => ({ ...p }));
        },
        proposePair(aId, bId) {
          const a = state.board.find((c) => c.id === aId);
          const b = state.board.find((c) => c.id === bId && c !== a);
          if (!a || !b) return null;
          openProposal(a, b);
          return !!pendingProposition;
        },
        proposeText() {
          return dom.proposeInput ? dom.proposeInput.value : '';
        },
        submitProposal() {
          submitProposal();
          return proposals.map((p) => ({ ...p }));
        },
        skipProposal,
        applyProposals,
        openProposalsDialog,
        customElements() {
          return ALL_ELEMENT_IDS.filter((id) => ELEMENTS[id] && ELEMENTS[id].custom);
        },
        rename(id, name) {
          if (!canRename(id)) return false;
          openRenameDialog(id);
          dom.renameInput.value = name;
          submitRename();
          return ELEMENTS[id] ? ELEMENTS[id].name : null;
        },
        names() {
          const out = {};
          for (const id of state.discovered) out[id] = ELEMENTS[id] ? ELEMENTS[id].name : '';
          return out;
        },
        openEditorDialog,
        canRename,
        exportProposals() {
          // Возвращает текст, который нужно вставить в recipes.js.
          const customIds = [...new Set(
            ALL_ELEMENT_IDS.filter(
              (id) =>
                ELEMENTS[id] &&
                ELEMENTS[id].custom &&
                proposals.some((p) => p.a === id || p.b === id || p.result === id)
            )
          )];
          return {
            elements: customIds.map((id) => {
              const def = ELEMENTS[id];
              return `${id.slice(id.indexOf(':') + 1)}: { name: ${JSON.stringify(def.name)}, emoji: ${JSON.stringify(def.emoji)}, hue: ${def.hue} },`;
            }),
            recipes: proposals.map((p) => `['${p.a}', '${p.b}', '${p.result}'],`),
            pairs: proposals.map((p) => `${ELEMENTS[p.a].name} + ${ELEMENTS[p.b].name} = ${ELEMENTS[p.result].name}`),
          };
        },
      };
    }
  }

  // Загрузка предложенных рецептов (только в режиме «выбери сам»).
  function bootWithProposals() {
    proposals = loadProposals();
    renames = (window.CRAFT_EXTRAS && window.CRAFT_EXTRAS.renames) || {};
    applyRenamedNames();
    boot();
    // Починенные старые имена не пересохраняем: они каждый раз восстанавливаются
    // из resultName/originalName, чтобы не затереть регистр и знаки.
  }

  bootWithProposals();
})();

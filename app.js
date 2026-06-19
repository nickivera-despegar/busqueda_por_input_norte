/* ============================================================
   Caja de búsqueda · Explorador de flujo
   Hybrid prototype: PNG-backed screens + a live Search screen.
   State machine + control panel (persisted to URL + localStorage).
   ============================================================ */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------------- state ---------------- */
const state = {
  screen: 'home',                 // home | voos | search | result
  userType: 'new',                // new | returning   -> Voos box img
  resultOption: '1',              // 1 | 2 | 3
  opt1Variant: '1a',              // 1a | 1b-current | 1b-new
};


const NOTES = {
  '1': {
    title: 'Opción 1 — Resultado inmediato',
    pro: 'Cero fricción para el usuario.',
    con: 'Tiempos de carga (search) + sensación de falta de control. No acompaña al usuario en articular su búsqueda (barrera de articulación de la IA).',
  },
  '2': {
    title: 'Opción 2 — Caja de búsqueda',
    pro: 'Acompaña al usuario en articular su deseo.',
    con: "Se pierde la 'magia' de la búsqueda inmediata.",
  },
  '3': {
    title: 'Opción 3 — Landing multiproducto',
    pro: 'Alineada con la idea de un usuario indefinido.',
    con: 'Mismas debilidades que las landings (ofertas cacheadas) + esta landing hoy no existe.',
  },
};

/* ---------------- persistence ---------------- */
function loadState(){
  try {
    const ls = JSON.parse(localStorage.getItem('sbflow') || '{}');
    Object.assign(state, ls);
  } catch (_) {}
  const p = new URLSearchParams(location.search);
  if (p.get('u'))   state.userType     = p.get('u');
  if (p.get('r'))   state.resultOption = p.get('r');
  if (p.get('v'))   state.opt1Variant  = p.get('v');
  state.screen = 'home'; // always start at home on load
}
function saveState(){
  const persist = {
    userType: state.userType,
    resultOption: state.resultOption,
    opt1Variant: state.opt1Variant,
  };
  localStorage.setItem('sbflow', JSON.stringify(persist));
  const p = new URLSearchParams();
  p.set('u', state.userType);
  p.set('r', state.resultOption);
  p.set('v', state.opt1Variant);
  history.replaceState(null, '', '?' + p.toString());
}

/* ---------------- screen navigation ---------------- */
function showScreen(name){
  state.screen = name;
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + name));

  if (name === 'voos')   syncVoos();
  if (name === 'result') syncResult();
  if (name === 'search') openSearch();
  else if (name !== 'search') resetSearchInput();
  if (name === 'home'){ const s = $('#homeScroll'); s.scrollTop = 0; $('#homeHeader').classList.remove('shrunk'); }
  if (name !== 'result' && sofiaRotTimer){ clearInterval(sofiaRotTimer); sofiaRotTimer = null; }

  syncNotes();
}

function syncVoos(){
  $('#screen-voos').innerHTML = vboxHTML(state.userType === 'returning' ? 'returning' : 'new');
}
function syncResult(){
  const key = resultOverride || (state.resultOption === '1' ? '1:' + state.opt1Variant : state.resultOption);
  const render = {
    '1:1a':         flightListHTML,
    '1:1b-current': landingActualHTML,
    '1:1b-new':     landingNuevaHTML,
    '2':            () => vboxHTML('paris'),
    '3':            multiproductHTML,
  }[key];
  $('#screen-result').innerHTML = render ? render() : '';
  startSofiaRotator();   // (re)start the rotating prompt if that screen rendered one
}
function syncNotes(){
  const el = $('#notes');
  if (state.screen !== 'result'){ el.classList.remove('show'); el.setAttribute('aria-hidden','true'); return; }
  const opt = resultOverride ? (resultOverride.charAt(0) === '1' ? '1' : resultOverride) : state.resultOption;
  const n = NOTES[opt];
  $('#notesEyebrow').textContent = 'Opción ' + opt;
  $('#notesTitle').textContent   = n.title;
  $('#notesPro').textContent     = n.pro;
  $('#notesCon').textContent     = n.con;
  el.classList.add('show'); el.setAttribute('aria-hidden','false');
}

/* ============================================================
   LIVE SEARCH SCREEN
   ============================================================ */
const DESTINATIONS = [
  { city:'Paris',          country:'Francia',        code:'PAR', tag:'Arte, cafés y la Torre Eiffel' },
  { city:'Paracas',        country:'Perú',           code:'PCS', tag:'Reserva natural frente al mar' },
  { city:'Paraty',         country:'Brasil',         code:'PTY', tag:'Pueblo colonial junto al mar' },
  { city:'Asunción',       country:'Paraguay',       code:'ASU', tag:'Capital a orillas del río' },
  { city:'Parma',          country:'Italia',         code:'PMF', tag:'Cuna del queso y el jamón' },
  { city:'Paramaribo',     country:'Surinam',        code:'PBM', tag:'Caribe y herencia colonial' },
  { city:'Pärnu',          country:'Estonia',        code:'EPU', tag:'Playas y spas del Báltico' },
  { city:'Paros',          country:'Grecia',         code:'PAS', tag:'Islas Cícladas y mar Egeo' },
  { city:'Parnaíba',       country:'Brasil',         code:'PHB', tag:'Delta y dunas del nordeste' },
  { city:'Pardubice',      country:'Chequia',        code:'PED', tag:'Castillo y pan de jengibre' },
  { city:'Madrid',         country:'España',         code:'MAD', tag:'Movida, tapas y museos' },
  { city:'Barcelona',      country:'España',         code:'BCN', tag:'Gaudí, playa y ramblas' },
  { city:'Río de Janeiro', country:'Brasil',         code:'RIO', tag:'Playa, samba y Cristo Redentor' },
  { city:'São Paulo',      country:'Brasil',         code:'SAO', tag:'Gastronomía y vida urbana' },
  { city:'Recife',         country:'Brasil',         code:'REC', tag:'Arrecifes y cultura nordestina' },
  { city:'Cancún',         country:'México',         code:'CUN', tag:'Caribe turquesa y resorts' },
  { city:'Roma',           country:'Italia',         code:'ROM', tag:'Historia milenaria y pasta' },
  { city:'Lisboa',         country:'Portugal',       code:'LIS', tag:'Fados, miradouros y tranvías' },
  { city:'Buenos Aires',   country:'Argentina',      code:'BUE', tag:'Tango, bohemia y parrillas' },
  { city:'Miami',          country:'Estados Unidos', code:'MIA', tag:'Playa, compras y vida nocturna' },
];
let selectedDest = DESTINATIONS[0];                       // (e) drives the result screens
function resolveDest(q){
  const nq = norm(q || '');
  return DESTINATIONS.find(x => norm(`${x.city}, ${x.country}`) === nq)
      || DESTINATIONS.find(x => nq.includes(norm(x.city)))
      || DESTINATIONS[0];
}
const destPhoto = d => ph(DESTINATIONS.indexOf(d));        // deterministic photo per city

// SOFIA suggestion cards per state
const SOFIA_EMPTY = [
  { h:'Itinerario para Bariloche', p:'4 días por la Patagonia' },
  { h:'Escapadas de finde', p:'Alojamientos cerca de ti' },
];
const SOFIA_TYPING = [
  { h:'Ofertas de vuelos a Europa', p:'Francia, España y más' },
  { h:'Qué hacer en Paris', p:'Descubrí actividades únicas' },
];

let query = '';

const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

function highlight(text, q){
  if (!q) return escapeHtml(text);
  const chars = [...text];
  const hay = chars.map(norm).join('');
  const nq = norm(q);
  const i = hay.indexOf(nq);
  if (i < 0) return escapeHtml(text);
  const a = chars.slice(0, i).join('');
  const b = chars.slice(i, i + nq.length).join('');
  const c = chars.slice(i + nq.length).join('');
  return escapeHtml(a) + '<span class="hl">' + escapeHtml(b) + '</span>' + escapeHtml(c);
}
function escapeHtml(s){ return s.replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[m])); }

/* icons */
const IC = {
  city:  '<svg class="ic" viewBox="0 0 24 24"><rect x="4" y="3" width="9" height="18"/><path d="M16 9h4v12h-4M7 7h2M7 11h2M7 15h2"/></svg>',
  globe: '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14 0 18M12 3c-3 3.5-3 14 0 18"/></svg>',
  bed:   '<svg class="ic" viewBox="0 0 24 24"><path d="M3 18v-6h18v6M3 12V8h11v4M21 12v-1a3 3 0 00-3-3M3 18v2M21 18v2"/></svg>',
  bag:   '<svg class="ic" viewBox="0 0 24 24"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M9 8V6a2 2 0 012-2h2a2 2 0 012 2v2"/></svg>',
  plane: '<svg class="ic" viewBox="0 0 24 24"><path d="M21 13.5l-8-2.2V5a1.5 1.5 0 00-3 0v6.3l-8 2.2V16l8-1.3V19l-2 1.3V22l3.5-1 3.5 1v-1.7L13 19v-4.3l8 1.3z"/></svg>',
};

const SPARK_SVG = '<svg viewBox="0 0 24 24"><path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8z"/></svg>';
const ARROW_SVG = '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const sbCardHTML = (h, p) => `<div class="sb-card">
  <div class="c-spark">${SPARK_SVG}</div><svg class="c-arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
  <h4>${escapeHtml(h)}</h4><p>${escapeHtml(p)}</p></div>`;
// (c) live "mirror" card: echoes the typed text, opens SOFIA with it
const mirrorCardHTML = q => `<button class="sb-card mirror" data-action="sofia-prompt">
  <div class="c-spark">${SPARK_SVG}</div><svg class="c-arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
  <h4 class="mirror-q">${escapeHtml(q)}</h4><p>Preguntar a SOFIA</p></button>`;

function renderSearch(){
  // (b) once a specific destination is picked → "all about SOFIA": one tile grid of bubbles
  const picked = query && DESTINATIONS.find(d => norm(`${d.city}, ${d.country}`) === norm(query));
  if (picked){
    $('#sbSofiaLabel').textContent = 'Armá tu viaje con SOFIA';
    $('#sbCards').style.display = 'none';            // the horizontal bubble row is replaced by the grid
    $('#sbList').innerHTML = sofiaGridHTML(picked.city);
    return;
  }
  $('#sbCards').style.display = '';
  $('#sbSofiaLabel').textContent = query ? '¿Dudas? Preguntale a SOFIA' : 'Preguntale a SOFIA';
  const cards = query ? SOFIA_TYPING : SOFIA_EMPTY;
  $('#sbCards').innerHTML =
    (query ? mirrorCardHTML(query) : '') + cards.map(c => sbCardHTML(c.h, c.p)).join('');

  if (!query){ renderEmptyList(); return; }
  renderTypingList();
}

// returning user's last searches (consistent with the returning-user Voos prefill)
const RECENTS = [
  { ic:IC.plane, main:'Cancún, México',          sub:'15 jul · 30 jul' },
  { ic:IC.bed,   main:'Río de Janeiro, Brasil',  sub:'10 sept · 15 sept' },
  { ic:IC.bag,   main:'Buenos Aires, Argentina', sub:'2 nov · 9 nov' },
];

function renderEmptyList(){
  $('#sbListLabel').textContent = '';   // section headings live inside #sbList now
  let html = '';

  // Only a returning user has history to show
  if (state.userType === 'returning'){
    html += '<div class="sb-subhead">Vistos recientemente</div>';
    html += '<div class="sb-recents">' + RECENTS.map(r => `
      <button class="sb-recent" data-fill="${escapeHtml(r.main)}">
        <span class="rc-ic">${r.ic}</span>
        <span class="rc-main"><b>${r.main}</b><span class="r-sub">${r.sub}</span></span>
      </button>`).join('') + '</div>';
  }

  html += '<div class="sb-subhead">¿No sabés dónde ir?</div>';
  html += [
    ['Río de Janeiro','🏖️'], ['São Paulo','🌆'], ['Buenos Aires','🌅'],
    ['Cancún','🏝️'], ['Madrid','🏛️'], ['Barcelona','⛪'],
    ['Lisboa','🚋'], ['Roma','🏟️'], ['Miami','🌴'],
  ].map(([city, thumb]) => {
    const d = DESTINATIONS.find(x => x.city === city); if (!d) return '';
    const full = `${d.city}, ${d.country}`;
    return `<button class="sb-row" data-fill="${escapeHtml(full)}"><span class="thumb">${thumb}</span><span class="r-main"><span>${escapeHtml(full)}</span><span class="r-sub">${escapeHtml(d.tag)}</span></span></button>`;
  }).join('');

  $('#sbList').innerHTML = html;
}

function renderTypingList(){
  $('#sbListLabel').textContent = '';
  // (a) only cities (no product rows), up to 10 — clicking one fills the input
  const matches = DESTINATIONS
    .filter(d => norm(d.city).includes(norm(query)) || norm(d.country).includes(norm(query)))
    .slice(0, 10);
  $('#sbList').innerHTML = matches.map(d => `
    <button class="sb-row" data-fill="${escapeHtml(d.city + ', ' + d.country)}">
      ${IC.city}
      <span class="r-main"><span>${highlight(d.city, query)}, ${highlight(d.country, query)}</span></span>
    </button>`).join('');
}

/* (b) "all about SOFIA" tile grid shown after a city is selected — 2-col masonry, all visible */
function sofiaGridHTML(city){
  const tile = ({ mirror, text, prompt, h }) => {
    const body = mirror
      ? `<span class="sg-q">${escapeHtml(query)}</span><span class="sg-kick">Preguntar a SOFIA</span>`
      : `<span class="sg-txt">${escapeHtml(text)}</span>`;
    const act = mirror ? 'data-action="sofia-prompt"'
                       : `data-action="sofia-prompt-text" data-prompt="${escapeHtml(prompt)}"`;
    return `<button class="sg-tile" ${act} style="min-height:${h}px"><span class="sg-spark">${SPARK_SVG}</span><span class="sg-body">${body}</span></button>`;
  };
  const tMirror = tile({ mirror:true, h:100 });
  const tA = tile({ text:`¿Qué hacer en ${city}?`,                  prompt:`¿Qué hacer en ${city}?`,                       h:130 });
  const tB = tile({ text:`Mejor época para viajar a ${city}`,        prompt:`¿Cuál es la mejor época para viajar a ${city}?`, h:92  });
  const tC = tile({ text:`Armá un itinerario de 5 días en ${city}`,  prompt:`Armá un itinerario de 5 días en ${city}`,        h:140 });
  const tD = tile({ text:`¿Cuánto sale viajar a ${city}?`,           prompt:`¿Cuánto sale un viaje a ${city}?`,              h:104 });
  return `<div class="sgrid">
    <div class="sgrid-col">${tMirror}${tB}${tD}</div>
    <div class="sgrid-col">${tA}${tC}</div>
  </div>`;
}

/* input handling */
function setQuery(q){
  query = q;
  $('#sbText').textContent = q;
  $('.sb-input').classList.toggle('has-text', q.length > 0);
  $('#sbBuscar').classList.toggle('enabled', q.length > 0);
  $('#sbBuscar').disabled = q.length === 0;
  renderSearch();
  // (a) keep the END of the text (and caret) visible as it grows past the input width
  const f = $('#sbField'); if (f) f.scrollLeft = f.scrollWidth;
}
function resetSearchInput(){ query = ''; }

function showKbd(show){
  $('#kbd').classList.toggle('kbd-hidden', !show);
  // when shown, pad the list so it can scroll above the keyboard; when hidden, let it fill the screen
  $('#sbScroll').style.paddingBottom = show ? ($('#kbd').offsetHeight + 'px') : '16px';
}
function openSearch(){
  setQuery('');                       // empty state
  $('#sbScroll').scrollTop = 0;
  showKbd(true);                      // keyboard visible on entry
}

/* natural-language: "Vuelos a Paris en verano" → caja de búsqueda (Jun–Ago) */
function recognizeParisVerano(q){
  const n = norm(q || '');
  return n.includes('paris') && (n.includes('veran') || /(junio|julio|agosto)/.test(n));
}
function goParisVerano(){
  resetBoxFlow();
  selectedDest = DESTINATIONS[0];       // Paris
  parisBox.mesLabel = 'Junio, Julio, Agosto';
  resultOverride = '2';                 // Opción 2 — caja de búsqueda
  showScreen('result');
}
/* submit from the search input (Buscar / Enter / keyboard go) */
function submitSearch(){
  if (!query) return;
  if (recognizeParisVerano(query)) goParisVerano();
  else { resetBoxFlow(); selectedDest = resolveDest(query); showScreen('result'); }
}

/* clicks inside the search list */
function onListClick(e){
  const row = e.target.closest('.sb-row, .sb-recent');
  if (!row) return;
  // (e) clicking a destination/recent fills the input (then they can Buscar or tap to keep editing)
  if (row.dataset.fill){ setQuery(row.dataset.fill); showKbd(false); $('#sbScroll').scrollTop = 0; return; }
  // product rows etc. stay decorative — gentle shake to show it's a mock
  row.classList.remove('shake'); void row.offsetWidth; row.classList.add('shake');
}

/* ---------------- on-screen keyboard ---------------- */
const KB_ROWS = [
  ['1','2','3','4','5','6','7','8','9','0'],
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['shift','Z','X','C','V','B','N','M','back'],
  ['?123',',','space','.','go'],
];
function buildKeyboard(){
  const kbd = $('#kbd');
  kbd.innerHTML = '';
  KB_ROWS.forEach(row => {
    const r = document.createElement('div'); r.className = 'kbd-row';
    row.forEach(k => {
      const b = document.createElement('button');
      if (k === 'shift'){ b.className='key wide'; b.innerHTML='<svg viewBox="0 0 24 24"><path d="M12 4l7 8h-4v6H9v-6H5z"/></svg>'; }
      else if (k === 'back'){ b.className='key wide'; b.innerHTML='<svg viewBox="0 0 24 24"><path d="M20 5H8L2 12l6 7h12V5zM11 9l6 6M17 9l-6 6"/></svg>'; b.dataset.k='back'; }
      else if (k === 'space'){ b.className='key space'; b.textContent='EN • LV'; b.dataset.k=' '; }
      else if (k === '?123'){ b.className='key wide'; b.textContent='?123'; }
      else if (k === 'go'){ b.className='key gobtn'; b.innerHTML='<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>'; b.dataset.k='go'; }
      else { b.className='key'; b.textContent=k; b.dataset.k=k.toLowerCase(); }
      r.appendChild(b);
    });
    kbd.appendChild(r);
  });
  kbd.addEventListener('click', e => {
    const b = e.target.closest('.key'); if (!b) return;
    const k = b.dataset.k;
    if (k === undefined) return;            // shift / ?123 = decorative
    if (k === 'back')      setQuery(query.slice(0, -1));
    else if (k === 'go')   { submitSearch(); }
    else                   setQuery(query + (k === ' ' ? ' ' : k));
  });
}

/* physical keyboard while on search screen */
document.addEventListener('keydown', e => {
  if (state.screen !== 'search') return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;          // let browser shortcuts through
  if (e.key === 'Backspace'){ e.preventDefault(); setQuery(query.slice(0,-1)); }
  else if (e.key === 'Enter'){ e.preventDefault(); submitSearch(); }
  else if (e.key === 'Escape'){ showScreen('home'); }
  else if (e.key.length === 1){ e.preventDefault(); setQuery(query + e.key); }  // incl. Space — preventDefault so it types instead of scrolling / activating a focused button
});

/* ============================================================
   CONTROL PANEL
   ============================================================ */
function syncPanelUI(){
  $$('.seg[data-seg="userType"] button').forEach(b =>
    b.classList.toggle('active', b.dataset.val === state.userType));
  $$('.radio-list .radio').forEach(r =>
    r.classList.toggle('active', r.dataset.val === state.resultOption));
  $('#subpicker').classList.toggle('show', state.resultOption === '1');
  $$('#subpicker button').forEach(b =>
    b.classList.toggle('active', b.dataset.val === state.opt1Variant));
}

function initPanel(){
  $('#panelFab').addEventListener('click', () => {
    $('#panel').classList.add('open');
    $('#panelFab').classList.add('hidden');
  });
  $('#panelClose').addEventListener('click', () => {
    $('#panel').classList.remove('open');
    $('#panelFab').classList.remove('hidden');
  });

  // user type
  $$('.seg[data-seg="userType"] button').forEach(b => b.addEventListener('click', () => {
    state.userType = b.dataset.val; syncPanelUI(); saveState();
    if (state.screen === 'voos')   syncVoos();      // apply in place
    if (state.screen === 'search') renderSearch();  // recents depend on user type
  }));

  // result option
  $$('.radio-list .radio').forEach(r => r.addEventListener('click', () => {
    resultOverride = null; state.resultOption = r.dataset.val; syncPanelUI(); saveState();
    if (state.screen === 'result'){ syncResult(); syncNotes(); }
  }));

  // option-1 sub variant
  $$('#subpicker button').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation();
    resultOverride = null;
    state.opt1Variant = b.dataset.val;
    state.resultOption = '1';
    syncPanelUI(); saveState();
    if (state.screen === 'result'){ syncResult(); syncNotes(); }
  }));

  $('#panelReset').addEventListener('click', () => showScreen('home'));
}

/* ============================================================
   GLOBAL HOTSPOT ROUTING
   ============================================================ */
function initRouting(){
  document.addEventListener('click', e => {
    const h = e.target.closest('[data-action]');
    if (!h) return;
    switch (h.dataset.action){
      case 'open-search':   showScreen('search'); break;
      case 'open-voos':     showScreen('voos');   break;
      case 'home':          showScreen('home');   break;
      case 'search':        showScreen('search'); break;
      case 'open-sofia':    openSofia();          break;
      case 'sofia-back':    showScreen(sofiaReturn || 'home'); break;
      case 'vbox-toggle':   parisBox.cheap = !parisBox.cheap; if (parisBox.cheap) parisBox.dateChosen = false; syncResult(); break;
      case 'vbox-pickdate': parisBox.dateChosen = true; syncResult(); break;
      case 'vbox-buscar':   resultOverride = parisBox.dateChosen ? '1:1a' : '1:1b-current'; showScreen('result'); break;
      case 'paris-verano':  goParisVerano(); break;
      case 'sofia-prompt':  openSofia(query); break;
      case 'sofia-prompt-text': openSofia(h.dataset.prompt); break;
      case 'buscar-bounce': h.classList.remove('shake'); void h.offsetWidth; h.classList.add('shake'); break;
    }
  });
  $('#sbList').addEventListener('click', onListClick);

  // Search: hide keyboard when scrolling the suggestions; tap the input to bring it back
  $('#sbScroll').addEventListener('scroll', () => {
    if ($('#sbScroll').scrollTop > 16 && !$('#kbd').classList.contains('kbd-hidden')) showKbd(false);
  });
  $('.sb-input').addEventListener('click', () => showKbd(true));
  $('#sbBuscar').addEventListener('click', () => { if (!$('#sbBuscar').disabled) submitSearch(); });

  // Airbnb-style: shrink the home search header on scroll
  const hs = $('#homeScroll');
  hs.addEventListener('scroll', () => {
    $('#homeHeader').classList.toggle('shrunk', hs.scrollTop > 24);
  });
}

/* ============================================================
   SHARED BOTTOM NAV  (4 grouped tabs + SOFIA bubble)
   ============================================================ */
const ICN = {
  home:  '<svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1z"/></svg>',
  fire:  '<svg viewBox="0 0 24 24"><path d="M12 3c1 3-2 4-2 7a4 4 0 008 0c0-1-.5-2-1-3 .2 2-1 3-2 3 0-3 1-5-3-7z"/></svg>',
  cart:  '<svg viewBox="0 0 24 24"><circle cx="9" cy="20" r="1.3"/><circle cx="18" cy="20" r="1.3"/><path d="M3 4h2l2.5 12h11l2-8H6"/></svg>',
  bag:   '<svg viewBox="0 0 24 24"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M9 8V5h6v3"/></svg>',
  spark: '<svg viewBox="0 0 24 24"><path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8z"/></svg>',
};
function navHTML(active = 'inicio'){
  const tab = (key, ic, label) =>
    `<button class="navtab${active === key ? ' active' : ''}">${ic}<span>${label}</span></button>`;
  return `<nav class="appnav">
    <div class="appnav-tabs">
      ${tab('inicio', ICN.home, 'Início')}
      ${tab('ofertas', ICN.fire, 'Ofertas')}
      ${tab('carrinho', ICN.cart, 'Carrinho')}
      ${tab('viagens', ICN.bag, 'Viagens')}
    </div>
    <button class="navsofia" data-action="open-sofia">${ICN.spark}<span>Sofia</span></button>
  </nav>`;
}
function mountNavs(){ $$('[data-nav]').forEach(el => { el.innerHTML = navHTML(el.dataset.nav || 'inicio'); }); }

/* ============================================================
   HOME  (live HTML)
   ============================================================ */
const PH = ['images/x/ph-rio.png','images/x/ph-chile.png','images/x/ph-colombia.png','images/x/ph-argentina.png','images/x/ph-hotel1.png'];
const PH_HOTEL = ['images/x/ph-hotel2.png','images/x/ph-hotel3.png'];
const ph = i => PH[((i % PH.length) + PH.length) % PH.length];
const phHotel = i => PH_HOTEL[((i % PH_HOTEL.length) + PH_HOTEL.length) % PH_HOTEL.length];
const spark = '<svg class="dc-spark" viewBox="0 0 24 24"><path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8z"/></svg>';
const moreBtn = '<button class="hsec-more"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>';

function ocard(i, loc, name, price, extra){
  return `<button class="ocard"><span class="tag">${extra||'Hospedagens'}</span>
    <img class="ph" src="${ph(i)}" alt=""><div class="oc-body">
    <div class="oc-loc">${loc}</div><div class="oc-name">${name}</div>
    <div class="oc-from">Desde</div><div class="oc-price">${price}</div></div></button>`;
}
const sofiaCard = txt => `<button class="sofia-card" data-action="open-sofia">
  <span class="sc-mark">${ICN.spark}</span><span>${txt}</span></button>`;

function renderHome(){
  const chips = [
    ['✨','SOFIA'],['💸','Passeios'],['🏰','Disney'],['🎢','Universal'],['🚗','Carros'],
    ['🚐','Transfers'],['🛡️','Seguros'],['🚢','Cruzeiros'],['🍔','iFood',true],['＋','Ver mais'],
  ];
  const hotels = [
    ['Rio de Janeiro','Royal Rio Palace Hotel','$ 363.989'],
    ['Rio de Janeiro','Mirasol Copacabana','$ 363.989'],
    ['Rio de Janeiro','Hotel Atlântico Business','$ 363.989'],
  ];
  const dest = [
    ['Brasil',0,150],['Chile',1,118],['Colombia',2,138],['Argentina',3,150],
    ['Espanha',1,120],['Estados Unidos',2,150],
  ];

  $('#homeBody').innerHTML = `
    <div class="prod-row">
      <button class="prod-card"><img src="images/x/ill-hosp.png" alt=""><span>Hospedagens</span></button>
      <button class="prod-card" data-action="open-voos"><img src="images/x/ill-voos.png" alt=""><span>Voos</span></button>
      <button class="prod-card"><img src="images/x/ill-pac.png" alt=""><span>Pacotes</span></button>
    </div>

    <div class="chips">${chips.map(c =>
      `<button class="chip"><span class="chip-ic${c[2]?' red':''}">${c[0]}</span><span>${c[1]}</span></button>`).join('')}</div>

    <div class="hsec"><div class="hsec-head"><h3>Continue sua busca</h3></div>
      <div class="hcar">
        <button class="dcard"><img class="ph" src="${ph(0)}" alt=""><div class="dc-body">
          <div><div class="dc-kick">Hospedagens</div><div class="dc-title">Copenhague</div><div class="dc-sub">29 set - 10 out</div></div>${spark}</div></button>
        <button class="dcard"><img class="ph" src="${ph(2)}" alt=""><div class="dc-body">
          <div><div class="dc-kick">Voos</div><div class="dc-title">Roma</div><div class="dc-sub">12 oct - 20 oct</div></div>${spark}</div></button>
      </div></div>

    <div class="promo ifood"><div class="pz-brand">decolar + iFood</div>
      <h4>Ofertas ideais para você</h4><span class="pz-emoji">😋</span></div>

    <div class="hsec"><div class="hcar">
      ${ocard(1,'Movida','Aluguel de carros','1.200 pontos','Carros')}
      ${ocard(2,'Salvador, Bahia','Rede Andrade Barra','1.200 pontos','Hotel')}
      ${ocard(3,'De São Paulo para','Santiago, Chile','U$ 1200','Voos')}
    </div></div>

    <div class="promo r300"><div class="pz-brand">iFood + decolar</div>
      <h4>Ganhe até R$300</h4><p>na sua primeira compra aqui na Decolar.</p>
      <button class="pz-cta">DECOLARBIFOOD</button><span class="pz-emoji">🎁</span></div>

    <div class="hsec"><div class="hsec-head"><h3>As melhores hospedagens<br>no Rio de Janeiro</h3>${moreBtn}</div>
      <div class="hcar">${hotels.map((h,i)=>ocard(i,h[0],h[1],h[2])).join('')}
        ${sofiaCard('Sofia, encontre hotéis mais baratos no Rio')}</div></div>

    <div class="promo playera"><div class="pz-brand">🌴 Semana Playera</div>
      <h4>Até 15% off em Pacotes para o Brasil</h4><p>Acá va una descripción de uno o más renglones.</p><span class="pz-emoji">⛱️</span></div>

    <div class="hsec"><div class="hsec-head"><h3>Produtos muito procurados<br>em Saquarema</h3>${moreBtn}</div>
      <div class="hcar">${hotels.map((h,i)=>ocard(i+1,h[0],h[1],h[2])).join('')}
        ${sofiaCard('Sofia, encontre hotéis mais baratos no Rio')}</div></div>

    <div class="hsec"><div class="hsec-head"><h3>Explore novos destinos</h3></div>
      <div class="fchips">${['Playa','Montaña','Ciudad','Aventura','Tag text'].map((f,i)=>
        `<button class="fchip${i===0?' active':''}">${f}</button>`).join('')}</div>
      <div class="grid2">${dest.map(d=>
        `<button class="gtile"><img src="${ph(d[1])}" style="height:${d[2]}px" alt="">
          <div class="gt-cap"><b>${d[0]}</b><small>A partir de R$ 800</small></div></button>`).join('')}</div></div>

    <div class="hfoot"><h3>Ainda não sabe para onde ir?</h3>
      <button class="ff" data-action="open-sofia">${ICN.spark}<span>Vuelos a Santiago de Chile</span></button>
      <button class="ff" data-action="open-sofia">${ICN.spark}<span>Alojamientos en Miami</span></button>
      <button class="ff" data-action="open-sofia">${ICN.spark}<span>Crear un itinerario</span></button>
    </div>`;
}

/* ============================================================
   SOFIA chat screen
   ============================================================ */
let sofiaReturn = 'home';
const SOFIA_GREET = '¡Hola! Soy SOFIA, tu asistente de viajes. Contame qué tenés ganas de hacer y armamos tu viaje juntos. ✨';
const SOFIA_SUGS = ['Armá mi viaje', 'Ofertas a Europa', 'Escapada de fin de semana', '¿Qué hacer en París?'];

function openSofia(prompt){
  sofiaReturn = state.screen === 'sofia' ? sofiaReturn : state.screen;
  $('#sofiaThread').innerHTML = `<div class="bubble sof">${SOFIA_GREET}</div>`;
  $('#sofiaSuggest').innerHTML = SOFIA_SUGS.map(s => `<button class="sofia-chip">${s}</button>`).join('');
  showScreen('sofia');
  if (prompt && prompt.trim()) sofiaSend(prompt);   // open with the typed text as the first prompt
}
function sofiaSend(text){
  const t = (text || '').trim(); if (!t) return;
  const thread = $('#sofiaThread');
  thread.insertAdjacentHTML('beforeend', `<div class="bubble me">${escapeHtml(t)}</div>`);
  $('#sofiaInput').value = '';
  setTimeout(() => {
    thread.insertAdjacentHTML('beforeend',
      `<div class="bubble sof">¡Buenísimo! Estoy buscando las mejores opciones para «${escapeHtml(t)}». Dame un segundo… 🔎</div>`);
    thread.scrollTop = thread.scrollHeight;
  }, 450);
  thread.scrollTop = thread.scrollHeight;
}
function initSofia(){
  $('#sofiaSend').addEventListener('click', () => sofiaSend($('#sofiaInput').value));
  $('#sofiaInput').addEventListener('keydown', e => { if (e.key === 'Enter') sofiaSend($('#sofiaInput').value); });
  $('#sofiaSuggest').addEventListener('click', e => {
    const c = e.target.closest('.sofia-chip'); if (c) sofiaSend(c.textContent);
  });
}

/* ============================================================
   VUELOS BOX  (Voos new/returning  +  Result-2 Paris)
   ============================================================ */
const VIC = {
  bed:   '<svg viewBox="0 0 24 24"><path d="M3 18v-6h18v6M3 12V8h11v4M21 12v-1a3 3 0 00-3-3M3 18v2M21 18v2"/></svg>',
  plane: '<svg viewBox="0 0 24 24"><path d="M21 13.5l-8-2.2V5a1.5 1.5 0 00-3 0v6.3l-8 2.2V16l8-1.3V19l-2 1.3V22l3.5-1 3.5 1v-1.7L13 19v-4.3l8 1.3z"/></svg>',
  bag:   '<svg viewBox="0 0 24 24"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M9 8V6a2 2 0 012-2h2a2 2 0 012 2v2"/></svg>',
  dots:  '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
  spark: '<svg viewBox="0 0 24 24"><path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8z"/></svg>',
};
/* shared circular product tabs (vbox + landing-actual top nav) */
function productTabs(active){
  const t = (ic, label, key) =>
    `<button class="vtab${active===key?' active':''}"${key==='sofia'?' data-action="open-sofia"':''}>
       <span class="vt-ic">${ic}</span><span>${label}</span></button>`;
  return `<div class="vbox-tabs">
    ${t(VIC.spark,'SOFIA','sofia')}${t(VIC.bed,'Alojamientos','aloj')}
    ${t(VIC.plane,'Vuelos','vuelos')}${t(VIC.bag,'Paquetes','paq')}${t(VIC.dots,'Más','mas')}</div>`;
}

/* Op.2 caja-de-búsqueda interactive state */
let resultOverride = null;                 // set by Op.2 Buscar to jump to 1A / 1B
let parisBox = { cheap:true, dateChosen:false, mesLabel:'Todos los meses' };
function resetBoxFlow(){ resultOverride = null; parisBox = { cheap:true, dateChosen:false, mesLabel:'Todos los meses' }; }

function vboxHTML(variant){
  const isParis = variant === 'paris';
  const base = {
    new:       { dest:'Cualquier destino', cheap:true,  vuelta:null,    back:'home'   },
    returning: { dest:'Cancún, México',    cheap:false, vuelta:'24 jul', back:'home'   },
    paris:     { dest:`${selectedDest.city}, ${selectedDest.country}`, cheap:true, vuelta:null, back:'search' },
  }[variant];
  const cheap = isParis ? parisBox.cheap : base.cheap;

  // date area
  const twoCol = (ida, vta, action) =>
    `<div class="vfield two"${action?` data-action="${action}"`:''}><span class="vf-ic">${calIc()}</span>
       <div class="vf-col"><div class="vf-kick">Ida</div><div class="vf-val">${ida}</div></div>
       <div class="vf-sep"></div>
       <div class="vf-col"><div class="vf-kick">Vuelta</div><div class="vf-val">${vta}</div></div></div>`;
  const mesField =
    `<div class="vfield"><span class="vf-ic">${calIc()}</span>
       <div class="vf-col"><div class="vf-kick">Mes</div><div class="vf-val">${isParis ? parisBox.mesLabel : 'Todos los meses'}</div></div>
       <span class="vf-chev">${chevIc()}</span></div>`;
  let dateField;
  if (variant === 'returning')              dateField = twoCol('15 jul - 30 jul','24 jul');
  else if (isParis && !cheap && parisBox.dateChosen) dateField = twoCol('15 jul','30 jul','vbox-pickdate');
  else if (isParis && !cheap)
    dateField = `<div class="vfield pick" data-action="vbox-pickdate"><span class="vf-ic">${calIc()}</span>
       <div class="vf-col"><div class="vf-kick">Fechas</div><div class="vf-val ph">Seleccioná ida y vuelta</div></div>
       <span class="vf-chev">${chevIc()}</span></div>`;
  else                                      dateField = mesField;

  const toggleAttr = isParis ? ' data-action="vbox-toggle"' : '';
  const buscar = isParis ? 'vbox-buscar' : 'buscar-bounce';

  return `<div class="vbox">
    <button class="vbox-x" data-action="${base.back}" aria-label="Cerrar">${xIc()}</button>
    ${productTabs('vuelos')}
    <div class="vbox-prod">${VIC.plane}<span>Vuelos</span></div>
    <div class="vbox-fields">
      <div class="vstack">
        <div class="vfield"><span class="vf-ic ring"></span>
          <div class="vf-col"><div class="vf-kick">Origem</div><div class="vf-val">Buenos Aires, Argentina</div></div></div>
        <div class="vfield"><span class="vf-ic">${pinIc()}</span>
          <div class="vf-col"><div class="vf-kick">Destino</div><div class="vf-val">${base.dest}</div></div></div>
        <button class="vswap" aria-label="Invertir">${swapIc()}</button>
      </div>
      ${dateField}
      <label class="vtoggle"${toggleAttr}><span class="vsw${cheap?' on':''}"><i></i></span> Cualquier fecha más barata</label>
      <div class="vfield"><span class="vf-ic">${paxIc()}</span>
        <div class="vf-col"><div class="vf-kick">Pasajeros y clase</div><div class="vf-val">1 pasajero, económica</div></div></div>
    </div>
    <button class="vbox-buscar" data-action="${buscar}">${loupeIc()} Buscar</button>
  </div>`;
}
function calIc(){return '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 9h17M8 3v4M16 3v4"/></svg>';}
function chevIc(){return '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>';}
function pinIc(){return '<svg viewBox="0 0 24 24"><path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>';}
function paxIc(){return '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0112 0M16 6a3 3 0 010 6M21 20a6 6 0 00-5-5.9"/></svg>';}
function swapIc(){return '<svg viewBox="0 0 24 24"><path d="M7 4v13M4 7l3-3 3 3M17 20V7M14 17l3 3 3-3"/></svg>';}
function xIc(){return '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';}
function loupeIc(){return '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';}
function arrowIc(){return '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';}
function shareIc(){return '<svg viewBox="0 0 24 24"><path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6"/></svg>';}
function backIc(){return '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>';}

/* ============================================================
   RESULT SCREENS
   ============================================================ */
function pillHeader(sub, back){
  return `<div class="rhead">
    <button class="rh-back" data-action="${back}" aria-label="Volver">${backIc()}</button>
    <div class="rh-pill"><b>BUE - ${selectedDest.code}</b><span>${sub} · <em>👤</em> 1</span></div>
    <button class="rh-share" aria-label="Compartir">${shareIc()}</button>
  </div>`;
}
const moreCircle = `<button class="hsec-more big">${arrowIc()}</button>`;

/* offer card with photo + tag (used by 1B-nueva & multiproduct) */
function focard(img, tag, loc, title, lines){
  return `<button class="focard"><span class="tag">${tag}</span>
    <img class="ph" src="${img}" alt=""><div class="fo-body">
    <div class="fo-loc">${loc}</div><div class="fo-title">${title}</div>${lines}</div></button>`;
}
const VOOS_LINES = `<div class="fo-from">Desde</div><div class="fo-price">U$ 1200</div><div class="fo-sub">Ida e volta</div>`;
/* a row of 3 "Voos a Paris" cards, each a different photo */
function voosRow(start){
  return `<div class="hcar">${[0,1,2].map(k=>focard(ph(start+k),'Voos','De Buenos Aires',selectedDest.city,VOOS_LINES)).join('')}</div>`;
}
/* month price bar chart (shared by 1B-nueva & multiproduct) */
function monthChartHTML(){
  const M=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const H=[72,64,56,50,54,62,78,82,46,42,30,60];      // Noviembre = cheapest
  const min=Math.min(...H);
  return `<div class="hsec"><div class="hsec-head"><h3>¿Cuándo es más barato?</h3></div>
    <div class="mchart">${H.map((h,i)=>`<div class="mc-col"><i style="height:${h}%;background:${h===min?'#19c3a0':'#6d28d9'}"></i><span${h===min?' class="lo"':''}>${M[i]}</span></div>`).join('')}</div></div>`;
}
/* rotating SOFIA prompt card (destination-aware) */
let sofiaRotTimer = null, sofiaRotList = [];
function sofiaRotCard(){
  const c = selectedDest.city;
  sofiaRotList = [`Buscar vuelos baratos para ${c}`, `¿Qué puedo hacer en ${c}?`, `Mejores lugares para visitar en ${c}`, 'Armar un itinerario de 5 días', `¿Cuál es la mejor época para ir a ${c}?`];
  return `<div class="hsec"><button class="sofia-rot" data-action="open-sofia">
    <span class="sr-mark">${ICN.spark}</span>
    <span class="sr-body"><span class="sr-kick">Preguntale a SOFIA</span><span class="sr-text" id="sofiaRotText">${escapeHtml(sofiaRotList[0])}</span></span>
    <span class="sr-arrow">${arrowIc()}</span></button></div>`;
}
function startSofiaRotator(){
  if (sofiaRotTimer){ clearInterval(sofiaRotTimer); sofiaRotTimer = null; }
  const el = document.getElementById('sofiaRotText'); if (!el || !sofiaRotList.length) return;
  let i = 0;
  sofiaRotTimer = setInterval(() => {
    i = (i + 1) % sofiaRotList.length;
    el.style.opacity = '0';
    setTimeout(() => { el.textContent = sofiaRotList[i]; el.style.opacity = '1'; }, 220);
  }, 2600);
}

/* 1A — flight results list */
function flightListHTML(){
  const air = '<span class="air"><span class="air-dot"></span></span>';
  const leg = (a,ta,b,tb) =>
    `<div class="fc-leg">${air}
      <div class="lg"><b>${a}</b><span>${ta}</span></div>
      <div class="lg"><b>${b}</b><span>${tb} <sup>+1</sup></span></div>
      <div class="lg dir"><a>Directo</a><span>15 h 10 m</span></div>
      <span class="bags">${bagIc3()}</span></div>`;
  const dst = selectedDest.code;
  const card = `<div class="fcard">
    <span class="fc-chk">${xIc()}</span>
    ${leg('EZE','17:05',dst,'07:15')}
    <div class="fc-div"></div>
    ${leg(dst,'20:15','EZE','12:15')}
    <div class="fc-foot"><span>Final 2 personas <b class="i">i</b></span><b class="price">$ 1.200.000</b></div>
  </div>`;
  return `<div class="rwrap fl">
    ${pillHeader('jul 15 - jul 30','search')}
    <div class="fl-filters">
      <button class="flc">${tuneIc()} Filtros</button>
      <button class="flc">Moneda ${chevIc()}</button>
      <button class="flc">Ordenar ${chevIc()}</button>
      <button class="flc">Escalas</button>
    </div>
    <div class="fl-row2">
      <label class="fl-sep">${swapIc()} Separar ida y vuelta <span class="vsw"><i></i></span></label>
      <span class="fl-pts">🅳 999.999 <span class="vsw on"><i></i></span></span>
    </div>
    <div class="fl-list">${card}${card}${card}</div>
  </div>`;
}
function bagIc3(){return '<svg viewBox="0 0 24 24"><path d="M4 4l16 16M20 4L4 20" opacity=".25"/></svg>';}
function tuneIc(){return '<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>';}

/* 1B-current — landing (actual) */
function landingActualHTML(){
  const D = selectedDest;
  const fcard = (air, color, days, price) => `<div class="lacard">
    <div class="la-air"><span class="air-dot" style="background:${color}"></span>${air}<span class="la-days">🧳 ${days}</span></div>
    <div class="la-legs">
      <div><div class="la-leg">${VIC.plane}<b>IDA</b> EZE - ${D.code}</div><div class="la-date">Lun. 8 jul. 2024</div><div class="la-time">7:30 · <a>Directo</a></div></div>
      <div><div class="la-leg">${VIC.bag}<b>VUELTA</b> ${D.code} - AEP</div><div class="la-date">Mar. 9 jul. 2024</div><div class="la-time">21:45 · 2 escalas</div></div>
    </div>
    <div class="la-foot"><div><div class="la-from">Por persona desde</div><div class="la-price">MXN$ <b>${price}</b></div></div><a class="la-next">Siguiente ${chevR()}</a></div>
  </div>`;
  return `<div class="rwrap la">
    <div class="la-topnav">
      <button class="la-logo" data-action="search" aria-label="Inicio"><span class="dlogo"></span></button>
      <div class="la-icons"><span class="lai on">🎧</span><span class="lai">💼</span><span class="lai">🅳</span><span class="lai pill">👤 ☰</span></div>
    </div>
    <div class="la-ptabs">${productTabs('vuelos')}</div>
    <div class="la-hero" style="background-image:url('${destPhoto(D)}')"><h2>Vuelos desde<br>Buenos Aires a ${escapeHtml(D.city)}</h2></div>
    <div class="la-bar"><div class="lab-row">${pinIc()} <b>${escapeHtml(D.city)}, ${escapeHtml(D.country)}</b></div><div class="lab-row">${calIc()} Elegí una fecha <span class="lab-pax">👤 1</span></div><button class="lab-search">${loupeIc()}</button></div>
    <h3 class="la-h3">Vuelos más baratos a ${escapeHtml(D.city)}</h3>
    <div class="la-cards">
      ${fcard('LATAM Airlines','#e6224a','2 días','9.000')}
      ${fcard('Aerolíneas','#1565c0','4 días','9.700')}
      ${fcard('Volaris','#7c3aed','4 días','12.000')}
    </div>
    <button class="la-more">Ver más ofertas</button>
    <h3 class="la-h3">Tendencia de precios</h3>
    <div class="la-trend"><div class="lt-kick">Encuentra vuelos</div><div class="lt-price">Desde ARS 1.499.400</div>
      <div class="lt-bars">${[40,55,35,70,50,85,45,60,30,75,50,65].map((h,i)=>`<i style="height:${h}%;background:${i%4===3?'#19c3a0':'#6d28d9'}"></i>`).join('')}</div></div>
  </div>`;
}
function chevR(){return '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>';}

/* 1B-new — landing (nueva), with bottom nav */
function landingNuevaHTML(){
  return `<div class="rwrap nav">
    ${pillHeader('cualquier fecha','search')}
    <div class="rscroll">
      <div class="hsec"><div class="hsec-head"><h3>Vuelos baratos a ${escapeHtml(selectedDest.city)}</h3>${moreCircle}</div>${voosRow(0)}</div>
      <div class="hsec"><div class="hsec-head"><h3>Vuelos directos baratos</h3>${moreCircle}</div>${voosRow(1)}</div>
      ${monthChartHTML()}
      <div class="hsec"><div class="hsec-head"><h3>Vuelos con valijas</h3>${moreCircle}</div>${voosRow(2)}</div>
    </div>
    ${navHTML('inicio')}
  </div>`;
}

/* 3 — multiproduct landing, with bottom nav */
function multiproductHTML(){
  const hotelLines = `<div class="fo-from">Desde</div><div class="fo-price">$ 169.000</div><div class="fo-sub">1 noche, 2 personas</div>`;
  const paqLines   = `<div class="fo-from">Desde</div><div class="fo-price">U$ 1200</div><div class="fo-sub">4 noites, 2 pers.</div>`;
  const C = escapeHtml(selectedDest.city);
  const hotelNames = ['Hotel Sheraton Business','Pestana Atlântica','Belmond Palace'];
  const hotelRow = `<div class="hcar">${[0,1,2].map(k=>focard(phHotel(k),'Hospedagens',C,hotelNames[k],hotelLines)).join('')}</div>`;
  const paqRow = `<div class="hcar">${[0,1,2].map(k=>focard(ph(k+2),'Pacotes','De Buenos Aires',C,paqLines)).join('')}</div>`;
  return `<div class="rwrap nav">
    ${pillHeader('cualquier fecha','search')}
    <div class="rscroll">
      <div class="statcar">
        <div class="stat"><div class="st-kick">Vuelo promedio</div><div class="st-val">$ 700</div></div>
        <div class="stat"><div class="st-kick">Mejor mes para viajar</div><div class="st-val">Sept - Oct</div></div>
        <div class="stat"><div class="st-kick">Mes más barato</div><div class="st-val">Noviembre</div></div>
      </div>
      <div class="hsec"><div class="hsec-head"><h3>Com base na sua busca por ${C}</h3>${moreCircle}</div>
        <div class="hcar">
          ${focard(phHotel(0),'Hospedagens',C,'Hotel Sheraton Business Centro',hotelLines)}
          ${focard(ph(0),'Voos','De Buenos Aires',C,VOOS_LINES)}
          ${focard(ph(1),'Pacotes','De Buenos Aires',C,paqLines)}
        </div></div>
      ${sofiaRotCard()}
      <div class="hsec"><div class="hsec-head"><h3>Vuelos baratos a ${C}</h3>${moreCircle}</div>${voosRow(2)}</div>
      <div class="hsec"><div class="hsec-head"><h3>Paquetes a ${C}</h3>${moreCircle}</div>${paqRow}</div>
      <div class="hsec"><div class="hsec-head"><h3>Hospedagens em ${C}</h3>${moreCircle}</div>${hotelRow}</div>
      ${monthChartHTML()}
    </div>
    ${navHTML('inicio')}
  </div>`;
}

/* keep the whole phone + bezel visible with padding on any screen */
function fitPhone(){
  const PHONE_W = 390 + 22, PHONE_H = 844 + 22;   // incl. bezel padding
  const scale = Math.min(1,
    (window.innerHeight - 48) / PHONE_H,
    (window.innerWidth  - 48) / PHONE_W);
  document.documentElement.style.setProperty('--phone-scale', scale.toFixed(3));
}
window.addEventListener('resize', fitPhone);

/* ---------------- boot ---------------- */
loadState();
renderHome();
mountNavs();
initSofia();
buildKeyboard();
initPanel();
initRouting();
syncPanelUI();

// optional deep-link: ?go=home|voos|search|result|sofia  &q=<text>
const boot = new URLSearchParams(location.search);
const go = boot.get('go') || 'home';
if (go === 'sofia') openSofia();
else showScreen(['home','voos','search','result'].includes(go) ? go : 'home');
if (go === 'search' && boot.get('q')) setQuery(boot.get('q'));

// panel open by default (still minimizable); ?panel=0 starts it collapsed
if (boot.get('panel') !== '0'){ $('#panel').classList.add('open'); $('#panelFab').classList.add('hidden'); }

fitPhone();
if (boot.get('hs')){ const s = $('#homeScroll'); s.scrollTop = +boot.get('hs'); $('#homeHeader').classList.toggle('shrunk', s.scrollTop > 24); }
if (boot.get('ss')){ const s = $('#sbScroll'); s.scrollTop = +boot.get('ss'); if (s.scrollTop > 16) showKbd(false); }
if (boot.get('rs')){ const s = $('#screen-result .rscroll'); if (s) s.scrollTop = +boot.get('rs'); }
saveState();

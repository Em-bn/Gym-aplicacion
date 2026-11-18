/* Pixel Gym Tracker · módulo de mejoras v2 */
(function () {
  const $ = id => document.getElementById(id);
  const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? 0 : n; };
  const e1 = (kg, r) => kg * (1 + r / 30);
  const dstr = t => new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const EX = {}; Object.values(WORKOUT_PLAN).forEach(d => d.exercises.forEach(e => EX[e.id] = e));
  const DAYN = { lunes: 'Lunes', miercoles: 'Miércoles', viernes: 'Viernes' };
  function ensure() { appState.history = appState.history || []; appState.prev = appState.prev || {}; appState.pr = appState.pr || {}; appState.bw = appState.bw || []; }

  /* ---- 1. Última vez + récord en cada tarjeta ---- */
  function decorate() {
    ensure();
    WORKOUT_PLAN[appState.currentDay].exercises.forEach(ex => {
      const b = document.querySelector(`button[onclick^="toggleSetComplete('${ex.id}'"]`); if (!b) return;
      const p = appState.prev[ex.id], best = appState.pr[ex.id];
      b.closest('.space-y-2').insertAdjacentHTML('beforebegin',
        `<div class="mb-2 px-1 text-[10px] font-semibold text-slate-400 flex flex-wrap gap-x-3 gap-y-0.5"><span>${p ? 'Última vez: <span class="text-sky-300 font-mono">' + p.join(' · ') + '</span>' : 'Sin registro previo'}</span>${best ? '<span class="text-amber-300">🏆 e1RM ' + best.toFixed(1) + ' kg</span>' : ''}</div>`);
    });
  }
  const _re = window.renderExercises; window.renderExercises = function () { _re(); decorate(); };

  /* ---- 2. Detección de récords ---- */
  const _tc = window.toggleSetComplete;
  window.toggleSetComplete = function (exId, setId, ...a) {
    _tc(exId, setId, ...a); ensure();
    const l = appState.logs[exId + '_' + setId];
    if (l && l.done && num(l.kg) > 0 && num(l.reps) > 0) {
      const v = e1(num(l.kg), num(l.reps)), old = appState.pr[exId] || 0;
      if (v > old + 0.01) {
        appState.pr[exId] = v; saveState();
        if (old > 0) { showToast('🏆 ¡Nuevo récord!', `${EX[exId].name}: ${l.kg} kg × ${l.reps}`); navigator.vibrate && navigator.vibrate([100, 50, 100, 50, 200]); }
        _re(); decorate();
      }
    }
  };

  /* ---- 3. Terminar y guardar sesión ---- */
  let armed = null;
  window.xFinish = function (btn) {
    if (!armed) { btn.textContent = '¿Seguro? Toca otra vez'; armed = setTimeout(() => { armed = null; btn.innerHTML = '<span>✔ Terminar sesión</span>'; }, 3000); return; }
    clearTimeout(armed); armed = null; btn.innerHTML = '<span>✔ Terminar sesión</span>';
    ensure(); const d = appState.currentDay; let sets = 0, vol = 0; const ex = {};
    WORKOUT_PLAN[d].exercises.forEach(e => {
      const done = []; let best = 0;
      e.sets.forEach(s => {
        const l = appState.logs[e.id + '_' + s.id];
        if (l && l.done) { const kg = num(l.kg), r = num(l.reps) || num(s.defaultReps); sets++; vol += kg * r; done.push((kg || '–') + '×' + r); if (kg > 0) best = Math.max(best, e1(kg, r)); }
      });
      if (done.length) { appState.prev[e.id] = done; ex[e.id] = Math.round(best * 10) / 10; }
    });
    if (!sets) { showToast('Nada que guardar', 'Marca al menos una serie como hecha.'); return; }
    appState.history.push({ t: Date.now(), day: d, secs: appState.sessionElapsedSeconds, sets, vol: Math.round(vol), ex });
    saveState();
    pendingResetType = 'session'; executeReset(); pendingResetType = 'day'; executeReset(); pendingResetType = null;
    showToast('💪 Sesión guardada', `${sets} series · ${Math.round(vol)} kg de volumen`);
  };

  /* ---- 4. Pantalla encendida + vibración ---- */
  let wl = null;
  async function lock() { try { if ('wakeLock' in navigator && !wl) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => wl = null); } } catch (e) { } }
  function unlock() { try { wl && wl.release(); } catch (e) { } wl = null; }
  const _ts = window.toggleSessionTimer; window.toggleSessionTimer = function () { _ts(); isSessionRunning ? lock() : unlock(); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && isSessionRunning) lock(); });
  const _rf = window.onRestTimerFinished; window.onRestTimerFinished = function () { _rf(); navigator.vibrate && navigator.vibrate([300, 150, 300]); };

  /* ---- 5. Panel de progreso y herramientas ---- */
  function chart(v, unit) {
    if (v.length < 2) return '<p class="text-[11px] text-slate-500">Necesitas al menos 2 registros.</p>';
    const mn = Math.min(...v), mx = Math.max(...v), rg = (mx - mn) || 1;
    const pts = v.map((y, i) => `${10 + i * 280 / (v.length - 1)},${85 - (y - mn) / rg * 70}`).join(' ');
    return `<svg viewBox="0 0 300 100" class="w-full h-24"><polyline points="${pts}" fill="none" stroke="#a3e635" stroke-width="2.5" stroke-linejoin="round"/><text x="10" y="98" fill="#94a3b8" font-size="9">mín ${mn.toFixed(1)}</text><text x="290" y="10" text-anchor="end" fill="#a3e635" font-size="10" font-weight="bold">${v[v.length - 1].toFixed(1)} ${unit}</text></svg>`;
  }
  const card = (t, inner) => `<div class="bg-slate-950/90 border border-slate-800 rounded-2xl p-3.5 space-y-2"><div class="text-xs font-extrabold text-lime-400 uppercase tracking-wider">${t}</div>${inner}</div>`;
  const inp = 'bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-sm font-mono text-white w-full focus:border-sky-400 outline-none';
  let tab = 'prog', selEx = 'lun_banca';

  function viewProg() {
    ensure(); const h = appState.history, wk = Date.now() - 7 * 864e5;
    const vol = h.reduce((a, s) => a + s.vol, 0), avg = h.length ? Math.round(h.reduce((a, s) => a + s.secs, 0) / h.length / 60) : 0;
    const stat = (n, l) => `<div class="bg-slate-900 rounded-xl p-2.5 text-center"><div class="font-mono text-lg font-extrabold text-white">${n}</div><div class="text-[10px] text-slate-400">${l}</div></div>`;
    const opts = Object.values(EX).map(e => `<option value="${e.id}" ${e.id === selEx ? 'selected' : ''}>${e.name}</option>`).join('');
    const series = h.filter(s => s.ex[selEx]).map(s => s.ex[selEx]);
    const last = h.slice(-6).reverse().map(s => `<div class="flex justify-between text-[11px] text-slate-300 py-1 border-b border-slate-800/70"><span>${dstr(s.t)} · ${DAYN[s.day]}</span><span class="font-mono text-slate-400">${s.sets} series · ${s.vol} kg · ${Math.round(s.secs / 60)} min</span></div>`).join('') || '<p class="text-[11px] text-slate-500">Aún no hay sesiones. Pulsa «Terminar sesión» al acabar.</p>';
    const bw = appState.bw.map(x => x.kg);
    return `<div class="grid grid-cols-4 gap-2">${stat(h.length, 'sesiones')}${stat(h.filter(s => s.t > wk).length, '7 días')}${stat((vol / 1000).toFixed(1), 't volumen')}${stat(avg, 'min medios')}</div>
    ${card('Progreso por ejercicio (e1RM)', `<select onchange="xSel(this.value)" class="${inp}">${opts}</select>${chart(series, 'kg')}`)}
    ${card('Peso corporal', `<div class="flex gap-2"><input id="xbw" type="number" inputmode="decimal" step="0.1" placeholder="kg" class="${inp}"><button onclick="xAddBw()" class="px-4 rounded-xl bg-lime-400 text-slate-950 font-extrabold text-xs">Añadir</button></div>${chart(bw.slice(-20), 'kg')}`)}
    ${card('Últimas sesiones', last)}`;
  }
  function viewTools() {
    return `${card('Calculadora de discos', `<div class="grid grid-cols-2 gap-2"><input id="xpt" oninput="xPlates()" type="number" inputmode="decimal" placeholder="Peso total (kg)" class="${inp}"><input id="xpb" oninput="xPlates()" type="number" inputmode="decimal" value="20" placeholder="Barra" class="${inp}"></div><div id="xpr" class="text-xs text-slate-300 font-mono">Por lado: –</div>`)}
    ${card('Series de calentamiento', `<input id="xwu" oninput="xWarm()" type="number" inputmode="decimal" placeholder="Peso de trabajo (kg)" class="${inp}"><div id="xwr" class="text-xs text-slate-300 font-mono space-y-0.5">–</div>`)}
    ${card('Copia de seguridad', `<p class="text-[11px] text-slate-400">Guarda tus datos en un archivo por si cambias de móvil o borras la app.</p><div class="grid grid-cols-2 gap-2"><button onclick="xExport()" class="py-2.5 rounded-xl bg-sky-400 text-slate-950 font-extrabold text-xs">Exportar</button><label class="py-2.5 rounded-xl bg-slate-800 text-slate-200 font-extrabold text-xs text-center cursor-pointer">Importar<input type="file" accept=".json" class="hidden" onchange="xImport(this)"></label></div>`)}`;
  }
  function paint() {
    $('xBody').innerHTML = tab === 'prog' ? viewProg() : viewTools();
    ['prog', 'tools'].forEach(t => $('xt-' + t).className = 'flex-1 py-2 rounded-xl text-xs font-extrabold ' + (t === tab ? 'bg-lime-400 text-slate-950' : 'bg-slate-800 text-slate-300'));
  }
  window.xOpen = t => { tab = t; $('xModal').classList.remove('hidden'); paint(); };
  window.xClose = () => $('xModal').classList.add('hidden');
  window.xTab = t => { tab = t; paint(); };
  window.xSel = v => { selEx = v; paint(); };
  window.xAddBw = () => { const k = num($('xbw').value); if (!k) return; appState.bw.push({ t: Date.now(), kg: k }); saveState(); paint(); };
  window.xPlates = () => {
    const t = num($('xpt').value), b = num($('xpb').value); let r = (t - b) / 2; const out = [];
    if (t <= b) { $('xpr').textContent = 'Por lado: –'; return; }
    [25, 20, 15, 10, 5, 2.5, 1.25].forEach(p => { const n = Math.floor(r / p + 1e-9); if (n > 0) { out.push(n + '×' + p); r -= n * p; } });
    $('xpr').textContent = 'Por lado: ' + (out.join(' + ') || '–') + (r > 0.01 ? ' (faltan ' + r.toFixed(2) + ')' : '');
  };
  window.xWarm = () => {
    const w = num($('xwu').value); const rnd = x => Math.round(x / 2.5) * 2.5;
    $('xwr').innerHTML = w ? [[.4, 10], [.6, 5], [.8, 3]].map(([p, r]) => `<div>${rnd(w * p)} kg × ${r}</div>`).join('') : '–';
  };
  window.xExport = () => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(appState)], { type: 'application/json' }));
    a.download = 'gym-tracker-' + new Date().toISOString().slice(0, 10) + '.json'; a.click(); showToast('Copia exportada', 'Revisa tu carpeta de Descargas.');
  };
  window.xImport = inp => {
    const f = inp.files[0]; if (!f) return; const rd = new FileReader();
    rd.onload = () => { try { const d = JSON.parse(rd.result); if (!d.logs) throw 0; appState = { ...appState, ...d }; saveState(); location.reload(); } catch (e) { showToast('Archivo no válido', 'Elige una copia exportada por la app.'); } };
    rd.readAsText(f);
  };

  /* ---- 6. Interfaz: barra de acciones + modal ---- */
  function build() {
    $('mondayQuickBanner').insertAdjacentHTML('beforebegin', `<div class="grid grid-cols-3 gap-2">
      <button onclick="xFinish(this)" class="py-2.5 rounded-2xl bg-lime-400 text-slate-950 font-extrabold text-xs active:scale-95 transition"><span>✔ Terminar sesión</span></button>
      <button onclick="xOpen('prog')" class="py-2.5 rounded-2xl bg-slate-800 border border-slate-700 text-sky-300 font-extrabold text-xs active:scale-95 transition">📈 Progreso</button>
      <button onclick="xOpen('tools')" class="py-2.5 rounded-2xl bg-slate-800 border border-slate-700 text-slate-200 font-extrabold text-xs active:scale-95 transition">🧰 Herramientas</button></div>`);
    document.body.insertAdjacentHTML('beforeend', `<div id="xModal" class="fixed inset-0 z-50 hidden bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div class="bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-4 space-y-3 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div class="flex items-center gap-2"><button id="xt-prog" onclick="xTab('prog')"></button><button id="xt-tools" onclick="xTab('tools')"></button>
        <button onclick="xClose()" class="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold">✕</button></div>
        <div id="xBody" class="space-y-3"></div></div></div>`);
  }
  const _ol = window.onload;
  window.onload = function () { _ol(); ensure(); build(); };
})();

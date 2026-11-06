/* ============================================================
   CARNÉ MUNCHIES · Monedero prepago con QR
   Módulo independiente (se carga desde index.html).
   Datos: /wallets, /txns (solo se agregan), /view/{token}.
   Modo nube (Firebase + inicio de sesión) o modo local (localStorage).
   ============================================================ */
(function(){
'use strict';

const LS = { w:'munchies_wallets_v1', t:'munchies_txns_v1', v:'munchies_view_v1', by:'munchies_cajero' };
const PR = ['perro','combo_pop','pop','agua','botella','brownie','slushie'];
const METHODS = { 'efectivo':'Efectivo', 'bre-b':'Bre-B', 'nequi':'Nequi' };
const TYPE_LBL = { recarga:'Recarga', compra:'Compra', ajuste:'Ajuste', reverso:'Reverso' };
const W = { wallets:{}, txns:[], views:{}, user:null, filter:'all', q:'', ov:null, p:{}, stack:[],
            stream:null, scanTimer:null, camSid:0, timer:null, authErr:'', listening:false };

const cloud = () => (typeof cloudOn !== 'undefined' && cloudOn && typeof db !== 'undefined' && db) ? db : null;
const $ = (s, r) => (r || document).querySelector(s);
const money = (n) => formatCOP(n || 0);
const int = (v) => { const n = parseInt(String(v).replace(/\D/g, ''), 10); return isFinite(n) ? n : 0; };
const clean = (o) => { Object.keys(o).forEach(k => { if(o[k] === undefined) delete o[k]; }); return o; };
const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// ---------- persistencia local ----------
function jget(k, d){ try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : d; } catch(e){ return d; } }
function jset(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
function saveLocal(){ jset(LS.w, W.wallets); jset(LS.t, W.txns); jset(LS.v, W.views); }

// ---------- utilidades ----------
function newToken(){
  const b = new Uint8Array(18); crypto.getRandomValues(b);
  let s = ''; b.forEach(x => { s += String.fromCharCode(x); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_');          // 24 caracteres url-safe
}
function rid(n){ const b = new Uint8Array(n); crypto.getRandomValues(b); return Array.from(b, x => (x % 36).toString(36)).join(''); }
function newTxnId(){ return 't_' + Date.now().toString(36) + rid(6); }
function viewUrl(token){ return new URL('view.html?t=' + token, location.href).href; }
function parseScan(txt){
  txt = String(txt || '').trim();
  const m = txt.match(/[?&#]t=([A-Za-z0-9_-]{24})(?![A-Za-z0-9_-])/);
  if(m) return m[1];
  return /^[A-Za-z0-9_-]{24}$/.test(txt) ? txt : null;
}
const byToken = (t) => Object.values(W.wallets).find(w => w.token === t) || null;
const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || '';
const courseShort = (w) => w.type === 'teacher' ? 'Docente' : (GRADE_LABELS[w.grade] || '?');
const courseLong = (w) => w.type === 'teacher' ? 'Docente' : ((GRADE_LABELS[w.grade] || '?') + ' grado');
function fdt(at){
  const d = new Date(at);
  return d.toLocaleDateString('es-CO', { day:'numeric', month:'short' }) + ' ' + d.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' });
}
function dayKeyOf(at){ const d = new Date(at); return dateKey(d.getFullYear(), d.getMonth(), d.getDate()); }
const whoAmI = () => (cloud() && W.user && W.user.email) ? W.user.email : (jget(LS.by, null) || 'Caja demo');
const signedAmt = (t) => t.type === 'compra' ? -t.amount : (t.type === 'recarga' ? t.amount : (t.sign === -1 ? -t.amount : t.amount));
function allWallets(){ return Object.values(W.wallets); }
function sortWallets(list){
  const ord = (w) => w.type === 'teacher' ? 9 : GRADES.indexOf(w.grade);
  return list.slice().sort((a, b) => ord(a) - ord(b) || a.name.localeCompare(b.name, 'es'));
}
function makeWallet(name, type, grade, id){
  return { id: id || ('w_' + rid(10)), name: name, type: type, grade: type === 'teacher' ? null : grade,
           token: newToken(), balance: 0, blocked: false, createdAt: Date.now() };
}

// Reemplaza la lista de data.js en memoria por los monederos (el selector de pedidos usa los mismos ids)
function rebuildLists(force){
  const ws = allWallets();
  if(!ws.length && !force) return;
  const stu = {}; GRADES.forEach(g => { stu[g] = []; });
  const tea = [];
  sortWallets(ws).forEach(w => {
    if(w.type === 'teacher') tea.push({ id:w.id, name:w.name });
    else if(stu[w.grade]) stu[w.grade].push({ id:w.id, name:w.name });
  });
  NAS_DATA.students = stu; NAS_DATA.teachers = tea;
}

// ---------- vista pública (copia de solo lectura para padres) ----------
function buildView(w){
  const last = W.txns.filter(t => t.walletId === w.id).sort((a, b) => b.at - a.at).slice(0, 30)
    .map(t => clean({ at:t.at, type:t.type, amount:signedAmt(t), items:t.items }));
  return clean({ name:firstName(w.name), course:courseShort(w), balance:w.balance, updatedAt:Date.now(), last:last });
}
function writeView(w){
  const v = buildView(w);
  W.views[w.token] = v;
  if(cloud()) cloud().ref('view/' + w.token).set(v).catch(() => {});
  return v;
}

// ---------- movimiento atómico de saldo ----------
const deltaOf = (sp) => sp.type === 'recarga' ? sp.amount : (sp.type === 'compra' ? -sp.amount : (sp.sign === -1 ? -sp.amount : sp.amount));
function nextWallet(w, sp){
  if(!w) return { err:'no-existe' };
  if(w.lastTxn === sp.id) return { dup:true, w:w };                       // idempotencia
  if(!Number.isInteger(sp.amount) || sp.amount <= 0) return { err:'monto' };
  if(sp.type === 'compra' && w.blocked) return { err:'bloqueada' };
  const nb = (w.balance || 0) + deltaOf(sp);
  if(nb < 0) return { err:'saldo' };                                      // nunca saldo negativo
  return { w: Object.assign({}, w, { balance:nb, lastTxn:sp.id }) };
}
function withTimeout(p, ms){ return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]); }

function makeTxn(sp, balanceAfter){
  return clean({ id:sp.id, walletId:sp.walletId, type:sp.type, amount:sp.amount,
    sign: (sp.type === 'ajuste' || sp.type === 'reverso') ? (sp.sign === -1 ? -1 : 1) : undefined,
    balanceAfter:balanceAfter, orderIds:sp.orderIds || [], method:sp.method || null,
    by:sp.by || whoAmI(), at:Date.now(), note:sp.note || '', items:sp.items || undefined });
}
function afterApply(w2, txn){
  W.wallets[w2.id] = w2; W.txns.push(txn); writeView(w2); saveLocal(); refreshUI();
}
async function wApply(sp){
  sp.id = sp.id || newTxnId();
  const c = cloud();
  if(!c){
    const w = W.wallets[sp.walletId];
    const r = nextWallet(w, sp);
    if(r.err) return { ok:false, err:r.err };
    if(r.dup) return { ok:true, dup:true, balance:w.balance };
    const txn = makeTxn(sp, r.w.balance);
    afterApply(r.w, txn);
    return { ok:true, balance:r.w.balance, txn:txn };
  }
  let err = null, dup = false;
  try {
    const res = await withTimeout(c.ref('wallets/' + sp.walletId).transaction(cur => {
      if(cur === null) return cur;                       // aún sin datos locales: Firebase reintenta con el valor real
      const r = nextWallet(cur, sp);
      if(r.err){ err = r.err; return; }
      if(r.dup){ dup = true; return; }
      return r.w;
    }, undefined, false), 9000);
    const val = res.snapshot.val();
    if(!val) return { ok:false, err:'no-existe' };
    if(!res.committed){
      if(dup) return { ok:true, dup:true, balance:val.balance };
      return { ok:false, err: err || 'rechazado' };
    }
    const txn = makeTxn(sp, val.balance);
    afterApply(val, txn);
    let warn = false;
    try { await withTimeout(c.ref('txns/' + sp.id).set(txn), 9000); } catch(e){ warn = true; }
    return { ok:true, balance:val.balance, txn:txn, warn:warn };
  } catch(e){
    return { ok:false, err:'red' };
  }
}
const ERR_MSG = {
  'saldo':'El saldo no alcanza (o cambió). Revisa el saldo e inténtalo de nuevo.',
  'bloqueada':'Este carné está BLOQUEADO. No se puede cobrar.',
  'red':'No se pudo confirmar con el servidor (sin internet?). Revisa el saldo antes de repetir.',
  'no-existe':'La cuenta no existe.', 'monto':'Monto no válido.', 'rechazado':'El servidor rechazó el movimiento.'
};

// ---------- guardado de cuentas ----------
function putWallets(list){
  const c = cloud();
  list.forEach(w => { W.wallets[w.id] = w; writeViewNoCloud(w); });
  if(c){
    const up = {};
    list.forEach(w => { up['wallets/' + w.id] = w; up['view/' + w.token] = W.views[w.token]; });
    c.ref().update(up).catch(() => showToast('No se pudo guardar en la nube'));
  }
  saveLocal(); rebuildLists(true); refreshUI();
}
function writeViewNoCloud(w){ W.views[w.token] = buildView(w); }
function setBlocked(w, val){
  w.blocked = val; W.wallets[w.id] = w; saveLocal();
  if(cloud()) cloud().ref('wallets/' + w.id + '/blocked').set(val).catch(() => {});
  refreshUI();
}
function reissueToken(w){
  const old = w.token; w.token = newToken(); W.wallets[w.id] = w;
  delete W.views[old]; saveLocal();
  if(cloud()){
    const c = cloud();
    c.ref('wallets/' + w.id + '/token').set(w.token).catch(() => {});
    c.ref('view/' + old).remove().catch(() => {});
  }
  writeView(w); saveLocal(); refreshUI();
}

// ---------- QR ----------
function qrModel(text){ const q = qrcode(0, 'M'); q.addData(text); q.make(); return q; }
function qrSvg(text, cls){
  const q = qrModel(text), n = q.getModuleCount(); let d = '';
  for(let r = 0; r < n; r++) for(let c = 0; c < n; c++) if(q.isDark(r, c)) d += 'M' + (c + 4) + ' ' + (r + 4) + 'h1v1h-1z';
  const s = n + 8;
  return `<svg viewBox="0 0 ${s} ${s}" class="${cls || ''}" shape-rendering="crispEdges" role="img" aria-label="Código QR"><rect width="${s}" height="${s}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
function qrToCanvas(text, canvas, px){
  const q = qrModel(text), n = q.getModuleCount(), s = n + 8; px = px || 6;
  canvas.width = canvas.height = s * px;
  const g = canvas.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height); g.fillStyle = '#000';
  for(let r = 0; r < n; r++) for(let c = 0; c < n; c++) if(q.isDark(r, c)) g.fillRect((c + 4) * px, (r + 4) * px, px, px);
  return canvas;
}

// ---------- CSV ----------
function cell(v){
  if(v === null || v === undefined) return '';
  let s = String(v);
  if(typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;      // evita inyección de fórmulas en Excel
  return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
const toCsv = (rows) => '﻿' + rows.map(r => r.map(cell).join(';')).join('\r\n');
function download(name, text){
  const b = new Blob([text], { type:'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2500);
}
async function allTxns(){
  if(cloud()){ try { const s = await withTimeout(cloud().ref('txns').once('value'), 15000); return Object.values(s.val() || {}).sort((a, b) => a.at - b.at); } catch(e){} }
  return W.txns.slice().sort((a, b) => a.at - b.at);
}
async function exportSaldos(){
  const tx = await allTxns(), nameOf = (id) => (W.wallets[id] || {}).name || id;
  const rows = [['SALDOS'], ['Nombre', 'Tipo', 'Curso', 'Saldo', 'Bloqueado', 'Creado']];
  sortWallets(allWallets()).forEach(w => rows.push([w.name, w.type === 'teacher' ? 'docente' : 'estudiante', courseShort(w), w.balance, w.blocked ? 'si' : 'no', new Date(w.createdAt).toISOString()]));
  rows.push([], ['MOVIMIENTOS'], ['Fecha', 'Cuenta', 'Tipo', 'Monto con signo', 'Saldo despues', 'Metodo', 'Cajero', 'Nota']);
  tx.forEach(t => rows.push([new Date(t.at).toISOString(), nameOf(t.walletId), t.type, signedAmt(t), t.balanceAfter, t.method || '', t.by || '', t.note || '']));
  download('munchies-saldos-y-movimientos-' + todayKey() + '.csv', toCsv(rows));
}
function exportVentas(){
  const rows = [['Fecha', 'Persona', 'Tipo', 'Curso', 'Producto', 'Cantidad', 'Sin aguita', 'Total', 'Pagado', 'Abono', 'Debe', 'Entregado', 'Metodo']];
  orders.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)) || (a.createdAt || 0) - (b.createdAt || 0)).forEach(o => {
    const pr = PRODUCTS[o.product || 'slushie'] || {};
    rows.push([o.date, o.personName, o.personType === 'teacher' ? 'docente' : 'estudiante', o.personType === 'teacher' ? 'Docente' : (GRADE_LABELS[o.grade] || ''),
      pr.single || o.product, o.qty, o.sinAgua || 0, orderTotal(o), o.paid ? 'si' : 'no', abonoOf(o), owedOf(o), o.delivered ? 'si' : 'no', o.payMethod || '']);
  });
  download('munchies-ventas-' + todayKey() + '.csv', toCsv(rows));
}

// =====================================================================
// INTERFAZ
// =====================================================================
const CSS = `
.w-demo{display:inline-block; margin-left:8px; padding:1px 8px; border-radius:10px; background:var(--gold); color:#4a3500; font-size:10.5px; font-weight:900; letter-spacing:.8px; vertical-align:middle;}
#ver-tag{display:none !important;}
.bottom-nav{padding-left:2px !important; padding-right:2px !important;}
.nav-item{font-size:11px !important; min-width:0;}
.nav-item span{max-width:100%; overflow:hidden; text-overflow:clip; white-space:nowrap;}
.w-wrap{padding:6px 16px 8px;}
.w-head{display:flex; align-items:center; justify-content:space-between; margin:14px 2px 10px;}
.w-head h1{font-size:28px; font-weight:900; color:var(--title); margin:0;}
.w-tot{display:flex; gap:10px; margin-bottom:12px;}
.w-card{flex:1; min-width:0; background:var(--navy); color:#fff; border-radius:18px; padding:12px 14px;}
.w-card b{display:block; font-size:26px; font-weight:900; color:var(--gold-light); line-height:1.1; overflow-wrap:anywhere;}
.w-card span{font-size:14px; font-weight:700; opacity:.9;}
.w-btn{width:100%; min-height:60px; border-radius:18px; border:none; background:var(--navy); color:#fff; font-size:19px; font-weight:900; display:flex; align-items:center; justify-content:center; gap:8px; padding:10px 14px; text-align:center; box-shadow:var(--shadow-sm); font-family:inherit; cursor:pointer;}
.w-btn:active{transform:scale(.97);}
.w-btn:disabled{background:var(--surface-2); color:var(--muted); box-shadow:none;}
.w-btn.go{background:linear-gradient(135deg,var(--green),#1f6e3b);}
.w-btn.red{background:linear-gradient(135deg,var(--red),var(--red-deep));}
.w-btn.gold{background:var(--gold); color:#3d2c00;}
.w-btn.ghost{background:transparent; color:var(--title); border:2px solid var(--line); box-shadow:none;}
.w-btn svg{width:26px; height:26px;}
.w-cobrar{width:100%; min-height:96px; border-radius:24px; border:none; background:linear-gradient(135deg,var(--red) 0%,var(--red-deep) 100%); color:#fff; font-size:25px; font-weight:900; display:flex; align-items:center; justify-content:center; gap:12px; padding:12px; box-shadow:var(--shadow); font-family:inherit; cursor:pointer; line-height:1.1;}
.w-cobrar:active{transform:scale(.97);}
.w-cobrar svg{width:38px; height:38px; flex-shrink:0;}
.w-calbtn{padding:14px 16px 0;}
.w-two{display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:10px 0;}
.w-in-search{width:100%; min-height:56px; padding:12px 16px; border-radius:16px; border:2px solid var(--line); font-size:19px; background:var(--surface); color:var(--ink); font-family:inherit; margin:6px 0 10px;}
.w-in-search:focus{outline:none; border-color:var(--gold); box-shadow:var(--ring);}
.w-chips{display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px;}
.w-chip{min-height:48px; padding:0 16px; border-radius:24px; border:2px solid var(--line); background:var(--surface); color:var(--title); font-size:17px; font-weight:800; font-family:inherit; cursor:pointer;}
.w-chip.on{background:var(--navy); color:#fff; border-color:var(--navy);}
.w-row{width:100%; display:flex; align-items:center; justify-content:space-between; gap:10px; min-height:68px; padding:10px 14px; margin-bottom:8px; border-radius:18px; background:var(--surface); border:2px solid var(--line); text-align:left; color:var(--ink); font-family:inherit; cursor:pointer; box-shadow:var(--shadow-sm);}
.w-row:active{transform:scale(.98);}
.w-row.blk{border-color:var(--red); background:var(--pay-debe-bg);}
.w-row-l{min-width:0; flex:1;}
.w-nm{font-size:19px; font-weight:800; overflow-wrap:anywhere; line-height:1.15;}
.w-sub{font-size:15px; color:var(--muted); font-weight:700; margin-top:2px;}
.w-sub .bl{color:var(--red); font-weight:900;}
.w-bal{font-size:25px; font-weight:900; color:var(--title); white-space:nowrap;}
.w-row.blk .w-bal{color:var(--red);}
.w-tools{display:grid; gap:10px; margin-top:18px;}
.w-note{font-size:15px; color:var(--muted); text-align:center; margin:10px 0;}
/* pantallas completas */
.w-ov{position:fixed; inset:0; z-index:2000; background:var(--bg); color:var(--ink); overflow-y:auto; overflow-x:hidden; -webkit-overflow-scrolling:touch; padding-top:env(safe-area-inset-top);}
.w-in{max-width:480px; margin:0 auto; padding:10px 16px calc(28px + env(safe-area-inset-bottom));}
.w-back{display:flex; align-items:center; gap:4px; min-height:56px; font-size:19px; font-weight:900; color:var(--title); background:none; border:none; padding:0; font-family:inherit; cursor:pointer;}
.w-back svg{width:26px; height:26px;}
.w-h2{font-size:27px; font-weight:900; color:var(--title); margin:4px 0 12px; overflow-wrap:anywhere; line-height:1.15;}
.w-lbl{font-size:16px; font-weight:900; color:var(--muted); text-transform:uppercase; letter-spacing:.6px; margin:18px 0 8px;}
.w-qrbox{background:#fff; border-radius:20px; padding:8px; width:min(100%,300px); margin:6px auto 12px; box-shadow:var(--shadow-sm);}
.w-qrbox svg{display:block; width:100%; height:auto;}
.w-big{font-size:58px; font-weight:900; color:var(--title); text-align:center; line-height:1.05; margin:4px 0; overflow-wrap:anywhere;}
.w-big.red{color:var(--red);}
.w-big small{display:block; font-size:16px; font-weight:800; color:var(--muted);}
.w-blkbar{background:var(--red); color:#fff; border-radius:16px; padding:12px; text-align:center; font-size:21px; font-weight:900; margin:8px 0;}
.w-grid2{display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:10px 0;}
.w-mv{display:grid; grid-template-columns:1fr auto; gap:2px 10px; padding:10px 4px; border-bottom:1px solid var(--line); font-size:16px;}
.w-mv .d{color:var(--muted); font-size:14px; font-weight:700;}
.w-mv .t{font-weight:800; font-size:18px;}
.w-mv .a{font-weight:900; font-size:20px; text-align:right;}
.w-mv .a.pos{color:var(--pay-ok);} .w-mv .a.neg{color:var(--pay-debe);}
.w-mv .s{color:var(--muted); font-size:14px; text-align:right; font-weight:700;}
.w-mv .n{grid-column:1/-1; font-size:14px; color:var(--muted);}
.w-amts{display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;}
.w-amts .w-chip{min-height:64px; font-size:22px; border-radius:18px;}
.w-input{width:100%; min-height:64px; padding:10px 16px; border-radius:16px; border:2px solid var(--line); font-size:26px; font-weight:800; background:var(--surface); color:var(--ink); font-family:inherit;}
.w-input:focus{outline:none; border-color:var(--gold); box-shadow:var(--ring);}
textarea.w-input{font-size:18px; font-weight:600; min-height:110px; resize:vertical;}
.w-meths{display:grid; grid-template-columns:repeat(3,1fr); gap:8px;}
.w-meths .w-chip{min-height:60px; font-size:17px; border-radius:16px; padding:0 4px;}
.w-ok{background:linear-gradient(135deg,var(--green),#1f6e3b); color:#fff; border-radius:26px; padding:34px 16px; text-align:center; margin:30px 0 16px;}
.w-ok .c{font-size:54px; font-weight:900; line-height:1.1;}
.w-ok .s{font-size:46px; font-weight:900; margin-top:10px; overflow-wrap:anywhere;}
.w-ok .m{font-size:21px; font-weight:800; margin-top:8px; opacity:.95;}
.scr-cobrado{background:var(--green);} .scr-cobrado .w-in{display:flex; flex-direction:column; justify-content:center; min-height:100vh; color:#fff; text-align:center;}
.scr-cobrado .c{font-size:60px; font-weight:900;} .scr-cobrado .s{font-size:50px; font-weight:900; margin-top:12px; overflow-wrap:anywhere;} .scr-cobrado .m{font-size:23px; font-weight:800; margin-top:14px;}
.scr-cobrado .w-btn{margin-top:30px; background:rgba(255,255,255,.2); box-shadow:none; border:2px solid rgba(255,255,255,.7);}
/* cobrar */
.w-who{background:var(--navy); color:#fff; border-radius:22px; padding:14px 16px; text-align:center; margin-bottom:12px;}
.w-who.blk{background:var(--red);}
.w-who .n{font-size:26px; font-weight:900; overflow-wrap:anywhere; line-height:1.1;}
.w-who .c{font-size:18px; font-weight:700; opacity:.9;}
.w-who .b{font-size:54px; font-weight:900; color:var(--gold-light); line-height:1.1; margin-top:4px; overflow-wrap:anywhere;}
.w-who.blk .b{color:#fff; font-size:28px;}
.w-prods{display:grid; grid-template-columns:1fr 1fr; gap:10px;}
.w-prod{background:var(--surface); border:3px solid var(--line); border-radius:20px; padding:8px; display:flex; flex-direction:column; align-items:center; gap:4px; min-width:0;}
.w-prod.on{border-color:var(--green); background:var(--pay-ok-bg);}
.w-prod-main{width:100%; background:none; border:none; display:flex; flex-direction:column; align-items:center; gap:2px; min-height:118px; color:var(--ink); font-family:inherit; cursor:pointer; padding:4px 0;}
.w-prod-main:active{transform:scale(.95);}
.w-prod .prod-ico{width:70px; height:70px;} .w-prod .prod-ico img,.w-prod .prod-ico svg{width:58px; height:58px;} .w-prod .prod-emoji{font-size:40px;}
.w-prod .pn{font-size:18px; font-weight:900; line-height:1.1; text-align:center;}
.w-prod .pp{font-size:17px; font-weight:800; color:var(--muted);}
.w-qty{display:flex; align-items:center; justify-content:space-between; width:100%; gap:6px;}
.w-qty button{width:56px; height:56px; border-radius:50%; border:none; background:var(--navy); color:#fff; font-size:32px; font-weight:900; font-family:inherit; cursor:pointer; line-height:1;}
.w-qty button:disabled{background:var(--surface-2); color:var(--muted);}
.w-qty b{font-size:30px; font-weight:900; min-width:34px; text-align:center;}
.w-sa{display:flex; align-items:center; justify-content:space-between; width:100%; font-size:14px; font-weight:800; color:var(--del-wait); gap:4px;}
.w-sa button{width:48px; height:48px; border-radius:50%; border:2px solid var(--gold-deep); background:var(--del-wait-bg); color:var(--ink); font-size:26px; font-weight:900; font-family:inherit; cursor:pointer; line-height:1;}
.w-foot{position:sticky; bottom:0; background:var(--bg); border-top:2px solid var(--line); padding:10px 0 calc(8px + env(safe-area-inset-bottom)); margin-top:12px; z-index:3;}
.w-line{display:flex; justify-content:space-between; align-items:baseline; gap:8px; font-size:17px; font-weight:800; margin-bottom:4px;}
.w-line b{font-size:26px; font-weight:900; white-space:nowrap;} .w-line b.neg{color:var(--red);}
.w-dlg{position:fixed; inset:0; background:var(--scrim); display:flex; align-items:center; justify-content:center; z-index:5; padding:16px;}
.w-dlg>div{background:var(--bg); border-radius:26px; padding:20px 18px; width:100%; max-width:440px; box-shadow:var(--shadow); max-height:92vh; overflow-y:auto;}
.w-dlg h3{font-size:27px; font-weight:900; margin:0 0 8px; color:var(--title); line-height:1.15;}
.w-dlg p{font-size:19px; font-weight:600; margin:0 0 14px; line-height:1.35;}
.w-dlg .w-btn{margin-top:10px;}
/* escáner */
.scr-scan{background:#000; overflow:hidden; padding-top:0;}
.w-scan{position:absolute; inset:0;}
.w-scan video{position:absolute; inset:0; width:100%; height:100%; object-fit:cover;}
.w-scan-top{position:absolute; top:0; left:0; right:0; display:flex; align-items:center; gap:10px; padding:max(12px,env(safe-area-inset-top)) 12px 12px; background:linear-gradient(#000c,#0000); color:#fff; z-index:2;}
.w-scan-top button{min-height:56px; padding:0 18px; border-radius:28px; border:none; background:rgba(255,255,255,.92); color:#1B3A6B; font-size:19px; font-weight:900; font-family:inherit; cursor:pointer;}
.w-scan-top span{font-size:21px; font-weight:900; text-shadow:0 1px 4px #000;}
.w-frame{position:absolute; left:50%; top:46%; width:min(72vw,300px); aspect-ratio:1; transform:translate(-50%,-50%); border:4px solid var(--gold); border-radius:26px; box-shadow:0 0 0 100vmax rgba(0,0,0,.35); pointer-events:none;}
.w-scan-msg{position:absolute; left:12px; right:12px; bottom:112px; background:rgba(0,0,0,.72); color:#fff; border-radius:18px; padding:12px 14px; font-size:19px; font-weight:800; text-align:center; z-index:2; line-height:1.3;}
.w-scan-msg.bad{background:rgba(200,41,43,.92);}
.w-scan-bot{position:absolute; left:12px; right:12px; bottom:max(16px,env(safe-area-inset-bottom)); z-index:2;}
.w-scan-bot .w-btn{background:var(--gold); color:#3d2c00;}
.w-scan-panel{position:absolute; inset:0; background:var(--bg); z-index:4; overflow-y:auto; padding:max(12px,env(safe-area-inset-top)) 16px 24px;}
.w-scan-panel .w-in{padding:0;}
/* hoja de carnés */
.w-sheet{display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin:10px 0;}
.w-stk{background:#fff; color:#111; border:1px dashed #999; border-radius:8px; padding:5px; text-align:center; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; min-width:0; break-inside:avoid;}
.w-stk svg{width:100%; max-width:100px; height:auto; display:block;}
.w-stk .nm{font-size:12px; font-weight:800; line-height:1.1; margin-top:2px; overflow-wrap:anywhere;}
.w-stk .cs{font-size:10px; font-weight:700; color:#444;}
.w-pick{display:flex; align-items:center; gap:12px; min-height:56px; padding:6px 10px; background:var(--surface); border:2px solid var(--line); border-radius:14px; margin-bottom:6px; width:100%; font-family:inherit; font-size:18px; font-weight:700; color:var(--ink); text-align:left; cursor:pointer;}
.w-pick i{width:30px; height:30px; border-radius:8px; border:3px solid var(--navy); flex-shrink:0; display:flex; align-items:center; justify-content:center; font-style:normal; font-weight:900; color:#fff;}
.w-pick.on i{background:var(--green); border-color:var(--green);}
.w-st{font-size:13px; font-weight:900; padding:2px 8px; border-radius:10px; white-space:nowrap;}
.w-st.ok{background:var(--pay-ok-bg); color:var(--pay-ok);} .w-st.dup{background:var(--del-wait-bg); color:var(--del-wait);} .w-st.err{background:var(--pay-debe-bg); color:var(--pay-debe);}
.w-tbl{width:100%; border-collapse:collapse; font-size:17px;}
.w-tbl td,.w-tbl th{padding:8px 4px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top;}
.w-tbl td:last-child,.w-tbl th:last-child{text-align:right; font-weight:800;}
.w-login{max-width:420px; margin:0 auto; padding:24px 20px; text-align:center;}
.w-login img{width:min(50vw,190px); height:auto;}
.w-login .w-input{margin-bottom:12px; font-size:20px;}
.w-err{color:var(--red); font-weight:800; font-size:17px; min-height:24px; margin:6px 0;}
@media print{
  @page{size:A4; margin:8mm;}
  body>*{display:none !important;}
  body>#w-ov{display:block !important; position:static !important; overflow:visible !important; background:#fff !important; padding:0 !important;}
  #w-ov .w-noprint{display:none !important;}
  #w-ov .w-in{max-width:none; padding:0;}
  .w-page{display:grid !important; grid-template-columns:repeat(6,1fr); grid-auto-rows:34mm; gap:0 !important; margin:0 !important; page-break-after:always; break-after:page;}
  .w-page:last-child{page-break-after:auto; break-after:auto;}
  .w-stk{border:.2mm dashed #888; border-radius:0; padding:1.5mm; height:34mm;}
  .w-stk svg{max-width:25mm;}
  .w-stk .nm{font-size:7.5pt;} .w-stk .cs{font-size:6.5pt;}
}
`;
function injectCss(){
  if(document.getElementById('w-css')) return;
  const s = document.createElement('style'); s.id = 'w-css'; s.textContent = CSS; document.head.appendChild(s);
}

// ---------- ganchos que usa index.html ----------
function walletDemoTag(){ return cloud() ? '' : '<span class="w-demo">DEMO</span>'; }
function walletCobrarBtn(){
  return `<div class="w-calbtn"><button class="w-cobrar" data-w="cobrar">${ICONS.wallet}<span>COBRAR CON CARNÉ</span></button></div>`;
}
function matchFilter(w, f){
  if(f === 'all') return true;
  if(f === 'teacher') return w.type === 'teacher';
  return w.type === 'student' && w.grade === f;
}
function searchWallets(q, f){
  const words = norm(q).split(/\s+/).filter(Boolean);
  return sortWallets(allWallets().filter(w => matchFilter(w, f || 'all') && words.every(x => norm(w.name).includes(x))));
}
function rowHtml(w, act){
  return `<button class="w-row ${w.blocked ? 'blk' : ''}" data-w="${act || 'open'}" data-id="${w.id}">
    <div class="w-row-l"><div class="w-nm">${esc(w.name)}</div><div class="w-sub">${courseLong(w)}${w.blocked ? ' · <span class="bl">BLOQUEADO</span>' : ''}</div></div>
    <div class="w-bal">${money(w.balance)}</div></button>`;
}
function listHtml(){
  const res = searchWallets(W.q, W.filter);
  if(!res.length) return `<div class="empty-state"><p>${allWallets().length ? 'Sin resultados' : 'Aún no hay cuentas'}</p><div class="es-sub">${allWallets().length ? 'Prueba con otro nombre o curso.' : 'Toca “Cargar listas” para crear las cuentas.'}</div></div>`;
  const cut = res.slice(0, 300);
  return cut.map(w => rowHtml(w)).join('') + (res.length > cut.length ? `<div class="w-note">Mostrando ${cut.length} de ${res.length}. Usa el buscador.</div>` : '');
}
function totalsHtml(){
  const ws = allWallets(), tot = ws.reduce((s, w) => s + (w.balance || 0), 0);
  return `<div class="w-card"><span>Dinero en monederos</span><b>${money(tot)}</b></div><div class="w-card"><span>Cuentas</span><b>${ws.length}</b></div>`;
}
function renderWalletView(){
  const chips = [['all', 'Todos']].concat(GRADES.map(g => [g, GRADE_LABELS[g]])).concat([['teacher', 'Docentes']]);
  return `<div class="w-wrap">
    <div class="w-head"><h1>Monedero${walletDemoTag()}</h1></div>
    <div class="w-tot" id="w-tot">${totalsHtml()}</div>
    <button class="w-cobrar" data-w="cobrar">${ICONS.wallet}<span>COBRAR CON CARNÉ</span></button>
    <div class="w-two"><button class="w-btn go" data-w="recharge">${ICONS.plus} Recargar</button><button class="w-btn gold" data-w="print">Hoja de carnés</button></div>
    <input class="w-in-search" id="w-q" data-wi="q" type="search" placeholder="Buscar por nombre…" value="${esc(W.q)}" autocomplete="off" autocapitalize="off">
    <div class="w-chips" id="w-chips">${chips.map(c => `<button class="w-chip ${W.filter === c[0] ? 'on' : ''}" data-w="filter" data-f="${c[0]}">${c[1]}</button>`).join('')}</div>
    <div id="w-list">${listHtml()}</div>
    <div class="w-tools">
      <button class="w-btn ghost" data-w="import">Cargar listas · Exportar año</button>
      <button class="w-btn ghost" data-w="close-day">Cierre del día</button>
      ${cloud() ? '<button class="w-btn ghost" data-w="logout">Cerrar sesión</button>' : ''}
    </div>
  </div>`;
}
function refreshUI(){
  const t = $('#w-tot'); if(t) t.innerHTML = totalsHtml();
  const l = $('#w-list'); if(l) l.innerHTML = listHtml();
  if(W.ov === 'detail' && !W.p.dlg && !(document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName))) renderOv();
}

// ---------- pantallas (overlay) ----------
function ovEl(){
  let o = document.getElementById('w-ov');
  if(!o){ o = document.createElement('div'); o.id = 'w-ov'; document.body.appendChild(o); document.body.style.overflow = 'hidden'; }
  return o;
}
function closeOv(){
  stopCam(); clearTimeout(W.timer); W.ov = null; W.stack = []; W.p = {};
  const o = document.getElementById('w-ov'); if(o) o.remove();
  document.body.style.overflow = '';
  if(typeof render === 'function') render();
}
function setScreen(name, p){
  clearTimeout(W.timer);
  if(name !== 'scan') stopCam();
  W.ov = name; W.p = p || {};
  renderOv(true);
}
function push(name, p){ W.stack.push({ ov:W.ov, p:W.p }); setScreen(name, p); }
function back(){
  if(W.ov === 'login') return;
  const prev = W.stack.pop();
  if(prev) setScreen(prev.ov, prev.p); else closeOv();
}
const cur = () => W.wallets[W.p.wid] || null;
const backBtn = (label) => `<button class="w-back w-noprint" data-w="back">${ICONS.back}<span>${label || 'Volver'}</span></button>`;
const dlgHtml = (d) => !d ? '' : `<div class="w-dlg"><div><h3>${d.t}</h3><p>${d.m}</p>${d.b.map(b => `<button class="w-btn ${b.c || ''}" data-w="${b.w}" ${b.id ? `data-id="${b.id}"` : ''}>${b.l}</button>`).join('')}</div></div>`;

function renderOv(fresh){
  const o = ovEl(), st = fresh ? 0 : o.scrollTop;
  let html = '';
  switch(W.ov){
    case 'scan': html = scanHtml(); break;
    case 'detail': html = detailHtml(); break;
    case 'adjust': html = adjustHtml(); break;
    case 'recharge': html = rechargeHtml(); break;
    case 'recharge-ok': html = rechargeOkHtml(); break;
    case 'charge': html = chargeHtml(); break;
    case 'cobrado': html = cobradoHtml(); break;
    case 'print': html = printHtml(); break;
    case 'import': html = importHtml(); break;
    case 'close': html = closeHtml(); break;
    case 'login': html = loginHtml(); break;
  }
  o.className = 'w-ov scr-' + W.ov;
  o.innerHTML = html;
  o.scrollTop = st;
  if(W.ov === 'scan') startCam();
  if(W.ov === 'cobrado') W.timer = setTimeout(() => { W.stack = []; setScreen('scan', { mode:'cobrar' }); }, W.p.debe ? 2600 : 2000);
}

// ---- Detalle de cuenta ----
function detailHtml(){
  const w = cur(); if(!w) return `<div class="w-in">${backBtn()}<p>Cuenta no encontrada.</p></div>`;
  const mv = W.txns.filter(t => t.walletId === w.id).sort((a, b) => b.at - a.at).slice(0, 60);
  return `<div class="w-in">${backBtn()}
    <div class="w-h2">${esc(w.name)}</div>
    <div class="w-sub" style="font-size:19px;margin-top:-8px;">${courseLong(w)}</div>
    ${w.blocked ? '<div class="w-blkbar">CARNÉ BLOQUEADO</div>' : ''}
    <div class="w-qrbox">${qrSvg(viewUrl(w.token))}</div>
    <div class="w-big ${w.blocked ? 'red' : ''}"><small>SALDO</small>${money(w.balance)}</div>
    <div class="w-grid2">
      <button class="w-btn go" data-w="recharge" data-id="${w.id}">${ICONS.plus} Recargar</button>
      <button class="w-btn red" data-w="charge-this" data-id="${w.id}" ${w.blocked ? 'disabled' : ''}>Cobrar</button>
      <button class="w-btn" data-w="adjust" data-id="${w.id}">Ajustar</button>
      <button class="w-btn ${w.blocked ? 'gold' : 'ghost'}" data-w="block" data-id="${w.id}">${w.blocked ? 'Desbloquear' : 'Bloquear'}</button>
    </div>
    <button class="w-btn ghost" data-w="reissue" data-id="${w.id}">Reimprimir carné</button>
    <div class="w-lbl">Movimientos</div>
    ${mv.length ? mv.map(t => { const a = signedAmt(t); return `<div class="w-mv"><div class="t">${TYPE_LBL[t.type] || t.type}</div><div class="a ${a < 0 ? 'neg' : 'pos'}">${a < 0 ? '−' : '+'}${money(Math.abs(a))}</div>
      <div class="d">${fdt(t.at)}${t.method ? ' · ' + (METHODS[t.method] || t.method) : ''}</div><div class="s">Saldo ${money(t.balanceAfter)}</div>${t.note ? `<div class="n">${esc(t.note)}</div>` : ''}</div>`; }).join('')
      : '<div class="w-note">Sin movimientos todavía.</div>'}
    ${dlgHtml(W.p.dlg)}</div>`;
}
function adjustHtml(){
  const w = cur(), p = W.p, ok = p.amount > 0 && String(p.note || '').trim().length >= 3 && (p.sign === 1 || p.amount <= w.balance);
  return `<div class="w-in">${backBtn()}
    <div class="w-h2">Ajustar saldo</div><div class="w-sub" style="font-size:19px;margin-top:-8px;">${esc(w.name)} · saldo ${money(w.balance)}</div>
    <div class="w-grid2"><button class="w-chip ${p.sign === 1 ? 'on' : ''}" style="min-height:64px;font-size:21px" data-w="adj-sign" data-s="1">+ Sumar</button>
      <button class="w-chip ${p.sign === -1 ? 'on' : ''}" style="min-height:64px;font-size:21px" data-w="adj-sign" data-s="-1">− Restar</button></div>
    <div class="w-lbl">Monto</div><input class="w-input" id="w-adj" data-wi="adj-amt" inputmode="numeric" placeholder="$0" value="${p.amount ? p.amount : ''}">
    <div class="w-lbl">Motivo (obligatorio)</div><textarea class="w-input" id="w-note" data-wi="adj-note" placeholder="Ej.: error al recargar el lunes">${esc(p.note || '')}</textarea>
    ${p.sign === -1 && p.amount > w.balance ? '<div class="w-err">No puede restar más que el saldo.</div>' : ''}
    <div style="height:12px"></div><button class="w-btn go" id="w-adj-go" data-w="adj-go" ${ok ? '' : 'disabled'}>Guardar ajuste</button>
    ${dlgHtml(p.dlg)}</div>`;
}
// ---- Recargar ----
function rechargeHtml(){
  const p = W.p, w = cur();
  if(!w){
    const res = searchWallets(p.q || '', 'all').slice(0, 12);
    return `<div class="w-in">${backBtn()}<div class="w-h2">Recargar: ¿a quién?</div>
      <button class="w-btn gold" data-w="scan-recharge">Escanear carné</button>
      <input class="w-in-search" id="w-rq" data-wi="rq" type="search" placeholder="O buscar por nombre…" value="${esc(p.q || '')}" autocomplete="off">
      <div id="w-rlist">${rcList(res)}</div></div>`;
  }
  const amt = p.amount || 0;
  return `<div class="w-in">${backBtn()}<div class="w-h2">${esc(w.name)}</div>
    <div class="w-sub" style="font-size:19px;margin-top:-8px;">${courseLong(w)} · saldo ${money(w.balance)}</div>
    <div class="w-lbl">Monto</div>
    <div class="w-amts">${[10000, 20000, 50000, 100000].map(a => `<button class="w-chip ${amt === a ? 'on' : ''}" data-w="rc-amt" data-a="${a}">${money(a)}</button>`).join('')}</div>
    <input class="w-input" id="w-rc-amt" data-wi="rc-amt" inputmode="numeric" placeholder="Otro monto" value="${amt ? amt : ''}">
    <div class="w-lbl">¿Cómo pagó?</div>
    <div class="w-meths">${Object.keys(METHODS).map(m => `<button class="w-chip ${p.method === m ? 'on' : ''}" data-w="rc-method" data-m="${m}">${METHODS[m]}</button>`).join('')}</div>
    <div style="height:16px"></div>
    <button class="w-btn go" id="w-rc-go" data-w="rc-go" ${amt > 0 && p.method ? '' : 'disabled'}>Recargar ${amt > 0 ? money(amt) : ''}</button>
    ${p.err ? `<div class="w-err">${p.err}</div>` : ''}
    ${dlgHtml(p.dlg)}</div>`;
}
const rcList = (res) => res.length ? res.map(w => rowHtml(w, 'rc-pick')).join('') : '<div class="w-note">Sin resultados.</div>';
function rechargeOkHtml(){
  const p = W.p;
  return `<div class="w-in"><div class="w-ok"><div class="c">✓ Recargado</div><div class="s">Saldo nuevo ${money(p.bal)}</div><div class="m">${esc(p.name)} · ${money(p.amount)} · ${METHODS[p.method]}</div></div>
    <button class="w-btn go" data-w="rc-again">Otra recarga</button><div style="height:10px"></div>
    <button class="w-btn ghost" data-w="close-ov">Listo</button></div>`;
}

// ---- COBRAR (escáner + productos) ----
function scanHtml(){
  return `<div class="w-scan"><video id="w-video" playsinline muted autoplay></video><canvas id="w-cv" hidden></canvas>
    <div class="w-scan-top"><button data-w="back">‹ Cerrar</button><span>${W.p.mode === 'recharge' ? 'Escanear para recargar' : 'Apunta al carné'}</span></div>
    <div class="w-frame"></div>
    <div class="w-scan-msg" id="w-scan-msg">Iniciando cámara…</div>
    <div class="w-scan-bot"><button class="w-btn" data-w="scan-search">Buscar por nombre</button></div>
    <div class="w-scan-panel" id="w-scan-panel" hidden></div></div>`;
}
function scanMsg(t, bad){ const m = $('#w-scan-msg'); if(m){ m.textContent = t; m.classList.toggle('bad', !!bad); } }
function camHelp(kind){
  const base = kind === 'NotAllowedError' || kind === 'SecurityError'
    ? 'No hay permiso para usar la cámara. En iPhone: Ajustes › Safari › Cámara › Permitir (o toca “aA” en la barra de Safari › Ajustes del sitio web › Cámara › Permitir). Si usas la app instalada: Ajustes › Munchies › Cámara. Luego vuelve a abrir esta pantalla.'
    : (kind === 'nosup' ? 'Este navegador no permite usar la cámara aquí (hace falta HTTPS).' : 'No se pudo abrir la cámara (' + kind + '). Revisa que ninguna otra app la esté usando.');
  return base + ' Mientras tanto puedes buscar por nombre.';
}
async function startCam(){
  stopCam(); const sid = ++W.camSid;
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ scanMsg(camHelp('nosup'), true); openScanSearch(camHelp('nosup')); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment' }, audio:false });
    if(sid !== W.camSid || W.ov !== 'scan'){ stream.getTracks().forEach(t => t.stop()); return; }
    W.stream = stream;
    const v = $('#w-video'); v.srcObject = stream; v.setAttribute('playsinline', ''); v.muted = true;
    try { await v.play(); } catch(e){}
    scanMsg('Acerca el código QR del carné al recuadro');
    W.scanTimer = setInterval(tick, 110);                                 // ~9 lecturas por segundo
  } catch(e){
    if(sid !== W.camSid) return;
    scanMsg(camHelp(e && e.name || 'error'), true); openScanSearch(camHelp(e && e.name || 'error'));
  }
}
function stopCam(){
  W.camSid++;
  if(W.scanTimer){ clearInterval(W.scanTimer); W.scanTimer = null; }
  if(W.stream){ W.stream.getTracks().forEach(t => t.stop()); W.stream = null; }
  const v = $('#w-video'); if(v) v.srcObject = null;
}
let _cv = null, _busy = false, _lastBad = 0;
function tick(){
  const v = $('#w-video'); if(!v || v.readyState < 2 || !v.videoWidth || _busy) return;
  const sc = Math.min(1, 480 / v.videoWidth), w = Math.round(v.videoWidth * sc), h = Math.round(v.videoHeight * sc);
  _cv = _cv || document.createElement('canvas'); _cv.width = w; _cv.height = h;
  const g = _cv.getContext('2d', { willReadFrequently:true }); g.drawImage(v, 0, 0, w, h);
  const img = g.getImageData(0, 0, w, h);
  const code = jsQR(img.data, w, h, { inversionAttempts:'dontInvert' });
  if(code && code.data) onScan(code.data);
}
function onScan(text){
  const tok = parseScan(text), w = tok && byToken(tok);
  if(!w){
    if(Date.now() - _lastBad > 2500){ _lastBad = Date.now(); scanMsg('Carné no reconocido o anulado. Prueba de nuevo o busca por nombre.', true); }
    return { ok:false };
  }
  if(navigator.vibrate) try { navigator.vibrate(60); } catch(e){}
  pickWallet(w);
  return { ok:true, wallet:w };
}
function pickWallet(w){
  if(W.ov === 'scan' && W.p.mode === 'recharge'){
    const prev = W.stack.pop();
    setScreen('recharge', { wid:w.id, amount:0, method:null, from:(prev && prev.p && prev.p.from) || null });
  } else {
    push('charge', { wid:w.id, cart:{}, txnId:newTxnId() });
  }
}
function openScanSearch(msg){
  const pnl = $('#w-scan-panel'); if(!pnl) return;
  pnl.hidden = false;
  pnl.innerHTML = `<div class="w-in"><button class="w-back" data-w="scan-search-close">${ICONS.back}<span>Volver a la cámara</span></button>
    <div class="w-h2">Buscar por nombre</div>
    ${msg ? `<div class="w-blkbar" style="font-size:16px;text-align:left;line-height:1.35">${esc(msg)}</div>` : ''}
    <input class="w-in-search" id="w-sq" data-wi="sq" type="search" placeholder="Nombre del estudiante o docente…" autocomplete="off">
    <div id="w-slist">${rcList(searchWallets('', 'all').slice(0, 12))}</div></div>`;
}
function chargeHtml(){
  const w = cur(), p = W.p;
  if(!w) return `<div class="w-in">${backBtn()}<p>Cuenta no encontrada.</p></div>`;
  const who = `<div class="w-who ${w.blocked ? 'blk' : ''}"><div class="n">${esc(w.name)}</div><div class="c">${courseLong(w)}</div>
    <div class="b">${w.blocked ? 'CARNÉ BLOQUEADO' : money(w.balance)}</div>${w.blocked ? '<div class="c" style="font-size:20px;font-weight:900">No se puede cobrar</div>' : '<div class="c">saldo</div>'}</div>`;
  if(w.blocked) return `<div class="w-in">${backBtn('Escanear otro')}${who}<button class="w-btn ghost" data-w="back">Volver</button>${dlgHtml(p.dlg)}</div>`;
  const total = cartTotal(), after = w.balance - total;
  const tiles = PR.filter(k => PRODUCTS[k]).map(k => {
    const it = p.cart[k] || { q:0, s:0 }, d = PRODUCTS[k];
    return `<div class="w-prod ${it.q ? 'on' : ''}">
      <button class="w-prod-main" data-w="p-add" data-p="${k}" aria-label="Agregar ${esc(d.single)}">${prodIcon(k)}<span class="pn">${esc(k === 'agua' ? 'Aguita' : d.label)}</span><span class="pp">${money(d.price)}</span></button>
      <div class="w-qty"><button data-w="p-dec" data-p="${k}" ${it.q ? '' : 'disabled'} aria-label="Quitar">−</button><b>${it.q}</b><button data-w="p-add" data-p="${k}" aria-label="Agregar">+</button></div>
      ${d.aguaIncl && it.q ? `<div class="w-sa"><span>Sin aguita: ${it.s || 0}</span><span style="display:flex;gap:4px"><button data-w="sa-dec" data-p="${k}" aria-label="Menos sin aguita">−</button><button data-w="sa-inc" data-p="${k}" aria-label="Más sin aguita">+</button></span></div>` : ''}
    </div>`; }).join('');
  return `<div class="w-in">${backBtn('Escanear otro')}${who}<div class="w-prods">${tiles}</div>
    <div class="w-foot"><div class="w-line"><span>Total</span><b>${money(total)}</b></div>
      <div class="w-line"><span>Saldo después de la compra</span><b class="${after < 0 ? 'neg' : ''}">${after < 0 ? '−' + money(-after) : money(after)}</b></div>
      <button class="w-btn go" data-w="charge-go" ${total > 0 ? '' : 'disabled'}>Cobrar ${total > 0 ? money(total) : ''}</button></div>
    ${dlgHtml(p.dlg)}</div>`;
}
function cartItems(){
  const c = W.p.cart || {}, out = [];
  PR.forEach(k => { const it = c[k]; if(PRODUCTS[k] && it && it.q > 0) out.push({ product:k, qty:it.q, sinAgua:Math.min(it.s || 0, it.q) }); });
  return out;
}
const cartTotal = () => cartItems().reduce((t, i) => t + orderTotal({ product:i.product, qty:i.qty, sinAgua:i.sinAgua }), 0);
function recentDup(wid, amount){
  const now = Date.now();
  return W.txns.find(t => t.walletId === wid && t.type === 'compra' && t.amount === amount && now - t.at < 15000) || null;
}
async function runCharge(mode){
  const p = W.p; if(p.busy) return;
  const w = cur(), items = cartItems(), total = cartTotal(); if(!w || !total) return;
  const amount = mode === 'full' ? total : (mode === 'part' ? w.balance : 0);
  if(amount > 0 && !p.okDup){
    const d = recentDup(w.id, amount);
    if(d){
      p.pending = mode;
      p.dlg = { t:'¿Cobrar otra vez?', m:`Este carné ya pagó ${money(amount)} hace ${Math.max(1, Math.round((Date.now() - d.at) / 1000))} segundos. ¿Seguro que es otra compra?`,
        b:[{ l:'Sí, cobrar otra vez', w:'dup-yes', c:'red' }, { l:'No, cancelar', w:'dlg-close', c:'ghost' }] };
      renderOv(); return;
    }
  }
  p.busy = true; p.dlg = null;
  const base = uid(), orderIds = items.map((_, i) => base + '_' + i);
  const text = items.map(i => (PRODUCTS[i.product].single) + ' ×' + i.qty).join(', ').slice(0, 90);
  let res = null;
  if(amount > 0){
    res = await wApply({ id:p.txnId, walletId:w.id, type:'compra', amount:amount, orderIds:orderIds, items:text, note:'Compra en caja' });
    if(!res.ok){
      p.busy = false;
      p.dlg = { t:'No se cobró', m:ERR_MSG[res.err] || 'Error.', b:[{ l:'Entendido', w:'dlg-close', c:'red' }] };
      renderOv(); return;
    }
  }
  let rest = res ? amount : 0;                                            // lo que se cubre con saldo, repartido entre los pedidos
  const now = Date.now();
  items.forEach((it, i) => {
    const o = { id:orderIds[i], date:todayKey(), product:it.product, personId:w.id, personName:w.name, personType:w.type, grade:w.grade || null,
      qty:it.qty, delivered:true, deliveredAt:now, createdAt:now, walletId:w.id, txnId:p.txnId };
    if(it.sinAgua > 0) o.sinAgua = it.sinAgua;
    const tot = orderTotal(o), pay = Math.min(tot, rest); rest -= pay;
    if(pay >= tot){ o.paid = true; o.paidAt = now; o.payMethod = 'monedero'; }
    else { o.paid = false; o.paidAt = null; if(pay > 0){ o.abono = pay; o.payMethod = 'monedero'; } }
    upsertOrder(o);
  });
  const bal = res ? res.balance : w.balance;
  setScreen('cobrado', { name:w.name, bal:bal, debe:total - amount });
}
function cobradoHtml(){
  const p = W.p;
  return `<div class="w-in"><div class="c">✓ ${p.debe > 0 ? 'Anotado' : 'Cobrado'}</div><div class="s">Saldo ${money(p.bal)}</div>
    <div class="m">${esc(p.name)}${p.debe > 0 ? ' · Quedó debiendo ' + money(p.debe) : ''}</div>
    <button class="w-btn" data-w="again">Escanear otro carné</button></div>`;
}

// ---- Hoja de carnés ----
function printList(){
  const p = W.p;
  if(p.group === 'sel') return sortWallets(allWallets().filter(w => p.sel && p.sel[w.id]));
  if(p.group === 'all') return sortWallets(allWallets());
  if(p.group === 'teacher') return sortWallets(allWallets().filter(w => w.type === 'teacher'));
  return sortWallets(allWallets().filter(w => w.type === 'student' && w.grade === p.group));
}
function printHtml(){
  const p = W.p, list = printList();
  const groups = [['all', 'Todos'], ...GRADES.map(g => [g, GRADE_LABELS[g]]), ['teacher', 'Docentes'], ['sel', 'Seleccionados']];
  const pages = []; for(let i = 0; i < list.length; i += 48) pages.push(list.slice(i, i + 48));
  return `<div class="w-in">${backBtn()}<div class="w-noprint"><div class="w-h2">Hoja de carnés</div>
    <div class="w-chips">${groups.map(g => `<button class="w-chip ${p.group === g[0] ? 'on' : ''}" data-w="pgroup" data-g="${g[0]}">${g[1]}</button>`).join('')}</div>
    ${p.group === 'sel' ? `<div style="margin-bottom:10px">${sortWallets(allWallets()).map(w => `<button class="w-pick ${p.sel && p.sel[w.id] ? 'on' : ''}" data-w="psel" data-id="${w.id}"><i>${p.sel && p.sel[w.id] ? '✓' : ''}</i><span>${esc(w.name)} · ${courseShort(w)}</span></button>`).join('')}</div>` : ''}
    <button class="w-btn go" data-w="do-print" ${list.length ? '' : 'disabled'}>Imprimir ${list.length} carné${list.length === 1 ? '' : 's'}</button>
    <div class="w-note">Hoja A4: 6 × 8 carnés por página. Recorta por las líneas punteadas.</div></div>
    ${pages.map(pg => `<div class="w-sheet w-page">${pg.map(w => `<div class="w-stk">${qrSvg(viewUrl(w.token))}<div class="nm">${esc(w.name)}</div><div class="cs">${courseShort(w)} · Munchies NAS</div></div>`).join('')}</div>`).join('')}
  </div>`;
}

// ---- Cargar listas ----
function parseGrade(s){
  const t = norm(s), m = t.match(/[1-5]/);
  if(m) return GRADES[parseInt(m[0], 10) - 1];
  const words = ['primero', 'segundo', 'tercero', 'cuarto', 'quinto'];
  const i = words.findIndex(x => t.startsWith(x.slice(0, 5)));
  return i >= 0 ? GRADES[i] : null;
}
function parseList(text){
  const seen = new Set(allWallets().map(w => norm(w.name) + '|' + w.type + '|' + (w.grade || '')));
  const rows = [];
  String(text || '').split(/\r?\n/).forEach(line => {
    line = line.trim(); if(!line) return;
    const sep = /[;\t]/.test(line) ? /[;\t]/ : ',';
    const parts = line.split(sep).map(x => x.trim());
    if(!rows.length && /nombre/i.test(parts[0]) && /tipo/i.test(parts[1] || '')) return;       // encabezado
    const name = (parts[0] || '').replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').slice(0, 60);
    const tt = norm(parts[1] || ''), type = tt.startsWith('d') ? 'teacher' : (tt.startsWith('e') ? 'student' : null);
    const grade = type === 'student' ? parseGrade(parts[2] || '') : null;
    let st = 'ok', why = '';
    if(name.length < 3){ st = 'err'; why = 'nombre'; }
    else if(!type){ st = 'err'; why = 'tipo'; }
    else if(type === 'student' && !grade){ st = 'err'; why = 'curso'; }
    else {
      const key = norm(name) + '|' + type + '|' + (grade || '');
      if(seen.has(key)){ st = 'dup'; why = 'repetido'; } else seen.add(key);
    }
    rows.push({ name:name, type:type, grade:grade, st:st, why:why });
  });
  return rows;
}
const SAMPLE = 'Estudiante Demo 20;estudiante;1\nEstudiante Demo 21;estudiante;3\nDocente Demo 10;docente;\nEstudiante Demo 01;estudiante;1';
function importHtml(){
  const p = W.p, rows = p.rows, okn = rows ? rows.filter(r => r.st === 'ok').length : 0;
  return `<div class="w-in">${backBtn()}<div class="w-h2">Cargar listas</div>
    <div class="w-note" style="text-align:left">Pega una línea por persona: <b>nombre;tipo;curso</b><br>tipo = estudiante o docente · curso = 1 a 5</div>
    <textarea class="w-input" id="w-imp" data-wi="imp" style="min-height:170px;font-size:17px" placeholder="Estudiante Demo 20;estudiante;1">${esc(p.text || '')}</textarea>
    <div class="w-grid2"><button class="w-btn" data-w="imp-prev">Ver vista previa</button><button class="w-btn ghost" data-w="imp-sample">Ejemplo</button></div>
    ${rows ? `<div class="w-lbl">Vista previa · ${okn} nuevas</div>
      ${rows.length ? `<table class="w-tbl">${rows.map(r => `<tr><td>${esc(r.name)}<br><span class="w-sub">${r.type === 'teacher' ? 'Docente' : (r.grade ? GRADE_LABELS[r.grade] + ' grado' : '—')}</span></td>
        <td><span class="w-st ${r.st}">${r.st === 'ok' ? 'Nueva' : (r.st === 'dup' ? 'Repetida' : 'Revisar ' + r.why)}</span></td></tr>`).join('')}</table>` : '<div class="w-note">No hay líneas.</div>'}
      <div style="height:12px"></div><button class="w-btn go" data-w="imp-go" ${okn ? '' : 'disabled'}>Crear ${okn} cuenta${okn === 1 ? '' : 's'} (saldo $0)</button>
      <div class="w-note">Las repetidas y con errores no se crean. No se borra nada de lo existente.</div>` : ''}
    <div class="w-lbl">Archivar el año</div>
    <button class="w-btn gold" data-w="exp-saldos">Exportar saldos y movimientos (CSV)</button><div style="height:10px"></div>
    <button class="w-btn gold" data-w="exp-ventas">Exportar ventas (CSV)</button>
    ${dlgHtml(p.dlg)}</div>`;
}

// ---- Cierre del día ----
function closeData(day){
  const tx = W.txns.filter(t => dayKeyOf(t.at) === day), sum = (l) => l.reduce((s, t) => s + t.amount, 0);
  const rec = tx.filter(t => t.type === 'recarga'), com = tx.filter(t => t.type === 'compra');
  const aj = tx.filter(t => t.type === 'ajuste' || t.type === 'reverso');
  const od = orders.filter(o => o.date === day);
  const byM = {}; Object.keys(METHODS).forEach(m => { byM[m] = rec.filter(t => t.method === m); });
  const cashiers = {};
  tx.forEach(t => { const c = cashiers[t.by || '—'] = cashiers[t.by || '—'] || { rec:0, com:0, n:0 }; c.n++; if(t.type === 'recarga') c.rec += t.amount; if(t.type === 'compra') c.com += t.amount; });
  return { rec, com, aj, byM, cashiers, recTot:sum(rec), comTot:sum(com),
    ajNet: aj.reduce((s, t) => s + signedAmt(t), 0),
    ventasPag: od.filter(o => o.payMethod !== 'monedero').reduce((s, o) => s + paidOf(o), 0),
    debe: od.reduce((s, o) => s + owedOf(o), 0), pedidos: od.length,
    enMonederos: allWallets().reduce((s, w) => s + (w.balance || 0), 0) };
}
function shiftDay(day, n){ const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() + n); return dayKeyOf(d.getTime()); }
function closeHtml(){
  const day = W.p.day, d = closeData(day), lab = new Date(day + 'T12:00:00').toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long' });
  const line = (k, v, big) => `<tr><td>${k}</td><td${big ? ' style="font-size:20px"' : ''}>${v}</td></tr>`;
  return `<div class="w-in">${backBtn()}<div class="w-h2">Cierre del día</div>
    <div class="w-grid2" style="grid-template-columns:64px 1fr 64px;align-items:center"><button class="w-chip" style="min-height:56px" data-w="day-prev">‹</button><div style="text-align:center;font-weight:900;font-size:19px;text-transform:capitalize">${lab}</div><button class="w-chip" style="min-height:56px" data-w="day-next">›</button></div>
    <div class="w-lbl">Recargas por método</div><table class="w-tbl">${Object.keys(METHODS).map(m => line(METHODS[m] + ' (' + d.byM[m].length + ')', money(d.byM[m].reduce((s, t) => s + t.amount, 0)))).join('')}${line('<b>Total recargas</b>', money(d.recTot), true)}</table>
    <div class="w-lbl">Compras con monedero</div><table class="w-tbl">${line('Compras (' + d.com.length + ')', money(d.comTot), true)}${line('Ajustes (neto)', money(d.ajNet))}</table>
    <div class="w-lbl">Ventas fuera del monedero</div><table class="w-tbl">${line('Pedidos del día', d.pedidos)}${line('Pagado (efectivo/otros)', money(d.ventasPag))}${line('Quedó debiendo', money(d.debe))}</table>
    <div class="w-lbl">Dinero total en monederos</div><div class="w-big">${money(d.enMonederos)}</div>
    <div class="w-lbl">Por cajero</div>
    ${Object.keys(d.cashiers).length ? `<table class="w-tbl"><tr><th>Cajero</th><th>Recargas / Compras</th></tr>${Object.keys(d.cashiers).map(k => `<tr><td>${esc(k)}</td><td>${money(d.cashiers[k].rec)}<br><span class="w-sub">${money(d.cashiers[k].com)}</span></td></tr>`).join('')}</table>` : '<div class="w-note">Sin movimientos.</div>'}
    <div style="height:14px"></div><button class="w-btn gold" data-w="exp-cierre">Exportar CSV del día</button></div>`;
}
function exportCierre(){
  const day = W.p.day, d = closeData(day), rows = [['Cierre del dia', day], [], ['Recargas por metodo', 'Cantidad', 'Total']];
  Object.keys(METHODS).forEach(m => rows.push([METHODS[m], d.byM[m].length, d.byM[m].reduce((s, t) => s + t.amount, 0)]));
  rows.push(['Total recargas', d.rec.length, d.recTot], ['Compras con monedero', d.com.length, d.comTot], ['Ajustes neto', d.aj.length, d.ajNet],
    ['Ventas pagadas fuera del monedero', d.pedidos, d.ventasPag], ['Debe', '', d.debe], ['Dinero total en monederos', '', d.enMonederos], [], ['Cajero', 'Recargas', 'Compras', 'Movimientos']);
  Object.keys(d.cashiers).forEach(k => rows.push([k, d.cashiers[k].rec, d.cashiers[k].com, d.cashiers[k].n]));
  download('munchies-cierre-' + day + '.csv', toCsv(rows));
}

// ---- Inicio de sesión (modo nube) ----
function loginHtml(){
  return `<div class="w-login"><img src="logo-munchies.png" alt="Munchies" onerror="this.style.display='none'">
    <div class="w-h2" style="margin-top:10px">Carné Munchies · Caja</div>
    <input class="w-input" id="w-em" type="email" autocomplete="username" autocapitalize="none" placeholder="Correo" inputmode="email">
    <input class="w-input" id="w-pw" type="password" autocomplete="current-password" placeholder="Clave">
    <div class="w-err" id="w-lerr">${esc(W.authErr || '')}</div>
    <button class="w-btn go" data-w="login-go">Entrar</button>
    ${W.authErr ? '<div style="height:10px"></div><button class="w-btn ghost" data-w="logout">Cerrar sesión</button>' : ''}</div>`;
}
async function doLogin(){
  const em = ($('#w-em') || {}).value, pw = ($('#w-pw') || {}).value, er = $('#w-lerr');
  if(!em || !pw){ if(er) er.textContent = 'Escribe el correo y la clave.'; return; }
  if(er) er.textContent = 'Entrando…';
  try { await firebase.auth().signInWithEmailAndPassword(em.trim(), pw); }
  catch(e){
    const c = (e && e.code) || '';
    const msg = /network/.test(c) ? 'Sin internet. Inténtalo de nuevo.' : (/too-many/.test(c) ? 'Demasiados intentos. Espera unos minutos.' : 'Correo o clave incorrectos.');
    const el = $('#w-lerr'); if(el) el.textContent = msg;
  }
}

// ---------- nube: sesión + escuchas ----------
function stopListeners(){
  const c = cloud(); if(!c) return;
  try { c.ref('wallets').off(); c.ref('txns').off(); c.ref('orders').off(); } catch(e){}
  W.listening = false;
}
function startListeners(startOrders){
  const c = cloud(); if(!c || W.listening) return; W.listening = true;
  const onErr = (e) => { W.authErr = 'Tu usuario no está autorizado en /staff (o no hay conexión). Pide que registren tu UID: ' + (W.user ? W.user.uid : ''); setScreen('login', {}); };
  c.ref('wallets').on('value', s => { W.wallets = s.val() || {}; rebuildLists(true); saveLocal(); refreshUI(); }, onErr);
  c.ref('txns').orderByChild('at').limitToLast(3000).on('value', s => { W.txns = Object.values(s.val() || {}).sort((a, b) => a.at - b.at); saveLocal(); refreshUI(); }, () => {});
  startOrders();
}
function walletCloudStart(startOrders){
  if(typeof firebase === 'undefined' || !firebase.auth){ W.authErr = 'No se pudo cargar el inicio de sesión (¿sin internet?).'; setScreen('login', {}); return; }
  firebase.auth().onAuthStateChanged(u => {
    if(u){ W.user = u; W.authErr = ''; if(W.ov === 'login') closeOv(); startListeners(startOrders); }
    else { W.user = null; stopListeners(); setScreen('login', {}); }
  });
}
async function logout(){
  try { stopListeners(); if(typeof firebase !== 'undefined' && firebase.auth) await firebase.auth().signOut(); } catch(e){}
  try { localStorage.removeItem(LS.w); localStorage.removeItem(LS.t); localStorage.removeItem(LS.v); localStorage.removeItem(STORAGE_KEY); } catch(e){}
  location.reload();
}

// ---------- acciones ----------
function setAmtInput(id, v){ const el = document.getElementById(id); if(el && String(el.value) !== String(v)) el.value = v; }
function updateRcGo(){
  const b = $('#w-rc-go'); if(!b) return; const a = W.p.amount || 0;
  b.disabled = !(a > 0 && W.p.method); b.textContent = 'Recargar ' + (a > 0 ? money(a) : '');
  document.querySelectorAll('[data-w="rc-amt"]').forEach(x => x.classList.toggle('on', int(x.dataset.a) === a));
}
function updateAdjGo(){
  const w = cur(), p = W.p, b = $('#w-adj-go'); if(!b || !w) return;
  b.disabled = !(p.amount > 0 && String(p.note || '').trim().length >= 3 && (p.sign === 1 || p.amount <= w.balance));
}
async function act(name, el){
  const id = el && el.dataset ? el.dataset.id : null, p = W.p;
  switch(name){
    case 'cobrar': W.stack = []; setScreen('scan', { mode:'cobrar' }); break;
    case 'back': back(); break;
    case 'close-ov': closeOv(); break;
    case 'filter': W.filter = el.dataset.f; { const c = $('#w-chips'); if(c) c.querySelectorAll('.w-chip').forEach(x => x.classList.toggle('on', x.dataset.f === W.filter)); const l = $('#w-list'); if(l) l.innerHTML = listHtml(); } break;
    case 'open': W.stack = []; setScreen('detail', { wid:id }); break;
    case 'recharge': W.stack = []; setScreen('recharge', { wid:id || null, amount:0, method:null, q:'', from:id ? 'detail' : null }); break;
    case 'rc-pick': setScreen('recharge', { wid:id, amount:0, method:null, from:p.from }); break;
    case 'scan-recharge': push('scan', { mode:'recharge' }); break;
    case 'scan-search': openScanSearch(); break;
    case 'scan-search-close': { const pn = $('#w-scan-panel'); if(pn) pn.hidden = true; } break;
    case 'rc-amt': p.amount = int(el.dataset.a); renderOv(); break;
    case 'rc-method': p.method = el.dataset.m; renderOv(); break;
    case 'rc-go': {
      const w = cur(); if(!w || !(p.amount > 0) || !p.method) break;
      p.dlg = { t:'¿Recargar ' + money(p.amount) + '?', m:`A <b>${esc(w.name)}</b> · pagó por <b>${METHODS[p.method]}</b>.<br>Saldo nuevo: <b>${money(w.balance + p.amount)}</b>`,
        b:[{ l:'Sí, recargar', w:'rc-ok', c:'go' }, { l:'Cancelar', w:'dlg-close', c:'ghost' }] };
      renderOv(); break; }
    case 'rc-ok': {
      if(p.busy) break; p.busy = true; const w = cur();
      const r = await wApply({ id:p.txnId || (p.txnId = newTxnId()), walletId:w.id, type:'recarga', amount:p.amount, method:p.method, note:'Recarga en caja' });
      p.busy = false;
      if(!r.ok){ p.dlg = { t:'No se recargó', m:ERR_MSG[r.err] || 'Error.', b:[{ l:'Entendido', w:'dlg-close', c:'red' }] }; renderOv(); break; }
      setScreen('recharge-ok', { name:w.name, bal:r.balance, amount:p.amount, method:p.method, from:p.from, wid:w.id }); break; }
    case 'rc-again': setScreen('recharge', { wid:null, amount:0, method:null, q:'', from:null }); break;
    case 'dlg-close': p.dlg = null; renderOv(); break;
    case 'charge-this': { const w = W.wallets[id]; if(w && !w.blocked) push('charge', { wid:id, cart:{}, txnId:newTxnId() }); break; }
    case 'p-add': { const it = p.cart[el.dataset.p] = p.cart[el.dataset.p] || { q:0, s:0 }; it.q = Math.min(99, it.q + 1); renderOv(); break; }
    case 'p-dec': { const it = p.cart[el.dataset.p]; if(it && it.q > 0){ it.q--; it.s = Math.min(it.s || 0, it.q); renderOv(); } break; }
    case 'sa-inc': { const it = p.cart[el.dataset.p]; if(it) it.s = Math.min(it.q, (it.s || 0) + 1); renderOv(); break; }
    case 'sa-dec': { const it = p.cart[el.dataset.p]; if(it) it.s = Math.max(0, (it.s || 0) - 1); renderOv(); break; }
    case 'charge-go': {
      const w = cur(), total = cartTotal(); if(!w || !total) break;
      if(w.balance >= total){ runCharge('full'); break; }
      const falta = total - w.balance, b = [];
      if(w.balance > 0) b.push({ l:`Descontar ${money(w.balance)} del saldo y quedar debiendo ${money(falta)}`, w:'charge-part', c:'gold' });
      b.push({ l:'Anotar todo como Debe', w:'charge-debe', c:'red' }, { l:'Cancelar', w:'dlg-close', c:'ghost' });
      p.dlg = { t:'Saldo insuficiente', m:`Saldo: <b>${money(w.balance)}</b><br>Compra: <b>${money(total)}</b><br>Faltan: <b>${money(falta)}</b>`, b:b };
      renderOv(); break; }
    case 'charge-part': p.dlg = null; runCharge('part'); break;
    case 'charge-debe': p.dlg = null; runCharge('debe'); break;
    case 'dup-yes': p.okDup = true; p.dlg = null; runCharge(p.pending || 'full'); break;
    case 'again': W.stack = []; setScreen('scan', { mode:'cobrar' }); break;
    case 'adjust': push('adjust', { wid:id, sign:1, amount:0, note:'' }); break;
    case 'adj-sign': p.sign = el.dataset.s === '-1' ? -1 : 1; renderOv(); break;
    case 'adj-go': {
      const w = cur(); if(!w) break;
      p.dlg = { t:'¿Aplicar ajuste?', m:`${p.sign === 1 ? 'Sumar' : 'Restar'} <b>${money(p.amount)}</b> a ${esc(w.name)}.<br>Saldo nuevo: <b>${money(w.balance + p.sign * p.amount)}</b>`, b:[{ l:'Sí, aplicar', w:'adj-ok', c:'go' }, { l:'Cancelar', w:'dlg-close', c:'ghost' }] };
      renderOv(); break; }
    case 'adj-ok': {
      if(p.busy) break; p.busy = true; const w = cur();
      const r = await wApply({ id:p.txnId || (p.txnId = newTxnId()), walletId:w.id, type:'ajuste', sign:p.sign, amount:p.amount, note:String(p.note).trim().slice(0, 200) });
      p.busy = false;
      if(!r.ok){ p.dlg = { t:'No se aplicó', m:ERR_MSG[r.err] || 'Error.', b:[{ l:'Entendido', w:'dlg-close', c:'red' }] }; renderOv(); break; }
      showToast('Ajuste guardado', ICONS.check); back(); break; }
    case 'block': {
      const w = W.wallets[id]; if(!w) break;
      p.dlg = { t:w.blocked ? '¿Desbloquear carné?' : '¿Bloquear carné?', m:w.blocked ? 'Podrá volver a comprar.' : 'No podrá comprar hasta que lo desbloquees. El saldo se conserva.',
        b:[{ l:w.blocked ? 'Sí, desbloquear' : 'Sí, bloquear', w:'block-ok', c:'red', id:id }, { l:'Cancelar', w:'dlg-close', c:'ghost' }] };
      renderOv(); break; }
    case 'block-ok': { const w = W.wallets[id]; if(w){ p.dlg = null; setBlocked(w, !w.blocked); renderOv(); } break; }
    case 'reissue': {
      const w = W.wallets[id]; if(!w) break;
      p.dlg = { t:'¿Reimprimir carné?', m:'Se crea un QR nuevo y el carné viejo deja de funcionar (también su enlace para el padre). El saldo se conserva.',
        b:[{ l:'Sí, crear carné nuevo', w:'reissue-ok', c:'red', id:id }, { l:'Cancelar', w:'dlg-close', c:'ghost' }] };
      renderOv(); break; }
    case 'reissue-ok': { const w = W.wallets[id]; if(w){ reissueToken(w); W.stack = [{ ov:'detail', p:{ wid:id } }]; setScreen('print', { group:'sel', sel:{ [id]:true } }); } break; }
    case 'print': W.stack = []; setScreen('print', { group:'all', sel:{} }); break;
    case 'pgroup': p.group = el.dataset.g; renderOv(); break;
    case 'psel': p.sel = p.sel || {}; p.sel[id] = !p.sel[id]; renderOv(); break;
    case 'do-print': window.print(); break;
    case 'import': W.stack = []; setScreen('import', { text:'', rows:null }); break;
    case 'imp-sample': p.text = SAMPLE; p.rows = parseList(SAMPLE); renderOv(); break;
    case 'imp-prev': p.rows = parseList(p.text); renderOv(); break;
    case 'imp-go': {
      const ok = (p.rows || []).filter(r => r.st === 'ok'); if(!ok.length) break;
      putWallets(ok.map(r => makeWallet(r.name, r.type, r.grade)));
      const n = ok.length; p.text = ''; p.rows = null; p.dlg = { t:'✓ Listo', m:`Se crearon <b>${n}</b> cuenta${n === 1 ? '' : 's'} con saldo $0. Ya salen en el selector de pedidos.`, b:[{ l:'Entendido', w:'dlg-close', c:'go' }] };
      renderOv(); break; }
    case 'exp-saldos': exportSaldos(); break;
    case 'exp-ventas': exportVentas(); break;
    case 'close-day': W.stack = []; setScreen('close', { day:todayKey() }); break;
    case 'day-prev': p.day = shiftDay(p.day, -1); renderOv(); break;
    case 'day-next': p.day = shiftDay(p.day, 1); renderOv(); break;
    case 'exp-cierre': exportCierre(); break;
    case 'login-go': doLogin(); break;
    case 'logout': logout(); break;
  }
}
function onInput(el){
  const k = el.dataset.wi, p = W.p;
  if(k === 'q'){ W.q = el.value; const l = $('#w-list'); if(l) l.innerHTML = listHtml(); }
  else if(k === 'rq'){ p.q = el.value; const l = $('#w-rlist'); if(l) l.innerHTML = rcList(searchWallets(p.q, 'all').slice(0, 12)); }
  else if(k === 'sq'){ const l = $('#w-slist'); if(l) l.innerHTML = rcList(searchWallets(el.value, 'all').slice(0, 12)); }
  else if(k === 'rc-amt'){ p.amount = int(el.value); updateRcGo(); }
  else if(k === 'adj-amt'){ p.amount = int(el.value); updateAdjGo(); }
  else if(k === 'adj-note'){ p.note = el.value; updateAdjGo(); }
  else if(k === 'imp'){ p.text = el.value; }
}
function bindEvents(){
  if(bindEvents.done) return; bindEvents.done = true;
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-w]'); if(!el || el.disabled) return;
    // en la lista de resultados del escáner, un nombre elegido abre el cobro / la recarga
    if(el.dataset.w === 'rc-pick' && W.ov === 'scan'){ const w = W.wallets[el.dataset.id]; if(w) pickWallet(w); return; }
    act(el.dataset.w, el);
  });
  document.addEventListener('input', (e) => { const el = e.target.closest && e.target.closest('[data-wi]'); if(el) onInput(el); });
  document.addEventListener('visibilitychange', () => { if(document.hidden) stopCam(); else if(W.ov === 'scan') startCam(); });
}

// ---------- arranque ----------
function walletInit(){
  injectCss();
  const cached = jget(LS.w, null);
  W.txns = jget(LS.t, []); W.views = jget(LS.v, {});
  if(cached){ W.wallets = cached; }
  else if(!cloudConfigured()){
    // Primer arranque en modo local: crea cuentas DEMO con las listas de data.js (saldo 0)
    W.wallets = {};
    GRADES.forEach(g => (NAS_DATA.students[g] || []).forEach(s => { const w = makeWallet(s.name, 'student', g, s.id); W.wallets[w.id] = w; writeViewNoCloud(w); }));
    (NAS_DATA.teachers || []).forEach(t => { const w = makeWallet(t.name, 'teacher', null, t.id); W.wallets[w.id] = w; writeViewNoCloud(w); });
    saveLocal();
  }
  if(!cloudConfigured()) rebuildLists(false);
  bindEvents();
}

window.walletInit = walletInit; window.renderWalletView = renderWalletView; window.walletCobrarBtn = walletCobrarBtn;
window.walletDemoTag = walletDemoTag; window.walletCloudStart = walletCloudStart;
window.MW = { W, wApply, onScan, parseScan, parseList, qrSvg, qrToCanvas, viewUrl, newToken, byToken, makeWallet, putWallets, nextWallet, closeData, buildView, reissueToken, setBlocked, act, setScreen, renderOv };
})();

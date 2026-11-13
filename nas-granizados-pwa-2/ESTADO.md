# ESTADO — NAS School Store (PWA snacks)

PWA de pedidos/entrega de snacks escolares (NAS). Productos: slushies, brownies,
crispetas, combo pop, aguita de manzana, agua, hot dogs y ahora **sánduche combo**.
Sync en tiempo real con Firebase; PIN de acceso 1987; auto-actualización por versión.

## Archivos clave
- `index.html` — TODO (UI + lógica + CSS). Objeto `PRODUCTS` (~línea 614): cada producto
  con `price` (viene de firebase-config), `icon`/`emoji`/SVG, `unit`/`unitP`, `sub`,
  `aguaIncl`. El selector (`renderProductSwitch`, scrollable) lista los productos solo.
  Todo (calendario, entrega, pedidos, resumen, dinero) se filtra por `state.activeProduct`.
- `firebase-config.js` — Firebase real + **precios** (UNIT/BROWNIE/COMBO/COMBO_POP/POP/
  AGUA/PERRO/BOTELLA) + `APP_PIN`.
- `sw.js` — cache versionado (`CACHE='nas-granizados-vNN'`, debe ir igual a APP_VERSION).
- `icons/*-flat.png` — íconos propios transparentes (slushie/brownie/sandwich). Se dibujan
  con scripts python puros en el scratchpad (`sandwich.py`, `brownie2.py`, `flaticons.py`).
- Repo: github `joe150477/SLUSHIES` → GitHub Pages:
  https://joe150477.github.io/SLUSHIES/nas-granizados-pwa-2/

## Hecho (histórico)
- v41: producto `sandwich` (Sánduche combo + aguita, $6.000, `COMBO_PRICE`) + ícono
  `icons/sandwich-flat.png`. Ya en vivo (commit `e3c0c59`).

## Hecho ahora (v42, SIN subir aún)
- **FIX conteo**: "por entregar/entregados" sumaban PEDIDOS, no cantidades (2 perros=1).
  Ahora usan `sumQty()` (día, Entregar, badge, header). Resumen mensual ya sumaba bien.
- Grados nuevos **Prekínder** (`prek`) y **Preescolar** (`preesc`) en GRADES/GRADE_LABELS +
  helper `gradoLabel()` (preescolar no dice "grado").
- Personas en data.js: Juan Pablo Méndez (prek, stu_095), Isabella Díaz (preesc, stu_096,
  ESTUDIANTE), Mathías Salas (4°, stu_097), docente Fiorella (t_020).
- `APP_VERSION='42'`, `APP_UPDATED='13 nov 2026'`, `sw.js`→v42. Sintaxis JS/SW OK.
- **Datos YA en vivo en Firebase** (no requieren deploy): Dominik Gutiérrez perro de hoy
  movido a **2026-11-20** (sin entregar, pagado). Creados 4 pedidos de hoy entregados en
  "Debe": Juan Pablo/Isabella/Mathías = perro, Fiorella = **slushie** (corregido).

## DESPLEGADO ✅
- **v42 EN VIVO** (fix conteo por cantidad, grados Prekínder/Preescolar, personas nuevas).

## Hecho ahora (v43, SIN subir)
- **Cupo diario de PERROS** (solo perros): panel en vista del día (presets 20/30/40/50, −/+,
  "sin límite") que muestra vendidos/cupo/quedan y AGOTADO. **Bloquea la venta** al llegar a 0
  (en el selector y al guardar; avisa "Solo quedan X" / "agotados"). Por día, se **sincroniza**
  (Firebase `/stock/{fecha}/perro`, con fallback local `nas_stock_v1`). Helpers: `perroCupo/
  perroSold/perroLeft/setPerroStock`. `APP_VERSION='43'`, `sw.js`→v43. Sintaxis/lógica OK.

## PENDIENTE
1. **v43 COMMITEADO** (`ce65e99` + `0e64a19`, cupo verificado en HEAD) — falta el PUSH.
   **SSH YA CONFIGURADO (fix permanente del 403):** llave `~/.ssh/id_ed25519_joe150477`,
   alias `github-joe` en `~/.ssh/config` (IdentitiesOnly), remoto = `git@github-joe:joe150477/SLUSHIES.git`.
   → **Falta que el usuario pegue la llave pública** en github.com/settings/ssh/new
   (logueado como **joe150477**, no el colegio). Cuando diga "ya": correr
   `ssh -T git@github-joe` (esperar "Hi joe150477") y `git push origin main` (incluye ESTADO.md).
2. En el celular: cuando el sitio diga **v43**, cerrar/reabrir la app para saltar caché.
2. Usuario: tocar **"Pagado"** a los 4 pedidos de hoy que ya pagaron (quedaron en "Debe").
3. (Opcional) anuncio WhatsApp del sanduchito combo.
- Nota cuenta: si vuelve a fallar el push con 403, es que el llavero volvió a la cuenta del
  colegio; reautenticar como joe150477 (GitHub Desktop o PAT).

## Reglas
- Probar de verdad antes de declarar hecho; decir qué no se pudo probar.
- Precios se editan solo en `firebase-config.js`; versión se sube en `index.html` (APP_VERSION)
  y `sw.js` (CACHE) a la par.
- El usuario despliega con `git push`; la app se auto-actualiza por número de versión.

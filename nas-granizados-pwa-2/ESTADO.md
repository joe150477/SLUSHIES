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

## Hecho ahora (v41)
- Agregado producto `sandwich` = **Sánduche combo + aguita de manzana** a **$6.000**
  (`COMBO_PRICE` en firebase-config.js, línea 37).
- Ícono nuevo `icons/sandwich-flat.png` (pan tajado + vaso de aguita con pitillo).
- `sw.js` → v41 (+ ícono en cache); `APP_VERSION='41'`; `APP_UPDATED='9 nov 2026'`.
- Verificado: sintaxis JS OK, SW OK, ícono existe. (Switcher y stats heredan solos.)

## PENDIENTE
1. **git commit + `git push origin main`** (en la terminal del usuario) para publicar.
2. En el celular: si no dice **v41**, quitar el ícono y volver a "Agregar a inicio" una vez.
3. Verificar en vivo que "Sánduches" aparezca en el selector y tenga sus estadísticas.

## Reglas
- Probar de verdad antes de declarar hecho; decir qué no se pudo probar.
- Precios se editan solo en `firebase-config.js`; versión se sube en `index.html` (APP_VERSION)
  y `sw.js` (CACHE) a la par.
- El usuario despliega con `git push`; la app se auto-actualiza por número de versión.

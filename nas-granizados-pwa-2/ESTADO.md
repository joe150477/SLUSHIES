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
- **Commit + push HECHOS** por el usuario (commit `e3c0c59` "oki"); origin/main sincronizado.
  RAW en GitHub ya tiene v41 + sandwich + ícono (200). ✅

## PENDIENTE
1. **GitHub Pages aún desplegando**: el sitio en vivo todavía sirve v40 (ícono 404 en Pages).
   Es solo retraso de Pages (no error). Esperar 2–20 min y verificar que el sitio diga **v41**.
   Ver progreso: https://github.com/joe150477/SLUSHIES/deployments (o Actions).
2. Cuando Pages muestre v41: en el celular quitar el ícono y volver a "Agregar a inicio"
   una vez (salto de caché v40→v41). Ahí aparece "Sánduches" en el selector.
3. (Opcional) armar anuncio de WhatsApp del sanduchito combo (como el del brownie).

## Reglas
- Probar de verdad antes de declarar hecho; decir qué no se pudo probar.
- Precios se editan solo en `firebase-config.js`; versión se sube en `index.html` (APP_VERSION)
  y `sw.js` (CACHE) a la par.
- El usuario despliega con `git push`; la app se auto-actualiza por número de versión.

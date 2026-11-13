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

## PENDIENTE
1. **v42 commiteado (`b721352`) pero PUSH BLOQUEADO**: 403 — el llavero de macOS tiene un
   token de la cuenta del colegio (`newacademyschool`) sin permiso sobre `joe150477/SLUSHIES`.
   Arreglo: subir con **GitHub Desktop como joe150477**, o en terminal borrar la credencial
   (`printf "protocol=https\nhost=github.com\n\n" | git credential-osxkeychain erase`) y
   `git push origin main` iniciando sesión como **joe150477** (usuario + PAT con scope `repo`).
2. Esperar despliegue de Pages y verificar que el sitio diga **v42**; refrescar el celular
   (quitar/re-agregar la app) para ver grados nuevos al registrar pedidos.
3. Usuario: tocar **"Pagado"** a los nuevos que ya pagaron (quedaron en "Debe").
4. (Opcional) anuncio WhatsApp del sanduchito combo.

## Reglas
- Probar de verdad antes de declarar hecho; decir qué no se pudo probar.
- Precios se editan solo en `firebase-config.js`; versión se sube en `index.html` (APP_VERSION)
  y `sw.js` (CACHE) a la par.
- El usuario despliega con `git push`; la app se auto-actualiza por número de versión.

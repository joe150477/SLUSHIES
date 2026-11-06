# Pruebas realizadas (navegador integrado, 390×844, servidor local :8768, modo local DEMO)

Compilación: `new Function` en Node sobre wallet.js, data.js, firebase-config.js, sw.js y los <script> inline de index.html y view.html: OK. Consola sin errores propios (solo avisos del entorno: cámara bloqueada, vibración sin gesto, registro del service worker bloqueado por el panel).

| Prueba | Resultado |
|---|---|
| QR ida y vuelta (qrcode-generator → canvas → jsQR) en las 15 cuentas | 15/15 mismo token; también el SVG de impresión rasterizado a 160 px |
| Token: 24 caracteres url-safe, únicos | OK |
| Lector: acepta URL `…view.html?t=TOKEN` y token solo; rechaza texto/tokens cortos | OK |
| Cargar listas pegadas (encabezado, acentos, «3°», duplicados, curso/nombre inválidos) | 3 nuevas, 2 repetidas y 2 con error marcadas; crea 3 cuentas; selector de pedidos actualizado |
| Recargar $20.000 (efectivo) con confirmación y «✓ Saldo nuevo» | OK; txn y /view actualizados |
| Cobrar combo $5.000 → saldo $15.000 | OK; pedido paid/delivered/payMethod monedero, visible en Resumen |
| Doble cobro (<15 s, mismo total) | pide «¿Cobrar otra vez?»; No cancela, Sí cobra |
| Saldo insuficiente: parcial (abono $10.000, debe $10.000) y «todo como Debe» | OK (Resumen: recaudado $20.000 + por cobrar $16.000 = $36.000) |
| Nunca saldo negativo (compra y ajuste forzados) | rechazados |
| Idempotencia (mismo txnId dos veces) | aplica una sola vez |
| Ajuste: motivo obligatorio (botón deshabilitado sin motivo) | OK, txn 'ajuste' con nota |
| Bloqueada: no cobra (UI y por código), sí permite recargar | OK |
| Reimprimir carné: token nuevo, token viejo no escanea y su /view se borra | OK |
| view.html: saldo correcto con token nuevo; token viejo/ inválido → mensaje; solo lee por token | OK |
| Cámara denegada (panel del navegador): mensaje con pasos para iPhone + buscador por nombre; selecciona y cobra | OK |
| Overflow horizontal / elementos fuera de pantalla en 12 pantallas a 360, 390 y 430 px | ninguno (scrollWidth = ancho) |
| Cierre del día (recargas, compras, debe, total, por cajero) | cifras coinciden con las operaciones |
| nas-granizados-pwa-2 intacta | `git status`: solo `?? munchies-2027/` |

## NO se pudo probar
- Cámara real en iPhone (permiso, enfoque, 8–10 fps): solo se probó la decodificación con jsQR sobre un canvas.
- Firebase real: inicio de sesión, transacciones, `database.rules.json` (no se simuló en el emulador), sincronización entre celulares y view.html por REST.
- Impresión real (A4, 6×8, @media print) y descarga de CSV en Safari iOS.
- Service worker (el panel integrado lo bloquea).

## Nota
jsQR 1.4.0 NO existe en cdnjs (404): se carga fijo desde jsDelivr `cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js`. qrcode-generator 1.4.4 sí está en cdnjs.

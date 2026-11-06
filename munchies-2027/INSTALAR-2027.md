# Carné Munchies 2027 · Guía de instalación (sin programar)

Esta app es una COPIA independiente de la tienda escolar. No toca la app de producción.
Mientras `firebase-config.js` tenga los textos «TU_…», funciona en **modo DEMO local** (solo en ese celular, PIN 1987).

## 1. Crear el proyecto Firebase NUEVO (gratis)
1. Entra a https://console.firebase.google.com con la cuenta del colegio.
2. **Agregar proyecto** → nombre `munchies-2027` → desactiva Google Analytics → **Crear**.
3. Deja el plan **Spark** (gratis). No pongas tarjeta.

## 2. Activar Realtime Database
1. Menú izquierdo → **Compilación › Realtime Database › Crear base de datos**.
2. Ubicación: la que ofrezca (cualquiera). Elige **modo bloqueado**.

## 3. Activar Authentication (correo y clave)
1. **Compilación › Authentication › Comenzar**.
2. Pestaña **Sign-in method** → **Correo electrónico/contraseña** → Activar → Guardar.

## 4. Pegar las reglas de seguridad
1. Realtime Database → pestaña **Reglas**.
2. Borra todo y pega el contenido de `database.rules.json` → **Publicar**.

## 5. Crear 2–3 usuarios de caja
1. Authentication → **Users › Add user**: correo y clave (ej. `caja1@tucolegio.com`). Repite para cada cajero.
2. Copia el **UID** de cada usuario (columna «User UID»).

## 6. Registrar a esos usuarios como personal
1. Realtime Database → pestaña **Datos**. Pasa el mouse sobre la raíz → **+**.
2. Nombre: `staff` → agrega un hijo con nombre = el UID y valor = `true` (booleano). Repite por cada UID.
   Resultado: `staff / UID1: true`, `staff / UID2: true`.
   (Sin esto el usuario entra pero verá «no autorizado».)

## 7. Copiar la configuración a la app
1. Rueda ⚙ › **Configuración del proyecto** › «Tus apps» › icono web `</>` › registra la app › copia el objeto `firebaseConfig`.
2. Abre `firebase-config.js` y reemplaza los valores «TU_…» (apiKey, authDomain, databaseURL, projectId, storageBucket, messagingSenderId, appId).
3. Authentication › Settings › **Authorized domains**: agrega el dominio donde publicarás la app.

## 8. Probar antes de publicar
1. Abre la app; pide correo y clave → entra con un usuario de caja.
2. Pestaña **Monedero › Cargar listas**: pega 2 personas de prueba → «Crear cuentas».
3. Recarga $10.000, cobra un producto, abre el enlace del carné (`view.html?t=…`) en otro celular y comprueba el saldo.
4. Prueba cobrar con la cámara (necesita HTTPS; en el celular acepta el permiso de cámara).
5. Borra las cuentas de prueba desde la consola (Datos › wallets / txns / view / orders) antes del día real.

## 9. Publicar
Sube la carpeta `munchies-2027` a un hosting con HTTPS (Firebase Hosting, GitHub Pages, Netlify…). La cámara y el QR del padre **solo funcionan con https://**.
En el iPhone: Safari › Compartir › **Añadir a pantalla de inicio**.

## Lista de cambio de año (2027)
- [ ] Con la app del 2026: Monedero › Cargar listas › **Exportar saldos y movimientos (CSV)** y **Exportar ventas (CSV)**; guardar los archivos.
- [ ] Decidir qué pasa con los saldos que sobran (devolver o pasar al nuevo año; usar «Ajustar» con motivo).
- [ ] **Cargar listas 2027** (nombre;tipo;curso). Revisar la vista previa (duplicados marcados).
- [ ] **Hoja de carnés**: imprimir (A4, 6×8), recortar y entregar a cada estudiante/docente.
- [ ] Entregar a los padres el enlace/QR del carné para ver el saldo.
- [ ] Pendiente del colegio: **reglamento del monedero** y **autorización de tratamiento de datos** (Ley 1581) firmada por los padres.
- [ ] Cambiar el PIN de `APP_PIN` en `firebase-config.js` si se quiere (en modo nube se usa correo y clave).

## Notas de seguridad
- El carné tiene una clave aleatoria de 24 caracteres; la página del padre solo muestra primer nombre, curso, saldo y últimos movimientos de **esa** cuenta.
- Si un carné se pierde: **Bloquear**, o **Reimprimir carné** (el QR viejo deja de funcionar).
- Los movimientos solo se agregan; los errores se corrigen con «Ajustar» (con motivo).

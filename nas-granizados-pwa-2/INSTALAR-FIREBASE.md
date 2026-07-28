# NAS Granizados — Sincronizar entre la asistente y quien entrega

La app ya funciona sola en un dispositivo. Para que **la asistente registre desde su
celular** y **tú veas y marques entregado desde el tuyo**, en tiempo real, hay que
conectar una base de datos gratuita de **Firebase** (5–10 minutos, una sola vez).

> Mientras no lo configures, la app corre en **Modo local** (verás un aviso amarillo
> arriba) y los pedidos solo se ven en ese dispositivo.

---

## 1. Crear el proyecto en Firebase (gratis)

1. Entra a **https://console.firebase.google.com** con tu cuenta de Google.
2. Clic en **"Crear un proyecto"** → nombre `nas-granizados` → aceptar y continuar
   (puedes desactivar Google Analytics, no hace falta).
3. En el menú de la izquierda abre **Compilación → Realtime Database**.
4. Clic en **"Crear base de datos"** → elige la ubicación → selecciona
   **"Iniciar en modo de prueba"** → Habilitar.

## 2. Copiar la configuración

1. Arriba a la izquierda, clic en la **rueda ⚙ → "Configuración del proyecto"**.
2. Baja hasta **"Tus apps"** y clic en el ícono **web `</>`**.
3. Ponle un apodo (ej. `granizados-web`) y **Registrar app**.
4. Firebase te muestra un bloque `const firebaseConfig = { ... }`. Copia esos valores.
5. Abre el archivo **`firebase-config.js`** de esta app y pega cada valor en su lugar.
   Debe quedar algo así (con TUS datos reales, sin los `TU_...`):

   ```js
   const FIREBASE_CONFIG = {
     apiKey: "AIzaSyD...",
     authDomain: "nas-granizados.firebaseapp.com",
     databaseURL: "https://nas-granizados-default-rtdb.firebaseio.com",
     projectId: "nas-granizados",
     storageBucket: "nas-granizados.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123"
   };
   ```

   > ⚠️ Importante que exista la línea **`databaseURL`**. Si no aparece en el bloque
   > que copiaste, tómala de la pantalla de Realtime Database (es la URL que termina
   > en `firebaseio.com`).

6. Guarda el archivo. Al recargar la app, el aviso amarillo desaparece y arriba a la
   derecha verás el punto **verde "En línea"**. ¡Ya sincroniza!

## 3. Reglas de seguridad (recomendado)

El "modo de prueba" deja la base abierta y **caduca a los 30 días**. Como es una
herramienta interna, la forma más simple de que no se corte es dejar reglas abiertas
solo para esta base pequeña. En **Realtime Database → pestaña "Reglas"** pon:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

Esto es suficiente para uso interno del colegio (nadie más conoce la URL). Si más
adelante quieres cerrarlo con usuario/clave, se puede añadir login de Firebase Auth.

---

## Cómo se usa el flujo

1. **La asistente** abre la app en su celular, entra al **día** en el calendario y toca
   **"Agregar pedido"**: elige estudiante (nombre y curso) o docente y la cantidad.
2. Cuando el estudiante manda el **soporte de pago**, la asistente abre el pedido y toca
   **"Confirmar pago"**. El pedido pasa a **"Por entregar"**.
3. **Tú** abres la pestaña **"Entregar"** (muestra solo los pagados, listos) y al dar el
   granizado tocas **"Marcar entregado"**. Se sincroniza al instante en ambos celulares.
4. La pestaña **"Resumen"** muestra lo recaudado, lo que falta por cobrar y quién pide más.

## Instalar como app en el celular

- **iPhone (Safari):** abrir la página → botón Compartir → *"Agregar a inicio"*.
- **Android (Chrome):** menú ⋮ → *"Instalar app" / "Agregar a pantalla de inicio"*.

## Cambiar el precio del granizado

Está en **`firebase-config.js`**, al final: `const UNIT_PRICE = 2000;` (pesos).

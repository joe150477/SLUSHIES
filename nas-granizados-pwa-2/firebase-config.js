/* ============================================================
   CONFIGURACIÓN DE FIREBASE  —  NAS Granizados
   ------------------------------------------------------------
   Pega aquí los datos de TU proyecto de Firebase (Realtime
   Database). Así la asistente registra en su celular y quien
   entrega ve/confirma desde el suyo, sincronizado al instante.

   ¿Dónde consigo esto?  (gratis, 5 minutos)
   1. Entra a  https://console.firebase.google.com
   2. Crea un proyecto (ej. "nas-granizados").
   3. Menú izquierdo → "Realtime Database" → Crear base de datos
      → ubicación cualquiera → empezar en "modo de prueba".
   4. Rueda de ajustes ⚙ → "Configuración del proyecto" →
      baja a "Tus apps" → icono web  </>  → registra la app →
      copia los valores del objeto firebaseConfig y pégalos abajo.

   Mientras esto quede sin llenar (con los "TU_..."), la app
   funciona igual pero en MODO LOCAL (solo en ese dispositivo,
   sin sincronizar). Verás un aviso amarillo arriba.

   Más detalles y reglas de seguridad: ver INSTALAR-FIREBASE.md
   ============================================================ */

const FIREBASE_CONFIG = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  databaseURL: "https://TU_PROYECTO-default-rtdb.firebaseio.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

// Precio de un granizado (en pesos). Cámbialo si sube el precio.
const UNIT_PRICE = 2000;

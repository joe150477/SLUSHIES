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
  apiKey: "AIzaSyDj2mtc5DzKPe7wFdpQiWa5b-Qwnv410dA",
  authDomain: "nas-granizados.firebaseapp.com",
  databaseURL: "https://nas-granizados-default-rtdb.firebaseio.com",
  projectId: "nas-granizados",
  storageBucket: "nas-granizados.firebasestorage.app",
  messagingSenderId: "875515899704",
  appId: "1:875515899704:web:9e0108130fc3f90ccc9bcd"
};

// Precio de un granizado (en pesos). Cámbialo si sube el precio.
const UNIT_PRICE = 2000;

// PIN para entrar a la app (candado de acceso, no seguridad real).
// Cámbialo por el que quieran usar tú y la asistente. Puede ser de 4 a 6 dígitos.
// Si lo dejas vacío ("") la app abre sin pedir PIN.
const APP_PIN = "1987";

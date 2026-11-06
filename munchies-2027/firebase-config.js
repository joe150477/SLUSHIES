/* ============================================================
   CONFIGURACIÓN DE FIREBASE  —  Carné Munchies 2027
   ------------------------------------------------------------
   Pega aquí los datos de TU proyecto de Firebase (Realtime
   Database). Así la asistente registra en su celular y quien
   entrega ve/confirma desde el suyo, sincronizado al instante.

   ¿Dónde consigo esto?  (gratis, 5 minutos)
   1. Entra a  https://console.firebase.google.com
   2. Crea un proyecto (ej. "munchies-2027").
   3. Menú izquierdo → "Realtime Database" → Crear base de datos
      → ubicación cualquiera → empezar en "modo de prueba".
   4. Rueda de ajustes ⚙ → "Configuración del proyecto" →
      baja a "Tus apps" → icono web  </>  → registra la app →
      copia los valores del objeto firebaseConfig y pégalos abajo.

   Mientras esto quede sin llenar (con los "TU_..."), la app
   funciona igual pero en MODO LOCAL (solo en ese dispositivo,
   sin sincronizar). Verás un aviso amarillo arriba.

   Guía paso a paso: ver INSTALAR-2027.md (reglas en database.rules.json)
   ============================================================ */

const FIREBASE_CONFIG = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  databaseURL: "https://TU_PROYECTO-default-rtdb.firebaseio.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.firebasestorage.app",
  messagingSenderId: "TU_NUMERO",
  appId: "TU_APP_ID"
};

// Precios (en pesos). Cámbialos si suben.
const UNIT_PRICE = 6000;      // Slushie / granizado
const BROWNIE_PRICE = 10000;  // Brownie con helado
const COMBO_POP_PRICE = 5000; // Combo: crispetas + aguita de manzana
const POP_PRICE = 2500;       // Crispetas solas
const AGUA_PRICE = 2500;      // Aguita de manzana sola
const PERRO_PRICE = 10000;    // Hot dog americano + aguita de manzana
const BOTELLA_PRICE = 2000;   // Agua (botella)

// PIN para entrar a la app (candado de acceso, no seguridad real).
// Cámbialo por el que quieran usar tú y la asistente. Puede ser de 4 a 6 dígitos.
// Si lo dejas vacío ("") la app abre sin pedir PIN.
const APP_PIN = "1987";

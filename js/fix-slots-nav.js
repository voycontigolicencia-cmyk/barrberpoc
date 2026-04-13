/* ================================================================
   PARCHE — fix-slots-nav.js
   
   Arregla DOS cosas:
   
   1. BUG CRÍTICO de _horaAMinutos en supabase-config.js
      - El regex /:\d{2}$/ borra los minutos cuando recibe "HH:MM"
      - Resultado: hora_fin se guardaba igual a hora_inicio
      - Efecto: las horas reservadas aparecían como disponibles
      
   2. NAVEGACIÓN con botón "Volver" que preserva datos
      - Añade botones Volver en cada paso
      - Permite retroceder sin perder las selecciones previas
      - El estado del Wizard se mantiene intacto
   
   Cargar DESPUÉS de app.js y fix-wizard.js:
     <script src="js/fix-wizard.js"></script>
     <script src="js/fix-modal.js"></script>
     <script src="js/fix-slots-nav.js"></script>   ← AÑADIR
   ================================================================ */

// ════════════════════════════════════════════════════════════════
// 1. FIX DEL BUG DE _horaAMinutos
// ════════════════════════════════════════════════════════════════
(function fixHoraAMinutos() {
  if (typeof API === 'undefined') {
    console.error('❌ API no disponible, no se puede parchear');
    return;
  }
  
  // Versión correcta: simplemente parsea las primeras dos partes
  // Soporta "HH:MM" y "HH:MM:SS" sin regex ambiguos
  API._horaAMinutos = function (hora) {
    if (!hora) return 0;
    const parts = String(hora).split(':');
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return h * 60 + m;
  };
  
  console.log('✅ _horaAMinutos parcheado — bug de slots corregido');
})();

// ════════════════════════════════════════════════════════════════
// 2. CSS para botones de navegación
// ════════════════════════════════════════════════════════════════
(function injectNavStyles() {
  const css = `
    .paso-nav-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 16px;
      padding-top: 14px;
      border-top: 1px solid var(--border, #2A2A40);
      gap: 12px;
    }
    .btn-volver {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: transparent;
      border: 1px solid var(--border, #2A2A40);
      color: var(--muted, #94A3B8);
      padding: 9px 16px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      font-family: inherit;
    }
    .btn-volver:hover {
      border-color: var(--gold, #C9A84C);
      color: var(--gold, #C9A84C);
      transform: translateX(-3px);
    }
    .btn-volver::before {
      content: '←';
      font-size: 16px;
      font-weight: 700;
    }
    .paso-nav-info {
      font-size: 12px;
      color: var(--muted, #94A3B8);
      font-style: italic;
    }
    .paso-nav-info strong {
      color: var(--gold-lt, #E4C875);
      font-style: normal;
    }
  `;
  const style = document.createElement('style');
  style.id = 'nav-styles';
  style.textContent = css;
  document.head.appendChild(style);
})();

// ════════════════════════════════════════════════════════════════
// 3. LÓGICA DE NAVEGACIÓN
// ════════════════════════════════════════════════════════════════

/**
 * Retrocede al paso anterior SIN borrar los datos seleccionados.
 * El Wizard mantiene intacto servicioElegido, fechaElegida, etc.
 * Solo cambia qué paso está "activo" visualmente.
 */
window.volverAPaso = function (num) {
  if (typeof Wizard === 'undefined') return;
  
  console.log(`⬅️ Volviendo al paso ${num}`);
  
  // Activa el paso visualmente (no borra datos)
  Wizard.activarPaso(num);
  
  // Scroll suave al paso
  const pasos = ['paso-servicio', 'paso-fecha', 'paso-hora'];
  const el = document.getElementById(pasos[num - 1]);
  if (el) {
    setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }
  
  // Re-renderizar el resumen (puede haber datos futuros que mostrar)
  Wizard.actualizarResumen();
};

/**
 * Inserta barras de navegación con botón "Volver" en cada paso.
 * Se ejecuta una vez al cargar la página.
 */
function instalarBotonesVolver() {
  // Paso 2 (fecha): volver a servicio
  const pasoFecha = document.getElementById('paso-fecha');
  if (pasoFecha && !pasoFecha.querySelector('.paso-nav-bar')) {
    const bar = document.createElement('div');
    bar.className = 'paso-nav-bar';
    bar.innerHTML = `
      <button class="btn-volver" onclick="volverAPaso(1)">Elegir otro servicio</button>
      <div class="paso-nav-info" id="nav-info-fecha"></div>
    `;
    pasoFecha.appendChild(bar);
  }
  
  // Paso 3 (barbero + hora): volver a fecha
  const pasoHora = document.getElementById('paso-hora');
  if (pasoHora && !pasoHora.querySelector('.paso-nav-bar')) {
    const bar = document.createElement('div');
    bar.className = 'paso-nav-bar';
    bar.innerHTML = `
      <button class="btn-volver" onclick="volverAPaso(2)">Cambiar fecha</button>
      <div class="paso-nav-info" id="nav-info-hora"></div>
    `;
    pasoHora.appendChild(bar);
  }
}

// ════════════════════════════════════════════════════════════════
// 4. ACTUALIZAR INFO DE NAVEGACIÓN
// ════════════════════════════════════════════════════════════════
// Cada vez que el Wizard cambia estado, actualizamos los textos
// de contexto ("Servicio elegido: X", "Fecha: Y") en las barras.

function actualizarInfoNavegacion() {
  if (typeof Wizard === 'undefined') return;
  
  const infoFecha = document.getElementById('nav-info-fecha');
  const infoHora = document.getElementById('nav-info-hora');
  
  if (infoFecha && Wizard.servicioElegido) {
    infoFecha.innerHTML = `Servicio: <strong>${escapeHtml(Wizard.servicioElegido.nombre)}</strong>`;
  }
  
  if (infoHora) {
    const partes = [];
    if (Wizard.servicioElegido) {
      partes.push(`<strong>${escapeHtml(Wizard.servicioElegido.nombre)}</strong>`);
    }
    if (Wizard.fechaElegida) {
      const f = new Date(Wizard.fechaElegida + 'T12:00:00');
      partes.push(`<strong>${f.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}</strong>`);
    }
    infoHora.innerHTML = partes.join(' · ');
  }
}

// Hook: interceptamos actualizarResumen para también refrescar la info
if (typeof Wizard !== 'undefined' && Wizard.actualizarResumen) {
  const original = Wizard.actualizarResumen.bind(Wizard);
  Wizard.actualizarResumen = function () {
    original();
    actualizarInfoNavegacion();
  };
}

function escapeHtml(s) {
  return String(s || '').replace(/[<>&"']/g, c => 
    ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
}

// ════════════════════════════════════════════════════════════════
// 5. INIT
// ════════════════════════════════════════════════════════════════
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', instalarBotonesVolver);
} else {
  instalarBotonesVolver();
}

// Re-aplicar cada vez que el DOM cambia (por si los pasos se re-renderizan)
const navObserver = new MutationObserver(() => {
  if (!document.querySelector('#paso-fecha .paso-nav-bar')) {
    instalarBotonesVolver();
    actualizarInfoNavegacion();
  }
});
navObserver.observe(document.body, { childList: true, subtree: true });

console.log('✅ fix-slots-nav.js cargado — navegación Volver activa');

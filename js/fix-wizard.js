/* ================================================================
   PARCHE DEFINITIVO — fix-wizard.js v2
   
   El bug raíz: calendar.js v3.1 tiene su propia función
   actualizarResumenSeleccion() que pisa el sidebar con un HTML
   que NO incluye el botón "Confirmar reserva".
   
   Por eso ves los datos (Andrés, 16:45) pero NO el botón.
   
   Este parche:
   1. Reemplaza esa función para que use el render del Wizard
   2. Sincroniza CalendarState → Wizard cuando seleccionas hora
   3. Intercepta clicks en .slot-btn como red de seguridad
   4. Watchdog cada 300ms
   ================================================================ */

// ════════════════════════════════════════════════════════════════
// 1. CSS — fix overflow de slots y botón CTA visible
// ════════════════════════════════════════════════════════════════
(function fixCSS() {
  const css = `
    .paso { max-height: none !important; overflow: visible !important; }
    #slots-container {
      max-height: none !important;
      overflow: visible !important;
      min-height: 100px;
    }
    .slots-wrapper {
      display: flex !important;
      flex-direction: column !important;
      gap: 16px !important;
      max-height: none !important;
      overflow: visible !important;
    }
    .slots-barbero { overflow: visible !important; height: auto !important; }
    .slots-horas {
      display: flex !important;
      flex-wrap: wrap !important;
      gap: 8px !important;
      padding: 16px !important;
      min-height: 60px !important;
      align-items: flex-start !important;
    }
    .slot-btn {
      flex: 0 0 auto !important;
      min-width: 70px !important;
      padding: 10px 16px !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
    }
    .slot-btn--selected {
      background: var(--gold, #C9A84C) !important;
      color: #000 !important;
      border-color: var(--gold, #C9A84C) !important;
      box-shadow: 0 0 0 3px rgba(201, 168, 76, 0.4) !important;
    }
    #paso-hora { max-height: none !important; overflow: visible !important; }
    .reservas-main, .reservas-layout {
      max-height: none !important;
      overflow: visible !important;
    }
    .resumen-cta {
      width: 100%;
      margin-top: 14px;
      padding: 14px;
      background: var(--gold, #C9A84C);
      color: #000;
      border: none;
      border-radius: 10px;
      font-weight: 700;
      font-size: 15px;
      cursor: pointer;
      display: block !important;
      visibility: visible !important;
      transition: all .2s;
    }
    .resumen-cta:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 18px rgba(201,168,76,.4);
    }
    .resumen-cta:disabled { opacity: .5; cursor: not-allowed; }
  `;
  const old = document.querySelector('#fix-wizard-css');
  if (old) old.remove();
  const s = document.createElement('style');
  s.id = 'fix-wizard-css';
  s.textContent = css;
  document.head.appendChild(s);
})();

// ════════════════════════════════════════════════════════════════
// 2. NEUTRALIZAR la función de calendar.js que pisa el sidebar
// ════════════════════════════════════════════════════════════════
// calendar.js v3.1 expone window.actualizarResumenSeleccion y la
// llama desde cargarDisponibilidad() y desde el callback del slot.
// Esa función sobreescribe el innerHTML SIN incluir el botón.
// La reemplazamos por una que delega al Wizard.

window.actualizarResumenSeleccion = function () {
  if (typeof Wizard !== 'undefined' && Wizard.actualizarResumen) {
    if (typeof CalendarState !== 'undefined') {
      if (CalendarState.empleadoSeleccionado) {
        Wizard.empleadoElegido = CalendarState.empleadoSeleccionado;
      }
      if (CalendarState.slotSeleccionado) {
        Wizard.horaElegida = CalendarState.slotSeleccionado;
      }
    }
    Wizard.actualizarResumen();
  }
};

// ════════════════════════════════════════════════════════════════
// 3. Listener de slotSeleccionado (event custom)
// ════════════════════════════════════════════════════════════════
document.addEventListener('slotSeleccionado', function (e) {
  if (typeof Wizard === 'undefined') return;
  
  const { empleadoID, empleadoNombre, horaInicio, horaFin } = e.detail;
  console.log('🎯 Slot seleccionado:', { empleadoID, empleadoNombre, horaInicio });
  
  Wizard.empleadoElegido = empleadoID;
  Wizard.horaElegida = horaInicio;
  
  if (Wizard.marcarPasoCompleto) Wizard.marcarPasoCompleto(3);
  Wizard.actualizarResumen();
  
  setTimeout(function () {
    const cta = document.querySelector('.resumen-cta');
    if (cta) cta.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 200);
});

// ════════════════════════════════════════════════════════════════
// 4. Listener de fecha
// ════════════════════════════════════════════════════════════════
document.addEventListener('fechaSeleccionada', function (e) {
  if (typeof Wizard === 'undefined') return;
  const fecha = e.detail.fecha;
  if (Wizard.fechaElegida !== fecha && Wizard.onFechaSelected) {
    Wizard.onFechaSelected(fecha);
  }
});

// ════════════════════════════════════════════════════════════════
// 5. INTERCEPTOR de clicks en .slot-btn (cinturón + tirantes)
// ════════════════════════════════════════════════════════════════
// Por si el evento custom no llega, capturamos el click directo
// con captura de fase (ocurre antes que el listener de calendar.js)
document.addEventListener('click', function (e) {
  const btn = e.target.closest('.slot-btn');
  if (!btn) return;
  
  const empleadoID = btn.dataset.empleadoId;
  const horaInicio = btn.dataset.horaInicio;
  
  if (!empleadoID || !horaInicio || typeof Wizard === 'undefined') return;
  
  // Esperar 80ms para que calendar.js termine su lógica primero
  setTimeout(function () {
    if (Wizard.empleadoElegido !== empleadoID || Wizard.horaElegida !== horaInicio) {
      console.log('🛡️ Interceptor click → sincronizando Wizard manualmente');
      Wizard.empleadoElegido = empleadoID;
      Wizard.horaElegida = horaInicio;
      if (Wizard.marcarPasoCompleto) Wizard.marcarPasoCompleto(3);
      Wizard.actualizarResumen();
    }
  }, 80);
}, true);

// ════════════════════════════════════════════════════════════════
// 6. WATCHDOG cada 300ms
// ════════════════════════════════════════════════════════════════
let _lastSync = '';
setInterval(function () {
  if (typeof Wizard === 'undefined' || typeof CalendarState === 'undefined') return;
  
  const csKey = (CalendarState.empleadoSeleccionado || '') + '|' + (CalendarState.slotSeleccionado || '');
  if (csKey === _lastSync || csKey === '|') return;
  _lastSync = csKey;
  
  if (CalendarState.empleadoSeleccionado && CalendarState.slotSeleccionado) {
    const cambio = (
      Wizard.empleadoElegido !== CalendarState.empleadoSeleccionado ||
      Wizard.horaElegida !== CalendarState.slotSeleccionado
    );
    if (cambio) {
      console.log('🔄 Watchdog → sincronizando Wizard ← CalendarState');
      Wizard.empleadoElegido = CalendarState.empleadoSeleccionado;
      Wizard.horaElegida = CalendarState.slotSeleccionado;
      if (Wizard.marcarPasoCompleto) Wizard.marcarPasoCompleto(3);
      Wizard.actualizarResumen();
    }
  }
}, 300);

// ════════════════════════════════════════════════════════════════
// 7. Función debug global
// ════════════════════════════════════════════════════════════════
window.estadoWizard = function () {
  const ok = !!(Wizard.servicioElegido && Wizard.fechaElegida && Wizard.empleadoElegido && Wizard.horaElegida);
  console.table({
    'Servicio': Wizard.servicioElegido?.nombre || '❌',
    'Fecha': Wizard.fechaElegida || '❌',
    'Empleado ID': Wizard.empleadoElegido || '❌',
    'Hora': Wizard.horaElegida || '❌',
    'CalState empleado': CalendarState?.empleadoSeleccionado || '❌',
    'CalState slot': CalendarState?.slotSeleccionado || '❌',
    'COMPLETO': ok ? '✅ SÍ' : '❌ NO',
    'Botón existe': !!document.querySelector('.resumen-cta'),
    'Botón disabled': document.querySelector('.resumen-cta')?.disabled
  });
};

console.log('✅ fix-wizard.js v2 cargado. Si falla, ejecuta: estadoWizard()');

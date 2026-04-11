/* ================================================================
   PARCHE COMPLETO — fix-wizard.js
   
   Carga este archivo DESPUÉS de app.js en index.html:
   
   <script src="js/calendar.js"></script>
   <script src="js/app.js"></script>
   <script src="js/fix-wizard.js"></script>  ← AÑADIR ESTA LÍNEA
   
   Arregla:
   1. Bug del 'this' en el listener de slotSeleccionado (Wizard no se actualizaba)
   2. CSS de slots cortados visualmente
   3. Sincronización entre CalendarState y Wizard
   ================================================================ */

// ════════════════════════════════════════════════════════════════
// 1. CSS — fix overflow de slots
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
    .slots-barbero {
      overflow: visible !important;
      height: auto !important;
      display: block !important;
    }
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
      transform: scale(1.05);
    }
    #paso-hora { max-height: none !important; overflow: visible !important; }
    .reservas-main, .reservas-layout {
      max-height: none !important;
      overflow: visible !important;
    }
    /* Asegurar que la CTA sea visible y prominente */
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
    }
    .resumen-cta:disabled {
      opacity: .5;
      cursor: not-allowed;
    }
  `;
  const old = document.querySelector('#fix-wizard-css');
  if (old) old.remove();
  const s = document.createElement('style');
  s.id = 'fix-wizard-css';
  s.textContent = css;
  document.head.appendChild(s);
})();

// ════════════════════════════════════════════════════════════════
// 2. FIX del listener slotSeleccionado (bug del 'this')
// ════════════════════════════════════════════════════════════════
// Quitar el listener viejo (si fuera posible) y registrar uno correcto.
// Como no podemos quitar el viejo, simplemente añadimos otro que SÍ
// actualiza Wizard correctamente — y hacemos el render del resumen.

document.addEventListener('slotSeleccionado', function (e) {
  if (typeof Wizard === 'undefined') {
    console.warn('Wizard no definido aún');
    return;
  }
  
  const { empleadoID, empleadoNombre, horaInicio, horaFin } = e.detail;
  
  console.log('🎯 Slot seleccionado:', { empleadoID, empleadoNombre, horaInicio });
  
  // Actualiza el estado del Wizard (el bug del 'this' impedía esto)
  Wizard.empleadoElegido = empleadoID;
  Wizard.horaElegida = horaInicio;
  
  // Marcar paso 3 como completo
  Wizard.marcarPasoCompleto(3);
  
  // Re-renderizar resumen con datos correctos
  Wizard.actualizarResumen();
  
  // Scroll al CTA
  setTimeout(function () {
    const cta = document.querySelector('.resumen-cta');
    if (cta) {
      cta.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 200);
});

// ════════════════════════════════════════════════════════════════
// 3. FIX del listener fechaSeleccionada (mismo bug del 'this')
// ════════════════════════════════════════════════════════════════
document.addEventListener('fechaSeleccionada', function (e) {
  if (typeof Wizard === 'undefined') return;
  
  const fecha = e.detail.fecha;
  console.log('📅 Fecha seleccionada:', fecha);
  
  // Solo procesar si Wizard aún no la tiene
  if (Wizard.fechaElegida !== fecha) {
    Wizard.onFechaSelected(fecha);
  }
});

// ════════════════════════════════════════════════════════════════
// 4. WATCHDOG — vigila CalendarState y sincroniza con Wizard
// ════════════════════════════════════════════════════════════════
// Por si el evento custom no se dispara, comprobamos cada 500ms
// si CalendarState tiene datos que Wizard no tiene aún.

let _lastSlotSync = '';
setInterval(function () {
  if (typeof Wizard === 'undefined' || typeof CalendarState === 'undefined') return;
  
  const csKey = (CalendarState.empleadoSeleccionado || '') + '|' + (CalendarState.slotSeleccionado || '');
  if (csKey === _lastSlotSync) return;
  _lastSlotSync = csKey;
  
  // Si CalendarState tiene un slot que Wizard no tiene → sincroniza
  if (CalendarState.empleadoSeleccionado && CalendarState.slotSeleccionado) {
    const cambio = (
      Wizard.empleadoElegido !== CalendarState.empleadoSeleccionado ||
      Wizard.horaElegida !== CalendarState.slotSeleccionado
    );
    
    if (cambio) {
      console.log('🔄 Sincronizando Wizard ← CalendarState');
      Wizard.empleadoElegido = CalendarState.empleadoSeleccionado;
      Wizard.horaElegida = CalendarState.slotSeleccionado;
      Wizard.marcarPasoCompleto(3);
      Wizard.actualizarResumen();
    }
  }
}, 500);

// ════════════════════════════════════════════════════════════════
// 5. Función debug global
// ════════════════════════════════════════════════════════════════
window.estadoWizard = function () {
  console.table({
    'Servicio': Wizard.servicioElegido?.nombre || '❌',
    'Fecha': Wizard.fechaElegida || '❌',
    'Empleado ID': Wizard.empleadoElegido || '❌',
    'Hora': Wizard.horaElegida || '❌',
    'CalState empleado': CalendarState.empleadoSeleccionado || '❌',
    'CalState slot': CalendarState.slotSeleccionado || '❌',
    'Completo': !!(Wizard.servicioElegido && Wizard.fechaElegida && Wizard.empleadoElegido && Wizard.horaElegida)
  });
};

console.log('✅ fix-wizard.js cargado. Ejecuta estadoWizard() en la consola para ver el estado.');

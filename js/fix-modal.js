/* ================================================================
   PARCHE — fix-modal.js
   
   El estado del Wizard ya está completo, el botón existe, pero al
   hacer click no se abre el modal. Este parche cubre 3 causas:
   
   1. abrirModalConfirmar no es global (window.) → la exporta
   2. El handler onclick inline se pierde tras re-render → reattacha
      el listener directo al botón cada vez que cambia el sidebar
   3. El modal tiene display:none con !important en el CSS → fuerza
      display:flex con clase .is-open
   
   Carga DESPUÉS de fix-wizard.js:
     <script src="js/fix-wizard.js"></script>
     <script src="js/fix-modal.js"></script>
   ================================================================ */

// ════════════════════════════════════════════════════════════════
// 1. Asegurar que abrirModalConfirmar sea global
// ════════════════════════════════════════════════════════════════
if (typeof abrirModalConfirmar !== 'undefined' && !window.abrirModalConfirmar) {
  window.abrirModalConfirmar = abrirModalConfirmar;
}
if (typeof cerrarModal !== 'undefined' && !window.cerrarModal) {
  window.cerrarModal = cerrarModal;
}
if (typeof confirmarReserva !== 'undefined' && !window.confirmarReserva) {
  window.confirmarReserva = confirmarReserva;
}

// ════════════════════════════════════════════════════════════════
// 2. Versión robusta de abrirModalConfirmar
// ════════════════════════════════════════════════════════════════
window.abrirModalConfirmar = function () {
  console.log('🔔 abrirModalConfirmar() llamada');
  
  if (typeof Wizard === 'undefined') {
    console.error('Wizard no definido');
    return;
  }
  
  if (!Wizard.servicioElegido || !Wizard.empleadoElegido || !Wizard.horaElegida) {
    console.error('Faltan datos del wizard:', {
      servicio: !!Wizard.servicioElegido,
      empleado: !!Wizard.empleadoElegido,
      hora: !!Wizard.horaElegida
    });
    return;
  }
  
  const emp = Wizard.disponibilidad && Wizard.disponibilidad[Wizard.empleadoElegido]
    ? Wizard.disponibilidad[Wizard.empleadoElegido].empleado
    : { nombre: 'Profesional' };
  
  const fecha = new Date(Wizard.fechaElegida + 'T12:00:00').toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  
  // Llenar campos del modal
  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setText('modal-srv', Wizard.servicioElegido.nombre);
  setText('modal-barbero', emp.nombre);
  setText('modal-fecha', fecha);
  setText('modal-hora', Wizard.horaElegida);
  setText('modal-precio', '$' + Wizard.servicioElegido.precio.toLocaleString('es-CL'));
  
  // Abrir modal — fuerza display y clase
  const modal = document.getElementById('modal-reserva');
  if (!modal) {
    console.error('❌ No existe #modal-reserva en el DOM');
    alert('Error: el modal de confirmación no está en la página. Verifica tu index.html');
    return;
  }
  
  modal.style.cssText = 'display: flex !important; opacity: 1 !important; z-index: 10000;';
  modal.classList.add('is-open');
  
  // Asegurar que el modal interno también se muestre
  const inner = modal.querySelector('.modal');
  if (inner) {
    inner.style.cssText = 'display: block !important; opacity: 1 !important; transform: none !important;';
  }
  
  console.log('✅ Modal abierto');
  
  // Focus en el primer input
  setTimeout(() => {
    const firstInput = modal.querySelector('input');
    if (firstInput) firstInput.focus();
  }, 100);
};

// ════════════════════════════════════════════════════════════════
// 3. Versión robusta de cerrarModal
// ════════════════════════════════════════════════════════════════
window.cerrarModal = function () {
  const modal = document.getElementById('modal-reserva');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.style.display = 'none';
  console.log('🔕 Modal cerrado');
};

// ════════════════════════════════════════════════════════════════
// 4. Re-attachear el listener del botón cada vez que el sidebar cambia
// ════════════════════════════════════════════════════════════════
// MutationObserver: cada vez que #resumen-seleccion cambia, busca el
// botón .resumen-cta y le añade un click listener directo (más
// confiable que onclick inline).

const sidebarObserver = new MutationObserver(function () {
  const btn = document.querySelector('.resumen-cta');
  if (!btn || btn.dataset.bound === '1') return;
  
  btn.dataset.bound = '1';
  btn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    console.log('🎬 Click en CTA desde listener directo');
    window.abrirModalConfirmar();
  });
  console.log('🔗 Listener de Confirmar reserva re-conectado');
});

const resumen = document.getElementById('resumen-seleccion');
if (resumen) {
  sidebarObserver.observe(resumen, { childList: true, subtree: true });
  console.log('👁️ Observer del sidebar activo');
}

// ════════════════════════════════════════════════════════════════
// 5. Click delegado a nivel document como red de seguridad
// ════════════════════════════════════════════════════════════════
document.addEventListener('click', function (e) {
  const btn = e.target.closest('.resumen-cta');
  if (!btn || btn.disabled) return;
  
  // Si el handler inline ya disparó, no duplicar
  if (e._handled) return;
  e._handled = true;
  
  console.log('🎬 Click en CTA desde delegación');
  setTimeout(() => window.abrirModalConfirmar(), 0);
}, false);

// ════════════════════════════════════════════════════════════════
// 6. CSS de respaldo para el modal
// ════════════════════════════════════════════════════════════════
(function modalCSS() {
  const css = `
    #modal-reserva.is-open {
      display: flex !important;
      opacity: 1 !important;
      align-items: center !important;
      justify-content: center !important;
      position: fixed !important;
      inset: 0 !important;
      background: rgba(0,0,0,0.75) !important;
      z-index: 10000 !important;
      backdrop-filter: blur(4px);
      padding: 20px;
    }
    #modal-reserva.is-open .modal {
      background: var(--card, #131829) !important;
      border: 1px solid var(--border, #2A2A40) !important;
      border-radius: 16px !important;
      max-width: 560px !important;
      width: 100% !important;
      max-height: 90vh !important;
      overflow-y: auto !important;
      padding: 0 !important;
      animation: modalIn .3s cubic-bezier(.16,1,.3,1) !important;
    }
    @keyframes modalIn {
      from { transform: translateY(20px) scale(.96); opacity: 0; }
      to { transform: translateY(0) scale(1); opacity: 1; }
    }
  `;
  const old = document.querySelector('#fix-modal-css');
  if (old) old.remove();
  const s = document.createElement('style');
  s.id = 'fix-modal-css';
  s.textContent = css;
  document.head.appendChild(s);
})();

// ════════════════════════════════════════════════════════════════
// 7. Debug: testar manualmente el modal
// ════════════════════════════════════════════════════════════════
window.testModal = function () {
  console.log('🧪 Test del modal:');
  console.log('  - Función global:', typeof window.abrirModalConfirmar);
  console.log('  - Modal en DOM:', !!document.getElementById('modal-reserva'));
  console.log('  - Botón en DOM:', !!document.querySelector('.resumen-cta'));
  console.log('  - Estado Wizard completo:', !!(Wizard.servicioElegido && Wizard.empleadoElegido && Wizard.horaElegida));
  console.log('Forzando apertura...');
  window.abrirModalConfirmar();
};

console.log('✅ fix-modal.js cargado. Si el botón no abre el modal, ejecuta: testModal()');

/* ================================================================
   PARCHE AGRESIVO — fix-modal.js v2
   
   El modal "se abre" (la función ejecuta) pero no se ve.
   Causa: styles.css tiene reglas más específicas que ocultan
   #modal-reserva.
   
   Solución: aplicamos estilos INLINE directos a cada elemento,
   movemos el modal al final del <body> para sacarlo de cualquier
   contenedor con overflow:hidden, y forzamos visibilidad total.
   ================================================================ */

// ════════════════════════════════════════════════════════════════
// 1. Globales
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
// 2. Mover el modal al <body> al cargar
// ════════════════════════════════════════════════════════════════
// Si está dentro de un contenedor con overflow:hidden o transform,
// nunca se verá bien. Lo movemos al final del body.
function moverModalAlBody() {
  const modal = document.getElementById('modal-reserva');
  if (!modal) return;
  if (modal.parentElement === document.body) return;
  document.body.appendChild(modal);
  console.log('📦 Modal movido al <body>');
}

// ════════════════════════════════════════════════════════════════
// 3. Versión NUCLEAR de abrirModalConfirmar
// ════════════════════════════════════════════════════════════════
window.abrirModalConfirmar = function () {
  console.log('🔔 abrirModalConfirmar() llamada');
  
  if (typeof Wizard === 'undefined' ||
      !Wizard.servicioElegido || !Wizard.empleadoElegido || !Wizard.horaElegida) {
    console.error('❌ Faltan datos en el Wizard');
    return;
  }
  
  // Asegurar que está en el body
  moverModalAlBody();
  
  const emp = Wizard.disponibilidad && Wizard.disponibilidad[Wizard.empleadoElegido]
    ? Wizard.disponibilidad[Wizard.empleadoElegido].empleado
    : { nombre: 'Profesional' };
  
  const fecha = new Date(Wizard.fechaElegida + 'T12:00:00').toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  
  // Llenar campos
  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setText('modal-srv', Wizard.servicioElegido.nombre);
  setText('modal-barbero', emp.nombre);
  setText('modal-fecha', fecha);
  setText('modal-hora', Wizard.horaElegida);
  setText('modal-precio', '$' + Wizard.servicioElegido.precio.toLocaleString('es-CL'));
  
  const modal = document.getElementById('modal-reserva');
  if (!modal) {
    alert('Error: el modal no está en el HTML');
    return;
  }
  
  // ⚡ ESTILOS INLINE NUCLEARES (imposibles de pisar)
  modal.setAttribute('style', [
    'display: flex',
    'opacity: 1',
    'visibility: visible',
    'pointer-events: auto',
    'position: fixed',
    'top: 0',
    'left: 0',
    'right: 0',
    'bottom: 0',
    'width: 100vw',
    'height: 100vh',
    'background: rgba(0, 0, 0, 0.85)',
    'backdrop-filter: blur(6px)',
    '-webkit-backdrop-filter: blur(6px)',
    'z-index: 2147483647',
    'align-items: center',
    'justify-content: center',
    'padding: 20px',
    'overflow-y: auto',
    'margin: 0'
  ].join(' !important; ') + ' !important;');
  
  modal.classList.add('is-open');
  
  // El contenedor interno también
  const inner = modal.querySelector('.modal');
  if (inner) {
    inner.setAttribute('style', [
      'display: block',
      'opacity: 1',
      'visibility: visible',
      'transform: none',
      'background: #131829',
      'border: 1px solid #2A2A40',
      'border-radius: 16px',
      'max-width: 560px',
      'width: 100%',
      'max-height: 90vh',
      'overflow-y: auto',
      'color: #fff',
      'position: relative',
      'margin: auto'
    ].join(' !important; ') + ' !important;');
  }
  
  // Bloquear scroll del body
  document.body.style.overflow = 'hidden';
  
  console.log('✅ Modal forzado a visible');
  
  setTimeout(() => {
    const firstInput = modal.querySelector('input');
    if (firstInput) firstInput.focus();
  }, 100);
};

// ════════════════════════════════════════════════════════════════
// 4. Cerrar modal
// ════════════════════════════════════════════════════════════════
window.cerrarModal = function () {
  const modal = document.getElementById('modal-reserva');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.style.cssText = 'display: none !important;';
  document.body.style.overflow = '';
  console.log('🔕 Modal cerrado');
};

// ════════════════════════════════════════════════════════════════
// 5. Re-attachear listener al botón cuando aparece
// ════════════════════════════════════════════════════════════════
const sidebarObserver = new MutationObserver(function () {
  const btn = document.querySelector('.resumen-cta');
  if (!btn || btn.dataset.bound === '1') return;
  
  btn.dataset.bound = '1';
  btn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    console.log('🎬 Click en CTA');
    window.abrirModalConfirmar();
  });
});

const resumen = document.getElementById('resumen-seleccion');
if (resumen) {
  sidebarObserver.observe(resumen, { childList: true, subtree: true });
  console.log('👁️ Observer del sidebar activo');
}

// Mover modal al body al cargar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', moverModalAlBody);
} else {
  moverModalAlBody();
}

// ════════════════════════════════════════════════════════════════
// 6. Cerrar al hacer click fuera o presionar Escape
// ════════════════════════════════════════════════════════════════
document.addEventListener('click', function (e) {
  const modal = document.getElementById('modal-reserva');
  if (!modal || !modal.classList.contains('is-open')) return;
  if (e.target === modal) {
    window.cerrarModal();
  }
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    const modal = document.getElementById('modal-reserva');
    if (modal && modal.classList.contains('is-open')) {
      window.cerrarModal();
    }
  }
});

// ════════════════════════════════════════════════════════════════
// 7. Debug
// ════════════════════════════════════════════════════════════════
window.testModal = function () {
  const modal = document.getElementById('modal-reserva');
  console.log('🧪 Test del modal:');
  console.log('  - Función global:', typeof window.abrirModalConfirmar);
  console.log('  - Modal en DOM:', !!modal);
  console.log('  - Modal padre:', modal?.parentElement?.tagName);
  if (modal) {
    const cs = getComputedStyle(modal);
    console.log('  - display:', cs.display);
    console.log('  - opacity:', cs.opacity);
    console.log('  - visibility:', cs.visibility);
    console.log('  - z-index:', cs.zIndex);
  }
  console.log('Forzando apertura...');
  window.abrirModalConfirmar();
};

window.inspeccionarModal = function () {
  const m = document.getElementById('modal-reserva');
  if (!m) return console.log('No existe');
  const cs = getComputedStyle(m);
  console.table({
    display: cs.display,
    opacity: cs.opacity,
    visibility: cs.visibility,
    'z-index': cs.zIndex,
    position: cs.position,
    top: cs.top,
    left: cs.left,
    width: cs.width,
    height: cs.height,
    parent: m.parentElement?.tagName,
    classes: m.className,
    inlineStyle: m.style.cssText.slice(0, 100)
  });
};

console.log('✅ fix-modal.js v3 NUCLEAR cargado. Si falla, ejecuta inspeccionarModal()');

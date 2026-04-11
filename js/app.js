/* ================================================================
   PLATAFORMA AGENDA — app.js (v3)
   
   Wizard de reserva con transiciones fluidas tipo "step reveal".
   Compatible con calendar.js v3 y supabase-client.js.
   
   Estructura del wizard:
     Paso 1: elegir servicio (visible al inicio)
     Paso 2: elegir fecha     (se revela al elegir servicio)
     Paso 3: elegir profesional + hora (se revela al elegir fecha)
     Modal: confirmación de datos
     Pantalla final: confirmación con código RES-XXXXX
   ================================================================ */

// ── INYECTAR CSS DE TRANSICIONES (sin tocar styles.css del usuario) ──
(function inyectarEstilos() {
  const css = `
    .paso { 
      transition: opacity .4s ease, max-height .5s ease, transform .4s ease, border-color .3s; 
      position: relative;
    }
    .paso--locked { 
      opacity: .35; 
      pointer-events: none; 
      filter: grayscale(.4);
    }
    .paso--active { 
      opacity: 1; 
    }
    .paso--active .paso-titulo { 
      color: var(--gold, #C9A84C) !important;
    }
    .paso--done .paso-titulo::after { 
      content: ' ✓';
      color: #22C55E;
      font-weight: 700;
    }
    .paso-titulo[data-paso]::before {
      transition: background .3s, transform .3s, color .3s;
    }
    .paso--active .paso-titulo[data-paso]::before {
      transform: scale(1.1);
    }
    
    /* Servicios */
    .srv-grid { 
      display: grid; 
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); 
      gap: 14px; 
    }
    .srv-card {
      background: var(--card, #1A1A2E);
      border: 1px solid var(--border, #2A2A40);
      border-radius: 14px;
      padding: 16px 18px;
      cursor: pointer;
      transition: all .25s ease;
      position: relative;
    }
    .srv-card:hover {
      transform: translateY(-3px);
      border-color: var(--gold, #C9A84C);
      box-shadow: 0 8px 24px rgba(201,168,76,.15);
    }
    .srv-card.selected {
      border-color: var(--gold, #C9A84C);
      background: linear-gradient(135deg, rgba(201,168,76,.12), rgba(201,168,76,.02));
      box-shadow: 0 0 0 2px rgba(201,168,76,.4);
    }
    .srv-card .srv-cat {
      font-size: 10px;
      text-transform: uppercase;
      color: var(--gold, #C9A84C);
      letter-spacing: .5px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .srv-card .srv-name {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--text, #fff);
    }
    .srv-card .srv-meta {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: var(--muted, #94A3B8);
    }
    .srv-card .srv-price {
      color: var(--gold-lt, #E4C875);
      font-weight: 700;
      font-size: 14px;
    }
    
    /* Filtro empleados */
    .emp-chips { 
      display: flex; 
      flex-wrap: wrap; 
      gap: 8px;
    }
    .emp-chip {
      background: var(--card, #1A1A2E);
      border: 1px solid var(--border, #2A2A40);
      border-radius: 999px;
      padding: 8px 16px;
      font-size: 13px;
      cursor: pointer;
      transition: all .2s;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--text, #fff);
    }
    .emp-chip:hover { border-color: var(--gold, #C9A84C); }
    .emp-chip.selected {
      background: var(--gold, #C9A84C);
      color: #000;
      border-color: var(--gold, #C9A84C);
      font-weight: 600;
    }
    .emp-chip .dot {
      width: 8px; height: 8px; border-radius: 50%;
    }
    
    /* Resumen sidebar */
    .resumen-fila {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid var(--border, #2A2A40);
      font-size: 13px;
    }
    .resumen-fila:last-child { border-bottom: none; }
    .resumen-fila span { color: var(--muted, #94A3B8); }
    .resumen-fila strong { color: var(--text, #fff); text-align: right; }
    .resumen-total {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 2px solid var(--gold, #C9A84C);
      display: flex;
      justify-content: space-between;
      font-size: 16px;
    }
    .resumen-total strong { color: var(--gold-lt, #E4C875); font-size: 18px; }
    .resumen-cta {
      width: 100%;
      margin-top: 14px;
      padding: 12px;
      background: var(--gold, #C9A84C);
      color: #000;
      border: none;
      border-radius: 10px;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      transition: all .2s;
    }
    .resumen-cta:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(201,168,76,.3); }
    .resumen-cta:disabled { opacity: .4; cursor: not-allowed; transform: none; box-shadow: none; }
    
    /* Modal */
    .modal-back {
      transition: opacity .25s;
    }
    .modal-back.is-open {
      display: flex !important;
      opacity: 1;
    }
    .modal-back.is-open .modal {
      animation: modalIn .35s cubic-bezier(.16,1,.3,1);
    }
    @keyframes modalIn {
      from { transform: translateY(20px) scale(.96); opacity: 0; }
      to   { transform: translateY(0) scale(1); opacity: 1; }
    }
    
    /* Pantalla final */
    .conf-screen { animation: fadeUp .5s ease; }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    
    /* Toast */
    .toast-error.show {
      opacity: 1 !important;
      transform: translateX(-50%) translateY(0) !important;
    }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();

// ════════════════════════════════════════════════════════════════
// ESTADO DEL WIZARD
// ════════════════════════════════════════════════════════════════
const Wizard = {
  servicios: [],
  empleados: [],
  servicioElegido: null,
  fechaElegida: null,
  empleadoElegido: null,
  horaElegida: null,
  disponibilidad: null,
  
  async init() {
    showLoader('Cargando...');
    try {
      this.servicios = await API.getServicios();
      this.empleados = await API.getEmpleados();
    } catch (e) {
      hideLoader();
      showError('Error al conectar con la base de datos: ' + e.message);
      return;
    }
    hideLoader();
    
    console.log(`✅ Datos cargados: ${this.servicios.length} servicios, ${this.empleados.length} empleados`);
    
    if (!this.servicios.length) {
      showError('No hay servicios cargados. Carga datos en Supabase.');
      return;
    }
    
    this.renderServicios();
    
    // Inicializar calendario (versión v3)
    if (typeof Calendar !== 'undefined') {
      Calendar.init('calendario', (fecha) => {
        this.onFechaSelected(fecha);
      });
    } else {
      console.error('Calendar no está definido. Verifica que calendar.js esté cargado antes que app.js');
    }
    
    // Escuchar eventos del calendar v3
    document.addEventListener('fechaSeleccionada', (e) => {
      this.onFechaSelected(e.detail.fecha);
    });
    
    document.addEventListener('slotSeleccionado', (e) => {
      const { empleadoID, empleadoNombre, horaInicio, horaFin } = e.detail;
      this.empleadoElegido = empleadoID;
      this.horaElegida = horaInicio;
      this.marcarPasoCompleto(3);
      this.actualizarResumen();
      
      // Scroll suave al resumen
      setTimeout(() => {
        document.querySelector('.resumen-cta')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    });
    
    this.activarPaso(1);
    this.actualizarResumen();
  },
  
  // ─────────────────────────────────────────────────────────────
  // PASO 1: SERVICIOS
  // ─────────────────────────────────────────────────────────────
  renderServicios() {
    const cont = document.getElementById('servicios-grid');
    if (!cont) return;
    
    // Agrupar por categoría
    const porCat = {};
    this.servicios.forEach(s => {
      const cat = s.categoria || 'Otros';
      (porCat[cat] = porCat[cat] || []).push(s);
    });
    
    let html = '<div class="srv-grid">';
    Object.keys(porCat).forEach(cat => {
      porCat[cat].forEach(s => {
        html += `
          <div class="srv-card" data-id="${s.id}">
            <div class="srv-cat">${escape(cat)}</div>
            <div class="srv-name">${escape(s.nombre)}</div>
            <div class="srv-meta">
              <span>⏱ ${s.duracion} min</span>
              <span class="srv-price">$${s.precio.toLocaleString('es-CL')}</span>
            </div>
          </div>
        `;
      });
    });
    html += '</div>';
    cont.innerHTML = html;
    
    // Click handlers
    cont.querySelectorAll('.srv-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        this.onServicioSelected(id);
      });
    });
  },
  
  onServicioSelected(id) {
    this.servicioElegido = this.servicios.find(s => s.id === id);
    if (!this.servicioElegido) return;
    
    document.querySelectorAll('.srv-card').forEach(c => {
      c.classList.toggle('selected', c.dataset.id === id);
    });
    
    // Si es sesión (tatuajes), mostrar selector
    const sesionGroup = document.getElementById('sesion-group');
    const sesionNum = document.getElementById('sesion-num');
    if (this.servicioElegido.esSesion && sesionGroup) {
      sesionGroup.style.display = 'block';
      sesionNum.innerHTML = '';
      for (let i = 1; i <= (this.servicioElegido.maxSesiones || 1); i++) {
        sesionNum.innerHTML += `<option value="${i}">Sesión ${i} de ${this.servicioElegido.maxSesiones}</option>`;
      }
    } else if (sesionGroup) {
      sesionGroup.style.display = 'none';
    }
    
    this.marcarPasoCompleto(1);
    this.activarPaso(2);
    this.actualizarResumen();
    
    // Resetear selecciones previas de fecha/hora
    this.fechaElegida = null;
    this.empleadoElegido = null;
    this.horaElegida = null;
    
    // Resetear calendario visualmente
    if (typeof Calendar !== 'undefined') {
      Calendar.reset();
    }
    
    // Limpiar slots container
    const slotsContainer = document.getElementById('slots-container');
    if (slotsContainer) {
      slotsContainer.innerHTML = '<p class="slots-vacio">Selecciona una fecha para ver disponibilidad.</p>';
    }
    
    // Scroll suave al paso 2
    setTimeout(() => {
      document.getElementById('paso-fecha')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
  },
  
  // ─────────────────────────────────────────────────────────────
  // PASO 2: FECHA
  // ─────────────────────────────────────────────────────────────
  async onFechaSelected(fecha) {
    this.fechaElegida = fecha;
    
    const display = document.getElementById('fecha-display');
    if (display) {
      const d = new Date(fecha + 'T12:00:00');
      display.textContent = d.toLocaleDateString('es-CL', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
    }
    
    if (!this.servicioElegido) {
      showError('Primero elige un servicio');
      return;
    }
    
    this.marcarPasoCompleto(2);
    this.activarPaso(3);
    this.actualizarResumen();
    
    // Cargar disponibilidad usando la función del calendar v3
    await this.cargarDisponibilidadSlots();
    
    setTimeout(() => {
      document.getElementById('paso-hora')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
  },
  
  // ─────────────────────────────────────────────────────────────
  // PASO 3: PROFESIONAL + HORA (usando calendar v3)
  // ─────────────────────────────────────────────────────────────
  async cargarDisponibilidadSlots() {
    if (!this.servicioElegido || !this.fechaElegida) return;
    
    const slotsContainer = document.getElementById('slots-container');
    if (slotsContainer) {
      slotsContainer.innerHTML = '<p class="slots-vacio">⏳ Buscando disponibilidad...</p>';
    }
    
    // Usar la función global de calendar.js v3
    if (typeof cargarDisponibilidad !== 'undefined') {
      const result = await cargarDisponibilidad(this.fechaElegida, this.servicioElegido.id);
      if (result && result.ok) {
        this.disponibilidad = result.empleados;
        // Renderizar filtro de profesionales
        this.renderEmpleadosFiltro();
      }
    } else {
      console.error('cargarDisponibilidad no está definida. calendar.js v3 está cargado?');
      if (slotsContainer) {
        slotsContainer.innerHTML = '<p class="slots-vacio">❌ Error: No se pudo cargar la disponibilidad</p>';
      }
    }
  },
  
  renderEmpleadosFiltro() {
    const cont = document.getElementById('empleados-filtro');
    if (!cont || !this.disponibilidad) {
      if (cont) cont.innerHTML = '';
      return;
    }
    
    const empleados = Object.values(this.disponibilidad).filter(e => e.hayDisponibilidad);
    
    if (!empleados.length) {
      cont.innerHTML = '<p class="slots-vacio">No hay profesionales con disponibilidad esta fecha</p>';
      return;
    }
    
    let html = '<div class="emp-chips">';
    empleados.forEach(({ empleado }) => {
      const sel = this.empleadoElegido === empleado.id ? 'selected' : '';
      html += `
        <div class="emp-chip ${sel}" data-emp="${empleado.id}">
          <span class="dot" style="background:${empleado.color || '#C9A84C'}"></span>
          <span>${escape(empleado.nombre)}</span>
        </div>
      `;
    });
    html += '</div>';
    cont.innerHTML = html;
    
    cont.querySelectorAll('.emp-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const empId = chip.dataset.emp;
        this.empleadoElegido = empId;
        this.horaElegida = null;
        this.renderEmpleadosFiltro();
        this.actualizarResumen();
        
        // Filtrar slots en calendar v3
        if (typeof window.CalendarState !== 'undefined') {
          window.CalendarState.empleadoSeleccionado = empId;
          // Forzar re-render de slots con el filtro
          if (this.disponibilidad) {
            // ✅ CORREGIDO - usar renderSlotsView
if (typeof renderSlotsView !== 'undefined') {
  renderSlotsView('slots-container', { empleados: this.disponibilidad, servicio: this.servicioElegido });
} else if (typeof window.renderSlotsView !== 'undefined') {
  window.renderSlotsView('slots-container', { empleados: this.disponibilidad, servicio: this.servicioElegido });
}
          }
        }
      });
    });
  },
  
  // ─────────────────────────────────────────────────────────────
  // ACTIVAR / MARCAR PASOS
  // ─────────────────────────────────────────────────────────────
  activarPaso(num) {
    [1, 2, 3].forEach(n => {
      const el = document.getElementById(['paso-servicio', 'paso-fecha', 'paso-hora'][n - 1]);
      if (!el) return;
      el.classList.remove('paso--active', 'paso--locked');
      if (n === num) el.classList.add('paso--active');
      else if (n > num) el.classList.add('paso--locked');
    });
  },
  
  marcarPasoCompleto(num) {
    const el = document.getElementById(['paso-servicio', 'paso-fecha', 'paso-hora'][num - 1]);
    if (el) el.classList.add('paso--done');
  },
  
  // ─────────────────────────────────────────────────────────────
  // RESUMEN SIDEBAR
  // ─────────────────────────────────────────────────────────────
  actualizarResumen() {
    const cont = document.getElementById('resumen-seleccion');
    if (!cont) return;
    
    if (!this.servicioElegido) {
      cont.innerHTML = '<p class="resumen-placeholder">Selecciona un servicio para continuar.</p>';
      return;
    }
    
    const empNombre = this.empleadoElegido && this.disponibilidad && this.disponibilidad[this.empleadoElegido]
      ? this.disponibilidad[this.empleadoElegido].empleado.nombre
      : null;
    
    const fechaFmt = this.fechaElegida
      ? new Date(this.fechaElegida + 'T12:00:00').toLocaleDateString('es-CL', {
          day: 'numeric', month: 'short'
        })
      : null;
    
    const profLabel = (window.TENANT && window.TENANT.t) 
      ? window.TENANT.t('profesionalCap') 
      : 'Profesional';
    
    let html = `
      <div class="resumen-fila"><span>Servicio</span><strong>${escape(this.servicioElegido.nombre)}</strong></div>
      <div class="resumen-fila"><span>Duración</span><strong>${this.servicioElegido.duracion} min</strong></div>
    `;
    if (fechaFmt) html += `<div class="resumen-fila"><span>Fecha</span><strong>${fechaFmt}</strong></div>`;
    if (empNombre) html += `<div class="resumen-fila"><span>${profLabel}</span><strong>${escape(empNombre)}</strong></div>`;
    if (this.horaElegida) html += `<div class="resumen-fila"><span>Hora</span><strong>${this.horaElegida}</strong></div>`;
    
    html += `<div class="resumen-total"><span>Total</span><strong>$${this.servicioElegido.precio.toLocaleString('es-CL')}</strong></div>`;
    
    const completo = this.servicioElegido && this.fechaElegida && this.empleadoElegido && this.horaElegida;
    html += `<button class="resumen-cta" ${completo ? '' : 'disabled'} onclick="abrirModalConfirmar()">
      ${completo ? '✅ Confirmar reserva' : 'Completa los pasos'}
    </button>`;
    
    cont.innerHTML = html;
  }
};

// ════════════════════════════════════════════════════════════════
// MODAL DE CONFIRMACIÓN
// ════════════════════════════════════════════════════════════════
function abrirModalConfirmar() {
  if (!Wizard.servicioElegido || !Wizard.empleadoElegido || !Wizard.horaElegida) return;
  
  const emp = Wizard.disponibilidad && Wizard.disponibilidad[Wizard.empleadoElegido]
    ? Wizard.disponibilidad[Wizard.empleadoElegido].empleado
    : { nombre: 'Profesional' };
  
  const fecha = new Date(Wizard.fechaElegida + 'T12:00:00').toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  
  document.getElementById('modal-srv').textContent     = Wizard.servicioElegido.nombre;
  document.getElementById('modal-barbero').textContent = emp.nombre;
  document.getElementById('modal-fecha').textContent   = fecha;
  document.getElementById('modal-hora').textContent    = Wizard.horaElegida;
  document.getElementById('modal-precio').textContent  = '$' + Wizard.servicioElegido.precio.toLocaleString('es-CL');
  
  const modal = document.getElementById('modal-reserva');
  modal.style.display = 'flex';
  setTimeout(() => modal.classList.add('is-open'), 10);
}

function cerrarModal() {
  const modal = document.getElementById('modal-reserva');
  modal.classList.remove('is-open');
  setTimeout(() => modal.style.display = 'none', 250);
}

async function confirmarReserva() {
  const nombre = document.getElementById('inp-nombre').value.trim();
  const email  = document.getElementById('inp-email').value.trim();
  const tel    = document.getElementById('inp-tel').value.trim();
  const notas  = document.getElementById('inp-notas').value.trim();
  const sesionNumEl = document.getElementById('sesion-num');
  const sesionNum = sesionNumEl ? parseInt(sesionNumEl.value) || 1 : 1;
  
  if (!nombre || nombre.length < 2) { showError('Nombre inválido'); return; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError('Email inválido'); return; }
  
  showLoader('Creando reserva...');
  
  const res = await API.crearReserva({
    nombre, email, telefono: tel, notas,
    servicioID: Wizard.servicioElegido.id,
    empleadoID: Wizard.empleadoElegido,
    fecha:      Wizard.fechaElegida,
    horaInicio: Wizard.horaElegida,
    sesionNum
  });
  
  hideLoader();
  
  if (!res.ok) {
    showError(res.error || 'Error al crear la reserva');
    return;
  }
  
  cerrarModal();
  mostrarConfirmacion(res.reserva, res.codigo);
}

// ════════════════════════════════════════════════════════════════
// PANTALLA DE CONFIRMACIÓN FINAL
// ════════════════════════════════════════════════════════════════
function mostrarConfirmacion(reserva, codigo) {
  document.getElementById('reservas-screen').style.display = 'none';
  document.getElementById('confirmacion-screen').style.display = 'block';
  
  document.getElementById('conf-id').textContent      = codigo || reserva.codigo || reserva.id;
  document.getElementById('conf-nombre').textContent  = reserva.nombre_cliente;
  document.getElementById('conf-srv').textContent     = reserva.servicio_nombre;
  document.getElementById('conf-barbero').textContent = reserva.empleado_nombre;
  
  const fecha = new Date(reserva.fecha + 'T12:00:00').toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  document.getElementById('conf-fecha').textContent = fecha;
  document.getElementById('conf-hora').textContent  = reserva.hora_inicio.slice(0, 5);
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  console.log('📨 Reserva creada — webhook AS dispatched.');
}

function nuevaReserva() {
  document.getElementById('confirmacion-screen').style.display = 'none';
  document.getElementById('reservas-screen').style.display = 'block';
  
  Wizard.servicioElegido = null;
  Wizard.fechaElegida = null;
  Wizard.empleadoElegido = null;
  Wizard.horaElegida = null;
  Wizard.disponibilidad = null;
  
  document.querySelectorAll('.srv-card').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('.paso').forEach(p => p.classList.remove('paso--done'));
  document.getElementById('slots-container').innerHTML = '<p class="slots-vacio">Selecciona un servicio y fecha para ver disponibilidad.</p>';
  document.getElementById('empleados-filtro').innerHTML = '';
  document.getElementById('fecha-display').textContent = '';
  
  ['inp-nombre', 'inp-email', 'inp-tel', 'inp-notas'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  
  Wizard.activarPaso(1);
  Wizard.actualizarResumen();
  
  if (typeof Calendar !== 'undefined') {
    Calendar.reset();
  }
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ════════════════════════════════════════════════════════════════
// HELPERS UI
// ════════════════════════════════════════════════════════════════
function showLoader(msg) {
  const l = document.getElementById('loader');
  if (!l) return;
  l.style.display = 'flex';
  const t = document.getElementById('loader-txt');
  if (t) t.textContent = msg || 'Cargando...';
}
function hideLoader() {
  const l = document.getElementById('loader');
  if (l) l.style.display = 'none';
}
function showError(msg) {
  const t = document.getElementById('toast-error');
  if (!t) { alert(msg); return; }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 4000);
}
function escape(s) {
  return String(s || '').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
}

// ════════════════════════════════════════════════════════════════
// DEBUG
// ════════════════════════════════════════════════════════════════
window.testAppsScript = function() {
  const url = window.TENANT?.appsScriptUrl;
  if (!url || url.includes('REEMPLAZAR')) {
    alert('❌ La URL del Apps Script en tenant.config.js NO está configurada.');
    return;
  }
  console.log('🔧 Abriendo Apps Script URL:', url);
  window.open(url, '_blank');
};

// ════════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  if (typeof API === 'undefined') {
    showError('supabase-client.js no cargó. Verifica las rutas en index.html');
    return;
  }
  Wizard.init();
  
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') cerrarModal();
  });
  
  console.log('💡 app.js v3 cargado. Calendar v3 integrado.');
});

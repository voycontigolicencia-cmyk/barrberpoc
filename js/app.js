/* ================================================================
   BARBERÍA PRO — app.js (Migrado a Supabase)
   Lógica principal del frontend de reservas
   ================================================================ */

const state = {
  servicios:    [],
  empleados:    [],
  servicioSel:  null,
  slotSel:      null,
  fechaSel:     null,
  disponibilidad: {}
};

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Verificar que API está disponible
  if (typeof API === 'undefined') {
    console.error('❌ API no disponible. Verifica supabase-config.js');
    mostrarError('Error de configuración. Recarga la página.');
    return;
  }

  aplicarLogo();
  mostrarLoader(true, 'Cargando servicios…');
  
  try {
    const [srv, emp] = await Promise.all([
      API.getServicios(), 
      API.getEmpleados()
    ]);
    state.servicios = Array.isArray(srv) ? srv : [];
    state.empleados = Array.isArray(emp) ? emp : [];
    renderServicios();
    renderEmpleadosFiltro();
    console.log('✅ Datos cargados:', state.servicios.length, 'servicios,', state.empleados.length, 'empleados');
  } catch(e) {
    console.error('Error cargando datos:', e);
    mostrarError('Error al cargar datos. Recarga la página.');
  } finally {
    mostrarLoader(false);
  }
  
  renderCalendario('calendario');
  escucharEventos();
});

// ── LOGO ──────────────────────────────────────────────────────
function aplicarLogo() {
  if (typeof CONFIG === 'undefined' || !CONFIG.logoUrl) return;
  
  const navLogo = document.getElementById('nav-logo');
  if (navLogo) {
    navLogo.innerHTML = `<img src="${CONFIG.logoUrl}" alt="${CONFIG.nombre}"
      style="height:38px;width:38px;border-radius:50%;object-fit:cover;border:2px solid var(--gold)">`;
  }
  
  ['sidebar-logo','footer-logo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<img src="${CONFIG.logoUrl}" alt="${CONFIG.nombre}"
      style="height:52px;border-radius:10px;object-fit:contain">`;
  });
}

// ── SERVICIOS ─────────────────────────────────────────────────
function renderServicios() {
  const cont = document.getElementById('servicios-grid');
  if (!cont) return;

  if (!state.servicios.length) {
    cont.innerHTML = '<p style="color:var(--hint);padding:20px;text-align:center">Sin servicios disponibles</p>';
    return;
  }

  // Agrupar por categoría
  const cats = {};
  state.servicios.forEach(s => {
    if (!cats[s.categoria]) cats[s.categoria] = [];
    cats[s.categoria].push(s);
  });

  let html = '';
  Object.entries(cats).forEach(([cat, svs]) => {
    html += `<div class="srv-categoria">
      <h3 class="srv-cat-titulo">${cat}</h3>
      <div class="srv-lista">`;

    svs.forEach(s => {
      const durStr = s.duracion >= 60
        ? `${Math.floor(s.duracion/60)}h${s.duracion%60 ? ' '+s.duracion%60+'min':''}`
        : `${s.duracion} min`;
      const esSel  = state.servicioSel && state.servicioSel.id === s.id;
      const sesTag = s.esSesion
        ? `<span class="srv-sesion">📅 ${s.maxSesiones} sesiones</span>` : '';
      const skTag  = s.requiereSkill
        ? `<span class="srv-skill">${s.requiereSkill}</span>` : '';

      html += `
        <div class="srv-card ${esSel ? 'srv-card--sel' : ''}"
             onclick="seleccionarServicio('${s.id}')">
          <div class="srv-card-info">
            <div class="srv-card-nombre">${s.nombre} ${sesTag} ${skTag}</div>
            <div class="srv-card-detalles">
              <span class="srv-duracion">⏱ ${durStr}</span>
              <span class="srv-precio">$${s.precio.toLocaleString('es-CL')}</span>
            </div>
          </div>
          <div class="srv-card-check ${esSel ? 'activo' : ''}">✓</div>
        </div>`;
    });
    html += '</div></div>';
  });

  cont.innerHTML = html;
}

function seleccionarServicio(servicioID) {
  const srv = state.servicios.find(s => s.id === servicioID);
  if (!srv) return;

  state.servicioSel = srv;
  state.slotSel     = null;

  renderServicios();

  if (state.fechaSel) cargarDisponibilidad();

  actualizarResumen();

  document.getElementById('paso-fecha')
    ?.scrollIntoView({ behavior:'smooth', block:'start' });
}

// ── FILTRO EMPLEADOS ──────────────────────────────────────────
function renderEmpleadosFiltro() {
  const cont = document.getElementById('empleados-filtro');
  if (!cont) return;

  let html = `<button class="emp-filtro-btn emp-filtro-btn--all activo"
    onclick="filtrarEmpleado(null,this)">Todos</button>`;
  state.empleados.forEach(e => {
    html += `<button class="emp-filtro-btn" style="border-color:${e.color}"
      onclick="filtrarEmpleado('${e.id}',this)">${e.nombre}</button>`;
  });
  cont.innerHTML = html;
}

let filtroEmpActivo = null;

function filtrarEmpleado(empID, btn) {
  document.querySelectorAll('.emp-filtro-btn').forEach(b => b.classList.remove('activo'));
  btn.classList.add('activo');
  filtroEmpActivo = empID;
  renderSlotsActuales();
}

// ── DISPONIBILIDAD ────────────────────────────────────────────
async function cargarDisponibilidad() {
  if (!state.servicioSel || !state.fechaSel) return;

  mostrarLoader(true, 'Buscando horarios disponibles…');
  try {
    const data = await API.getDisponibilidad(state.fechaSel, state.servicioSel.id);
    state.disponibilidad = (data && data.empleados) ? data.empleados : {};
    renderSlotsActuales();
  } catch(e) {
    console.error('Error cargando disponibilidad:', e);
    mostrarError('Error al cargar disponibilidad.');
    state.disponibilidad = {};
    renderSlotsActuales();
  } finally {
    mostrarLoader(false);
  }
}

function renderSlotsActuales() {
  let empleados = { ...state.disponibilidad };
  if (filtroEmpActivo && empleados[filtroEmpActivo]) {
    empleados = { [filtroEmpActivo]: empleados[filtroEmpActivo] };
  } else if (filtroEmpActivo) {
    empleados = {};
  }
  renderSlots('slots-container', empleados);
}

// ── EVENTOS ───────────────────────────────────────────────────
function escucharEventos() {
  document.addEventListener('fechaSeleccionada', e => {
    state.fechaSel = e.detail.fecha;
    state.slotSel  = null;

    const el = document.getElementById('fecha-display');
    if (el) el.textContent = _formatFecha(state.fechaSel);

    actualizarResumen();
    if (state.servicioSel) cargarDisponibilidad();
    else mostrarError('Selecciona un servicio primero.');
  });

  document.addEventListener('slotSeleccionado', e => {
    const { empleadoID, empleadoNombre, horaInicio, horaFin } = e.detail;
    state.slotSel = { empleadoID, empleadoNombre, horaInicio, horaFin };
    filtroEmpActivo = empleadoID;
    actualizarResumen();
    abrirModalReserva();
  });
}

// ── RESUMEN LATERAL ───────────────────────────────────────────
function actualizarResumen() {
  const el = document.getElementById('resumen-seleccion');
  if (!el) return;

  if (!state.servicioSel && !state.fechaSel) {
    el.innerHTML = '<p class="resumen-placeholder">Selecciona un servicio y fecha para continuar.</p>';
    return;
  }

  let html = '<div class="resumen-items">';

  if (state.servicioSel) {
    html += `
      <div class="resumen-item"><span>✂️ Servicio</span><strong>${state.servicioSel.nombre}</strong></div>
      <div class="resumen-item"><span>⏱ Duración</span><strong>${state.servicioSel.duracion} min</strong></div>
      <div class="resumen-item"><span>💰 Precio</span><strong>$${state.servicioSel.precio.toLocaleString('es-CL')}</strong></div>`;
  }
  if (state.fechaSel) {
    html += `<div class="resumen-item"><span>📅 Fecha</span><strong>${_formatFecha(state.fechaSel)}</strong></div>`;
  }
  if (state.slotSel) {
    html += `
      <div class="resumen-item"><span>🕐 Hora</span><strong>${state.slotSel.horaInicio}</strong></div>
      <div class="resumen-item"><span>💈 Barbero</span><strong>${state.slotSel.empleadoNombre}</strong></div>`;
  }

  html += '</div>';

  if (state.servicioSel && state.fechaSel && state.slotSel) {
    html += `<button class="btn-reservar" onclick="abrirModalReserva()">
      Confirmar Reserva →
    </button>`;
  } else if (state.servicioSel && state.fechaSel && !state.slotSel) {
    html += `<p style="font-size:12px;color:var(--hint);margin-top:12px;text-align:center">
      👆 Elige un horario disponible arriba
    </p>`;
  }

  el.innerHTML = html;
}

// ── MODAL ─────────────────────────────────────────────────────
function abrirModalReserva() {
  if (!state.servicioSel || !state.fechaSel || !state.slotSel) {
    mostrarError('Selecciona servicio, fecha y hora primero.');
    return;
  }

  document.getElementById('modal-srv').textContent     = state.servicioSel.nombre;
  document.getElementById('modal-barbero').textContent = state.slotSel.empleadoNombre;
  document.getElementById('modal-fecha').textContent   = _formatFecha(state.fechaSel);
  document.getElementById('modal-hora').textContent    = `${state.slotSel.horaInicio} — ${state.slotSel.horaFin}`;
  document.getElementById('modal-precio').textContent  = `$${state.servicioSel.precio.toLocaleString('es-CL')} CLP`;

  const sesionGroup = document.getElementById('sesion-group');
  if (state.servicioSel.esSesion && sesionGroup) {
    sesionGroup.style.display = 'block';
    const sel = document.getElementById('sesion-num');
    sel.innerHTML = '';
    for (let i = 1; i <= state.servicioSel.maxSesiones; i++) {
      sel.innerHTML += `<option value="${i}">Sesión ${i} de ${state.servicioSel.maxSesiones}</option>`;
    }
  } else if (sesionGroup) {
    sesionGroup.style.display = 'none';
  }

  ['inp-nombre','inp-email','inp-tel','inp-notas'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  document.getElementById('modal-reserva').classList.add('open');
}

function cerrarModal() {
  document.getElementById('modal-reserva').classList.remove('open');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('modal-reserva')?.addEventListener('click', function(e) {
    if (e.target === this) cerrarModal();
  });
});

// ── CONFIRMAR RESERVA ─────────────────────────────────────────
async function confirmarReserva() {
  const nombre = document.getElementById('inp-nombre')?.value.trim();
  const email  = document.getElementById('inp-email')?.value.trim();
  const tel    = document.getElementById('inp-tel')?.value.trim();
  const notas  = document.getElementById('inp-notas')?.value.trim();
  const sesion = document.getElementById('sesion-num')?.value || 1;

  if (!nombre || nombre.length < 2) { mostrarError('Ingresa tu nombre completo.'); return; }
  if (!email  || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { mostrarError('Email inválido.'); return; }

  const payload = {
    nombre, 
    email,
    telefono:   tel || '',
    servicioID: state.servicioSel.id,
    empleadoID: state.slotSel.empleadoID,
    fecha:      state.fechaSel,
    horaInicio: state.slotSel.horaInicio,
    notas:      notas || '',
    sesionNum:  parseInt(sesion)
  };

  mostrarLoader(true, 'Confirmando tu reserva…');
  try {
    const res = await API.crearReserva(payload);
    mostrarLoader(false);

    if (res.ok) {
      cerrarModal();
      mostrarConfirmacion(res.reservaID, res.reserva);
      cargarDisponibilidad();
    } else {
      mostrarError(res.error || 'Error al crear la reserva. Intenta de nuevo.');
    }
  } catch(e) {
    mostrarLoader(false);
    console.error('Error creando reserva:', e);
    mostrarError('Error de conexión. Intenta de nuevo.');
  }
}

// ── CONFIRMACIÓN ──────────────────────────────────────────────
function mostrarConfirmacion(reservaID, reserva) {
  const reservasScreen = document.getElementById('reservas-screen');
  const confScreen     = document.getElementById('confirmacion-screen');
  if (!confScreen) return;

  if (reservasScreen) reservasScreen.style.display = 'none';
  confScreen.style.display = 'block';

  document.getElementById('conf-id').textContent      = reservaID;
  document.getElementById('conf-nombre').textContent  = reserva?.nombre || '';
  document.getElementById('conf-srv').textContent     = reserva?.servicioNombre || '';
  document.getElementById('conf-barbero').textContent = reserva?.empleadoNombre || '';
  document.getElementById('conf-fecha').textContent   = _formatFecha(reserva?.fecha) || '';
  document.getElementById('conf-hora').textContent    = reserva?.horaInicio || '';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function nuevaReserva() {
  const reservasScreen = document.getElementById('reservas-screen');
  const confScreen     = document.getElementById('confirmacion-screen');
  if (reservasScreen) reservasScreen.style.display = 'block';
  if (confScreen)     confScreen.style.display = 'none';

  state.slotSel    = null;
  state.fechaSel   = null;
  state.servicioSel= null;
  filtroEmpActivo  = null;
  actualizarResumen();
  renderServicios();
  renderCalendario('calendario');
}

// ── HELPERS ───────────────────────────────────────────────────
function mostrarLoader(show, txt) {
  const el = document.getElementById('loader');
  if (!el) return;
  el.style.display = show ? 'flex' : 'none';
  const txtEl = document.getElementById('loader-txt');
  if (txtEl && txt) txtEl.textContent = txt;
}

function mostrarError(msg) {
  const el = document.getElementById('toast-error');
  if (!el) return;
  el.textContent = '❌ ' + msg;
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 4000);
}

function _formatFecha(str) {
  if (!str) return '';
  const dias  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const meses = ['enero','febrero','marzo','abril','mayo','junio',
                 'julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const f = new Date(str + 'T12:00:00');
  return `${dias[f.getDay()]} ${f.getDate()} de ${meses[f.getMonth()]} ${f.getFullYear()}`;
}

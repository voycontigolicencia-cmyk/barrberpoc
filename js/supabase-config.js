/* ================================================================
   PLATAFORMA AGENDA — supabase-config.js (v2)
   
   Cliente Supabase + capa API. Lee de window.TENANT.
   
   Cambios v2 vs v1:
   · Sin secretos del Edge Function (notificaciones eliminadas)
   · Tras crearReserva, dispara fetch al Apps Script Web App en
     modo híbrido (rápido para el cliente + retry en background)
   · Soporte para todos los nuevos campos: pagos, comentarios,
     historial, agendas cerradas
   · API.clientes y API.historial expuestos para el admin
   ================================================================ */

// ── REQUIERE QUE window.TENANT esté cargado ──
if (!window.TENANT) {
  throw new Error('Carga tenant.config.js ANTES que este archivo');
}

// ── CONFIGURACIÓN SUPABASE ──
// Edita estos dos valores con los de tu proyecto Supabase
const SUPABASE_URL = 'https://zvpcxuvoyotilvmaagqg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2cGN4dXZveW90aWx2bWFhZ3FnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MjE0ODQsImV4cCI6MjA5MTQ5NzQ4NH0.LpmnuBfDd2p73R4T1nQXQMMcP7xjKs-DoeF4NSY1xIA';

if (typeof supabase === 'undefined') {
  console.error('❌ Carga el SDK de Supabase ANTES que este archivo');
}

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── EXPORTS GLOBALES ──
window.db        = db;
window.SUPABASE_URL = SUPABASE_URL;
window.CONFIG    = window.TENANT;          // alias retro-compat
window.ESTADOS   = window.TENANT.estados;

// ══════════════════════════════════════════════════════════════════
// API
// ══════════════════════════════════════════════════════════════════

const API = {
  
  // ─────────────────────────────────────────────────────────────────
  // SERVICIOS
  // ─────────────────────────────────────────────────────────────────
  async getServicios() {
    try {
      const { data, error } = await db
        .from('servicios')
        .select('*')
        .eq('activo', true)
        .order('orden', { ascending: true })
        .order('categoria', { ascending: true });
      
      if (error) throw error;
      
      return data.map(s => ({
        id:            s.id,
        nombre:        s.nombre,
        duracion:      s.duracion_min,
        precio:        s.precio,
        categoria:     s.categoria,
        requiereSkill: s.requiere_skill || '',
        esSesion:      s.es_sesion,
        maxSesiones:   s.max_sesiones,
        descripcion:   s.descripcion
      }));
    } catch (e) {
      console.error('getServicios:', e);
      return [];
    }
  },
  
  // ─────────────────────────────────────────────────────────────────
  // EMPLEADOS / PROFESIONALES
  // ─────────────────────────────────────────────────────────────────
  async getEmpleados() {
    try {
      const { data, error } = await db
        .from('empleados')
        .select('*')
        .eq('activo', true)
        .order('orden', { ascending: true })
        .order('nombre', { ascending: true });
      
      if (error) throw error;
      
      return data.map(e => ({
        id:          e.id,
        nombre:      e.nombre,
        email:       e.email,
        telefono:    e.telefono || '',
        skills:      e.skills || [],
        color:       e.color || '#6B7280',
        foto:        e.foto_url || '',
        descripcion: e.descripcion || ''
      }));
    } catch (e) {
      console.error('getEmpleados:', e);
      return [];
    }
  },
  
  // ─────────────────────────────────────────────────────────────────
  // DISPONIBILIDAD
  // ─────────────────────────────────────────────────────────────────
  async getDisponibilidad(fecha, servicioID) {
    try {
      const servicios = await this.getServicios();
      const servicio = servicios.find(s => s.id === servicioID);
      if (!servicio) return { ok: false, error: 'Servicio no encontrado' };
      
      let empleados = await this.getEmpleados();
      if (servicio.requiereSkill) {
        empleados = empleados.filter(e => e.skills.includes(servicio.requiereSkill));
      }
      
      const fechaObj = new Date(fecha + 'T12:00:00');
      const diaSemana = fechaObj.getDay();
      
      // horarios + reservas + agendas cerradas en paralelo
      const [horariosRes, reservasRes, cerradasRes] = await Promise.all([
        db.from('horarios').select('*').eq('dia_semana', diaSemana).eq('disponible', true),
        db.from('reservas').select('*').eq('fecha', fecha).neq('estado', window.TENANT.estados.CANCELADA),
        db.from('agendas_cerradas').select('*').eq('fecha', fecha).eq('activo', true)
      ]);
      
      if (horariosRes.error)  throw horariosRes.error;
      if (reservasRes.error)  throw reservasRes.error;
      if (cerradasRes.error)  throw cerradasRes.error;
      
      const horarios = horariosRes.data || [];
      const reservas = reservasRes.data || [];
      const cerradas = cerradasRes.data || [];
      
      const resultado = {};
      for (const emp of empleados) {
        const horario = horarios.find(h => h.empleado_id === emp.id);
        if (!horario) continue;
        
        // Si el negocio entero está cerrado o este empleado lo está
        const cerradoEmp = cerradas.filter(c => !c.empleado_id || c.empleado_id === emp.id);
        const cerradoTodoElDia = cerradoEmp.some(c => !c.hora_inicio);
        if (cerradoTodoElDia) {
          resultado[emp.id] = { empleado: emp, slots: [], hayDisponibilidad: false, cerrado: true };
          continue;
        }
        
        const reservasEmp = reservas.filter(r => r.empleado_id === emp.id);
        const slots = this._calcularSlots(
          horario.hora_inicio, horario.hora_fin,
          servicio.duracion, reservasEmp, cerradoEmp, fecha
        );
        
        resultado[emp.id] = {
          empleado: emp,
          slots,
          hayDisponibilidad: slots.some(s => s.disponible)
        };
      }
      
      return { ok: true, servicio, fecha, empleados: resultado };
    } catch (e) {
      console.error('getDisponibilidad:', e);
      return { ok: false, error: e.message };
    }
  },
  
  _calcularSlots(horaInicio, horaFin, duracionServicio, reservas, cerradas, fecha) {
    const slots = [];
    const inicio = this._horaAMinutos(horaInicio);
    const fin    = this._horaAMinutos(horaFin);
    
    const ahora = new Date();
    const hoyStr = ahora.toISOString().split('T')[0];
    const esHoy = fecha === hoyStr;
    const minutosAhora = esHoy ? (ahora.getHours() * 60 + ahora.getMinutes()) : 0;
    
    for (let mins = inicio; mins < fin; mins += window.TENANT.slotMinutos) {
      const slotInicio = this._minutosAHora(mins);
      const slotFin    = this._minutosAHora(mins + duracionServicio);
      
      if (mins + duracionServicio > fin) break;
      
      if (esHoy && mins <= minutosAhora) {
        slots.push({ horaInicio: slotInicio, horaFin: slotFin, disponible: false, pasado: true });
        continue;
      }
      
      // conflicto con reserva existente
      const ocupadoReserva = reservas.some(r => {
        const ri = this._horaAMinutos(r.hora_inicio);
        const rf = this._horaAMinutos(r.hora_fin);
        return mins < rf && (mins + duracionServicio) > ri;
      });
      
      // conflicto con agenda cerrada parcial
      const ocupadoCerrada = cerradas.some(c => {
        if (!c.hora_inicio) return false;
        const ci = this._horaAMinutos(c.hora_inicio);
        const cf = this._horaAMinutos(c.hora_fin || c.hora_inicio);
        return mins < cf && (mins + duracionServicio) > ci;
      });
      
      slots.push({
        horaInicio: slotInicio,
        horaFin: slotFin,
        disponible: !ocupadoReserva && !ocupadoCerrada
      });
    }
    return slots;
  },
  
  _horaAMinutos(hora) {
    if (!hora) return 0;
    const str = String(hora).replace(/:\d{2}$/, '');
    const [h, m] = str.split(':').map(Number);
    return h * 60 + (m || 0);
  },
  
  _minutosAHora(mins) {
    const h = Math.floor(mins / 60), m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  },
  
  // ─────────────────────────────────────────────────────────────────
  // CREAR RESERVA (modo híbrido)
  // ─────────────────────────────────────────────────────────────────
  async crearReserva(payload) {
    try {
      const validacion = this._validarPayload(payload);
      if (validacion) return { ok: false, error: validacion };
      
      const servicios = await this.getServicios();
      const servicio = servicios.find(s => s.id === payload.servicioID);
      if (!servicio) return { ok: false, error: 'Servicio no encontrado' };
      
      const empleados = await this.getEmpleados();
      const empleado = empleados.find(e => e.id === payload.empleadoID);
      if (!empleado) return { ok: false, error: window.TENANT.t('profesionalCap') + ' no encontrado' };
      
      if (servicio.requiereSkill && !empleado.skills.includes(servicio.requiereSkill)) {
        return { ok: false, error: 'El ' + window.TENANT.profesionalLabel + ' seleccionado no realiza este servicio' };
      }
      
      const horaFin = this._minutosAHora(this._horaAMinutos(payload.horaInicio) + servicio.duracion);
      
      // Doble check de solapamiento
      const { data: existentes } = await db
        .from('reservas')
        .select('id, hora_inicio, hora_fin')
        .eq('empleado_id', payload.empleadoID)
        .eq('fecha', payload.fecha)
        .neq('estado', window.TENANT.estados.CANCELADA);
      
      const nuevaInicio = this._horaAMinutos(payload.horaInicio);
      const nuevaFin = this._horaAMinutos(horaFin);
      const conflicto = (existentes || []).some(r => {
        const ei = this._horaAMinutos(r.hora_inicio);
        const ef = this._horaAMinutos(r.hora_fin);
        return nuevaInicio < ef && nuevaFin > ei;
      });
      if (conflicto) return { ok: false, error: 'El horario ya no está disponible' };
      
      const reservaData = {
        nombre_cliente:   payload.nombre.trim(),
        email:            payload.email.toLowerCase().trim(),
        telefono:         payload.telefono || '',
        servicio_id:      servicio.id,
        servicio_nombre:  servicio.nombre,
        empleado_id:      empleado.id,
        empleado_nombre:  empleado.nombre,
        fecha:            payload.fecha,
        hora_inicio:      payload.horaInicio,
        hora_fin:         horaFin,
        duracion_min:     servicio.duracion,
        precio:           servicio.precio,
        notas_cliente:    payload.notas || '',
        sesion_num:       parseInt(payload.sesionNum) || 1,
        sesiones_totales: servicio.esSesion ? servicio.maxSesiones : 1,
        estado:           window.TENANT.estados.CONFIRMADA
      };
      
      const { data, error } = await db
        .from('reservas')
        .insert(reservaData)
        .select()
        .single();
      
      if (error) throw error;
      
      // upsert cliente CRM
      this._upsertCliente(data).catch(e => console.warn('CRM:', e));
      
      // dispara webhook al Apps Script (modo híbrido)
      this._dispatchAppsScript('nuevaReserva', data);
      
      return { ok: true, reservaID: data.id, codigo: data.codigo, reserva: data };
    } catch (e) {
      console.error('crearReserva:', e);
      return { ok: false, error: 'Error al crear la reserva: ' + e.message };
    }
  },
  
  _validarPayload(p) {
    if (!p) return 'Datos vacíos';
    if (!p.nombre || p.nombre.trim().length < 2) return 'Nombre inválido';
    if (!p.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) return 'Email inválido';
    if (!p.servicioID) return 'Servicio requerido';
    if (!p.empleadoID) return window.TENANT.t('profesionalCap') + ' requerido';
    if (!p.fecha) return 'Fecha requerida';
    if (!p.horaInicio) return 'Hora requerida';
    const fechaReserva = new Date(p.fecha + 'T' + p.horaInicio + ':00');
    if (fechaReserva < new Date()) return 'No puedes reservar en fecha pasada';
    return null;
  },
  
  // ─────────────────────────────────────────────────────────────────
  // CANCELAR / REAGENDAR / CAMBIAR ESTADO
  // ─────────────────────────────────────────────────────────────────
  async cancelarReserva(reservaID, motivo, canceladoPor = 'cliente') {
    try {
      const { data: reserva } = await db.from('reservas').select('*').eq('id', reservaID).single();
      if (!reserva) return { ok: false, error: 'Reserva no encontrada' };
      if (reserva.estado === window.TENANT.estados.CANCELADA) {
        return { ok: false, error: 'Ya está cancelada' };
      }
      
      const { error } = await db
        .from('reservas')
        .update({
          estado: window.TENANT.estados.CANCELADA,
          motivo_cancelacion: motivo || '',
          cancelado_por: canceladoPor
        })
        .eq('id', reservaID);
      
      if (error) throw error;
      
      reserva.motivo_cancelacion = motivo;
      this._dispatchAppsScript('cancelacion', reserva);
      
      return { ok: true };
    } catch (e) {
      console.error('cancelarReserva:', e);
      return { ok: false, error: e.message };
    }
  },
  
  async reagendarReserva(reservaID, nuevaFecha, nuevaHora, motivo) {
    try {
      const { data: reserva } = await db.from('reservas').select('*').eq('id', reservaID).single();
      if (!reserva) return { ok: false, error: 'Reserva no encontrada' };
      
      const horaFin = this._minutosAHora(this._horaAMinutos(nuevaHora) + reserva.duracion_min);
      
      // verificar solapamiento en el nuevo horario
      const { data: existentes } = await db
        .from('reservas')
        .select('id, hora_inicio, hora_fin')
        .eq('empleado_id', reserva.empleado_id)
        .eq('fecha', nuevaFecha)
        .neq('id', reservaID)
        .neq('estado', window.TENANT.estados.CANCELADA);
      
      const ni = this._horaAMinutos(nuevaHora), nf = this._horaAMinutos(horaFin);
      const conflicto = (existentes || []).some(r => {
        const ei = this._horaAMinutos(r.hora_inicio), ef = this._horaAMinutos(r.hora_fin);
        return ni < ef && nf > ei;
      });
      if (conflicto) return { ok: false, error: 'El nuevo horario está ocupado' };
      
      const anterior = {
        fecha: reserva.fecha,
        hora_inicio: reserva.hora_inicio,
        calendar_event_id: reserva.calendar_event_id
      };
      
      const { data: actualizada, error } = await db
        .from('reservas')
        .update({
          fecha:             nuevaFecha,
          hora_inicio:       nuevaHora,
          hora_fin:          horaFin,
          fecha_anterior:    reserva.fecha,
          hora_anterior:     reserva.hora_inicio,
          motivo_reagendado: motivo || '',
          calendar_event_id: ''
        })
        .eq('id', reservaID)
        .select()
        .single();
      
      if (error) throw error;
      
      this._dispatchAppsScript('reagendado', actualizada, anterior);
      return { ok: true, reserva: actualizada };
    } catch (e) {
      console.error('reagendarReserva:', e);
      return { ok: false, error: e.message };
    }
  },
  
  async cambiarEstado(reservaID, nuevoEstado, comentario = '', cambiadoPor = 'admin') {
    try {
      const { data, error } = await db
        .from('reservas')
        .update({
          estado: nuevoEstado,
          comentario_admin: comentario,
          cancelado_por: cambiadoPor
        })
        .eq('id', reservaID)
        .select()
        .single();
      
      if (error) throw error;
      
      if (nuevoEstado === window.TENANT.estados.COMPLETADA) {
        this._dispatchAppsScript('completada', data);
      }
      return { ok: true, reserva: data };
    } catch (e) {
      console.error('cambiarEstado:', e);
      return { ok: false, error: e.message };
    }
  },
  
  // ─────────────────────────────────────────────────────────────────
  // PAGO Y RECIBO
  // ─────────────────────────────────────────────────────────────────
  async registrarPago(reservaID, metodoPago, montoPagado) {
    try {
      const { data, error } = await db
        .from('reservas')
        .update({
          metodo_pago: metodoPago,
          monto_pagado: montoPagado,
          pagado_at: new Date().toISOString(),
          estado: window.TENANT.estados.COMPLETADA
        })
        .eq('id', reservaID)
        .select()
        .single();
      
      if (error) throw error;
      this._dispatchAppsScript('completada', data);
      return { ok: true, reserva: data };
    } catch (e) {
      console.error('registrarPago:', e);
      return { ok: false, error: e.message };
    }
  },
  
  async agregarComentario(reservaID, comentario) {
    try {
      const { data, error } = await db
        .from('reservas')
        .update({ comentario_admin: comentario })
        .eq('id', reservaID)
        .select()
        .single();
      if (error) throw error;
      return { ok: true, reserva: data };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  },
  
  // ─────────────────────────────────────────────────────────────────
  // CLIENTES (CRM)
  // ─────────────────────────────────────────────────────────────────
  async _upsertCliente(reserva) {
    const email = reserva.email.toLowerCase().trim();
    const { data: existente } = await db.from('clientes').select('*').eq('email', email).maybeSingle();
    
    if (existente) {
      const total = (existente.total_reservas || 0) + 1;
      const monto = (existente.monto_total || 0) + (reserva.precio || 0);
      const etiqueta = total >= 10 ? '⭐ VIP' : total >= 3 ? '🔁 Frecuente' : '🆕 Nuevo';
      
      await db.from('clientes').update({
        total_reservas: total,
        monto_total: monto,
        etiqueta,
        ultima_visita: new Date().toISOString()
      }).eq('email', email);
      
      // vincular reserva al cliente
      await db.from('reservas').update({ cliente_id: existente.id }).eq('id', reserva.id);
    } else {
      const { data: nuevo } = await db.from('clientes').insert({
        email,
        nombre: reserva.nombre_cliente,
        telefono: reserva.telefono || '',
        total_reservas: 1,
        monto_total: reserva.precio || 0,
        etiqueta: '🆕 Nuevo',
        ultima_visita: new Date().toISOString()
      }).select().single();
      
      if (nuevo) await db.from('reservas').update({ cliente_id: nuevo.id }).eq('id', reserva.id);
    }
  },
  
  async getClientes(filtro = '') {
    try {
      let query = db.from('clientes').select('*').order('ultima_visita', { ascending: false });
      if (filtro) {
        query = query.or(`nombre.ilike.%${filtro}%,email.ilike.%${filtro}%,telefono.ilike.%${filtro}%`);
      }
      const { data, error } = await query.limit(200);
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.error('getClientes:', e);
      return [];
    }
  },
  
  async getHistorialCliente(email) {
    try {
      const { data, error } = await db
        .from('reservas')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .order('fecha', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.error('getHistorialCliente:', e);
      return [];
    }
  },
  
  async actualizarCliente(id, cambios) {
    try {
      const { data, error } = await db
        .from('clientes').update(cambios).eq('id', id).select().single();
      if (error) throw error;
      return { ok: true, cliente: data };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  },
  
  // ─────────────────────────────────────────────────────────────────
  // AGENDAS CERRADAS
  // ─────────────────────────────────────────────────────────────────
  async cerrarAgenda(payload) {
    // payload: { fecha, hora_inicio?, hora_fin?, empleado_id?, motivo }
    try {
      const { data, error } = await db
        .from('agendas_cerradas')
        .insert({ ...payload, activo: true })
        .select()
        .single();
      if (error) throw error;
      return { ok: true, cerrada: data };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  },
  
  async reabrirAgenda(id) {
    try {
      const { error } = await db
        .from('agendas_cerradas')
        .update({
          activo: false,
          reopened_at: new Date().toISOString(),
          reopened_by: 'admin'
        })
        .eq('id', id);
      if (error) throw error;
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  },
  
  async getAgendasCerradas(desde, hasta) {
    try {
      const { data, error } = await db
        .from('agendas_cerradas')
        .select('*')
        .gte('fecha', desde)
        .lte('fecha', hasta)
        .order('fecha', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (e) {
      return [];
    }
  },
  
  // ─────────────────────────────────────────────────────────────────
  // HISTORIAL DE CAMBIOS
  // ─────────────────────────────────────────────────────────────────
  async getHistorialReserva(reservaID) {
    try {
      const { data, error } = await db
        .from('historial_reservas')
        .select('*')
        .eq('reserva_id', reservaID)
        .order('cambiado_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (e) {
      return [];
    }
  },
  
    // ─────────────────────────────────────────────────────────────────
  // DISPATCH AL APPS SCRIPT (modo híbrido)
  // ─────────────────────────────────────────────────────────────────
  _dispatchAppsScript(accion, reserva, anterior = null) {
    const url = window.TENANT.appsScriptUrl;
    if (!url || url.includes('REEMPLAZAR')) {
      console.warn('TENANT.appsScriptUrl no configurada');
      return Promise.resolve();
    }
    
    // ✅ INCLUIR EL SECRET
    const body = JSON.stringify({ 
      accion, 
      reserva, 
      anterior,
      secret: window.TENANT.webhookSecret || ''
    });
    
    console.log(`📤 Webhook enviado: ${accion}`, { 
      reservaId: reserva?.id, 
      secretEnviado: !!window.TENANT.webhookSecret 
    });
    
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body,
      keepalive: true,
      mode: 'no-cors'
    }).catch(e => {
      console.warn('AS dispatch falló:', e.message);
      setTimeout(() => {
        fetch(url, { method: 'POST', body, mode: 'no-cors', keepalive: true }).catch(() => {});
      }, 2000);
    });
  }
};  

window.API = API;
console.log('✅ Supabase + API listos para tenant:', window.TENANT.id);

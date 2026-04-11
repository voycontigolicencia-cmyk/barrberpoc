/* ================================================================
   PLATAFORMA AGENDA — tenant.config.js
   
   ⚡ ESTE ES EL ÚNICO ARCHIVO QUE NECESITAS EDITAR PARA CLONAR
      LA PLATAFORMA A UN NEGOCIO NUEVO.
   
   Cambia los valores y todo el resto (HTML, JS, emails, recibos)
   se adapta automáticamente.
   
   Tipos de negocio soportados:
     · barberia        → "barbero"      
     · spa             → "terapeuta"    
     · salon           → "estilista"    
     · taller_mecanico → "mecánico"     
     · clinica         → "profesional"  
     · generico        → "profesional"  
   ================================================================ */

window.TENANT = {
  
  // ── IDENTIDAD ──────────────────────────────────────────────────
  id:           'barberia-pro',                  // slug único, sin espacios
  nombre:       'Barbería Pro',
  razonSocial:  'Barbería Pro SpA',
  rut:          '76.123.456-7',                  // para recibos
  giro:         'Servicios de peluquería',
  
  // ── TIPO DE NEGOCIO ────────────────────────────────────────────
  // afecta vocabulario en toda la UI
  tipo:                   'barberia',
  profesionalLabel:       'barbero',
  profesionalLabelPlural: 'barberos',
  servicioLabel:          'servicio',
  servicioLabelPlural:    'servicios',
  
  // ── CONTACTO Y MARCA ───────────────────────────────────────────
  email:        'voycontigo.licencia@gmail.com',
  telefono:     '+56 9 9984 9782',
  direccion:    'Av. Irarrázaval 4665, local D, Ñuñoa',
  ciudad:       'Santiago',
  pais:         'Chile',
  horarioPublico: 'Lun–Sáb: 9:00 – 20:00',
  
  whatsapp:     'https://wa.me/56999849782',
  instagram:    'https://instagram.com/barberiapro',
  mapsUrl:      'https://maps.app.goo.gl/v8yUUogPGQsPc5aX7',
  lat:          -33.4569,
  lng:          -70.6483,
  
  logoUrl:      'https://github.com/voycontigolicencia-cmyk/barber/blob/main/barberialogo2.png?raw=true',
  
  // Paleta visual (sobrescribe variables CSS)
  colorPrimario:    '#C9A84C',
  colorSecundario:  '#1A1A2E',
  colorAcento:      '#22C55E',
  
  // ── HORARIOS DEL NEGOCIO ───────────────────────────────────────
  timezone:       'America/Santiago',
  horaApertura:   9,
  horaCierre:     20,
  slotMinutos:    15,
  diasOperacion:  [1, 2, 3, 4, 5, 6],            // 0=dom, 1=lun, ..., 6=sáb
  
  // ── ESTADOS DE RESERVA ─────────────────────────────────────────
  estados: {
    PENDIENTE:   'Pendiente',
    CONFIRMADA:  'Confirmada',
    EN_CURSO:    'En curso',
    COMPLETADA:  'Completada',
    CANCELADA:   'Cancelada',
    NO_SHOW:     'No se presentó'
  },
  
  // ── MÉTODOS DE PAGO HABILITADOS ────────────────────────────────
  metodosPago: [
    { id: 'efectivo',      nombre: 'Efectivo',      icono: '💵' },
    { id: 'debito',        nombre: 'Débito',        icono: '💳' },
    { id: 'credito',       nombre: 'Crédito',       icono: '💳' },
    { id: 'transferencia', nombre: 'Transferencia', icono: '🏦' },
    { id: 'mercadopago',   nombre: 'MercadoPago',   icono: '📲' }
  ],
  
  // ── RECIBO (formato Chile) ─────────────────────────────────────
  recibo: {
    activo:           true,
    formato:          '80mm',                    // 80mm | 58mm | A4
    numeroInicial:    1000,
    incluyeIva:       true,
    porcentajeIva:    19,                        // Chile = 19%
    leyendaPie:       'Documento no fiscal · Recibo interno',
    mostrarRut:       true,
    prefijo:          'REC'                      // REC-01001
  },
  
  // ── INTEGRACIONES ──────────────────────────────────────────────
  // URL del Apps Script Web App (después del deploy)
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbzdMWcTZOWibON8ISoYdkhLIMgVIV_iOSfUEHMW0Q5jLZ5HKdFkrhCnPbJjzqUoxFUEUQ/exec',
  
  // Modo de envío al Apps Script tras crear reserva en Supabase:
  // 'fire-and-forget' | 'await' | 'hybrid'
  appsScriptMode: 'hybrid',

  // ✅ AÑADE ESTA LÍNEA - DEBE COINCIDIR CON WEBHOOK_SECRET EN APPS SCRIPT
  webhookSecret: 'Javiteamo', 
  
  // Realtime monitor: cada cuánto verificar conexión (ms)
  monitorPingInterval: 30000,
  
  // ── ADMIN ──────────────────────────────────────────────────────
  adminToken:    'barberia-pro-2025-secret',     // ⚠️ cambia en producción
  adminEmails:   ['voycontigo.licencia@gmail.com']
};

// ── HELPER: vocabulario contextual ──────────────────────────────
// Llama TENANT.t('profesional') y devuelve "barbero"/"esteticista"/etc
window.TENANT.t = function(clave) {
  const map = {
    profesional:        this.profesionalLabel,
    profesionales:      this.profesionalLabelPlural,
    profesionalCap:     this.profesionalLabel.charAt(0).toUpperCase() + this.profesionalLabel.slice(1),
    profesionalesCap:   this.profesionalLabelPlural.charAt(0).toUpperCase() + this.profesionalLabelPlural.slice(1),
    servicio:           this.servicioLabel,
    servicios:          this.servicioLabelPlural
  };
  return map[clave] || clave;
};

// Aplica variables CSS de marca al cargar
(function aplicarBranding() {
  const root = document.documentElement;
  root.style.setProperty('--color-primario',    window.TENANT.colorPrimario);
  root.style.setProperty('--color-secundario',  window.TENANT.colorSecundario);
  root.style.setProperty('--color-acento',      window.TENANT.colorAcento);
  document.title = window.TENANT.nombre;
})();

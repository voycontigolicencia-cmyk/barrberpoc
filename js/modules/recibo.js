/* ================================================================
   PLATAFORMA AGENDA — recibo.js
   
   Genera e imprime recibos en formato Chile.
   Funciona con:
     · Impresoras térmicas 80mm/58mm (vía window.print con CSS)
     · Impresoras normales A4
     · PDF (vía Save as PDF en el diálogo de impresión)
   
   Uso:
     Recibo.imprimir(reserva);
     Recibo.preview(reserva);  // ver antes de imprimir
   ================================================================ */

const Recibo = {
  
  /** Calcula neto, IVA y total dado un monto bruto */
  calcular(montoBruto) {
    const cfg = window.TENANT.recibo;
    if (!cfg.incluyeIva) {
      return { neto: montoBruto, iva: 0, total: montoBruto };
    }
    const iva = Math.round(montoBruto * cfg.porcentajeIva / (100 + cfg.porcentajeIva));
    const neto = montoBruto - iva;
    return { neto, iva, total: montoBruto };
  },
  
  /** Genera el HTML del recibo en formato 80mm térmico */
  generarHTML(reserva) {
    const cfg = window.TENANT.recibo;
    const t = window.TENANT;
    const monto = reserva.monto_pagado || reserva.precio || 0;
    const calc = this.calcular(monto);
    
    const numero = reserva.recibo_numero
      ? `${cfg.prefijo}-${String(reserva.recibo_numero).padStart(5, '0')}`
      : 'PENDIENTE';
    
    const metodoPago = (t.metodosPago || []).find(m => m.id === reserva.metodo_pago);
    const metodoLabel = metodoPago ? `${metodoPago.icono} ${metodoPago.nombre}` : '—';
    
    const fecha = new Date().toLocaleString('es-CL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    
    const fechaServicio = new Date(reserva.fecha + 'T' + reserva.hora_inicio).toLocaleString('es-CL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    
    const ancho = cfg.formato === '58mm' ? '58mm' : cfg.formato === 'A4' ? '210mm' : '80mm';
    
    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Recibo ${numero}</title>
<style>
  @page { size: ${ancho} auto; margin: 0; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    line-height: 1.35;
    color: #000;
    margin: 0;
    padding: 6mm 4mm;
    width: ${ancho};
  }
  h1 { font-size: 14px; margin: 0 0 2px; text-align: center; text-transform: uppercase; }
  .sub { text-align: center; font-size: 10px; margin-bottom: 6px; }
  .div { border-top: 1px dashed #000; margin: 6px 0; }
  .div2 { border-top: 1px solid #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .row .l { flex: 1; }
  .row .r { text-align: right; white-space: nowrap; }
  .center { text-align: center; }
  .small { font-size: 9px; color: #333; }
  .bold { font-weight: bold; }
  .total { font-size: 14px; font-weight: bold; padding: 4px 0; border-top: 1px solid #000; border-bottom: 1px solid #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  td { padding: 1px 0; vertical-align: top; }
  .qr { text-align: center; margin-top: 8px; }
  @media print {
    body { padding: 4mm 3mm; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
  <h1>${t.nombre}</h1>
  <div class="sub">
    ${cfg.mostrarRut && t.rut ? 'RUT: ' + t.rut + '<br>' : ''}
    ${t.giro || ''}<br>
    ${t.direccion}<br>
    ${t.telefono}
  </div>
  
  <div class="div2"></div>
  <div class="row">
    <div class="l bold">RECIBO</div>
    <div class="r bold">${numero}</div>
  </div>
  <div class="row small">
    <div class="l">Emitido</div>
    <div class="r">${fecha}</div>
  </div>
  <div class="div"></div>
  
  <table>
    <tr><td colspan="2" class="bold">CLIENTE</td></tr>
    <tr><td>Nombre</td><td>${reserva.nombre_cliente || ''}</td></tr>
    ${reserva.email ? `<tr><td>Email</td><td>${reserva.email}</td></tr>` : ''}
    ${reserva.telefono ? `<tr><td>Tel</td><td>${reserva.telefono}</td></tr>` : ''}
  </table>
  
  <div class="div"></div>
  
  <table>
    <tr><td colspan="2" class="bold">DETALLE</td></tr>
    <tr><td>Servicio</td><td>${reserva.servicio_nombre || ''}</td></tr>
    <tr><td>${t.profesionalLabel.charAt(0).toUpperCase() + t.profesionalLabel.slice(1)}</td><td>${reserva.empleado_nombre || ''}</td></tr>
    <tr><td>Fecha cita</td><td>${fechaServicio}</td></tr>
    <tr><td>Código</td><td>${reserva.codigo || reserva.id?.slice(0, 8) || ''}</td></tr>
  </table>
  
  <div class="div"></div>
  
  ${cfg.incluyeIva ? `
  <div class="row">
    <div class="l">Neto</div>
    <div class="r">$ ${calc.neto.toLocaleString('es-CL')}</div>
  </div>
  <div class="row">
    <div class="l">IVA (${cfg.porcentajeIva}%)</div>
    <div class="r">$ ${calc.iva.toLocaleString('es-CL')}</div>
  </div>
  ` : ''}
  
  <div class="row total">
    <div class="l">TOTAL</div>
    <div class="r">$ ${calc.total.toLocaleString('es-CL')}</div>
  </div>
  
  <div class="row">
    <div class="l">Pago</div>
    <div class="r">${metodoLabel}</div>
  </div>
  
  ${reserva.comentario_admin ? `
  <div class="div"></div>
  <div class="small"><strong>Nota:</strong> ${reserva.comentario_admin}</div>
  ` : ''}
  
  <div class="div2"></div>
  <div class="center small">
    ${cfg.leyendaPie}<br>
    Gracias por tu visita
  </div>
  
  <div class="no-print" style="text-align:center; margin-top: 16px; padding: 8px; background:#f0f0f0;">
    <button onclick="window.print()" style="padding: 8px 16px; font-size: 14px; cursor: pointer;">🖨️ Imprimir</button>
    <button onclick="window.close()" style="padding: 8px 16px; font-size: 14px; cursor: pointer; margin-left: 8px;">✕ Cerrar</button>
  </div>
  
  <script>
    // Auto-imprimir si la URL tiene ?auto
    if (window.location.search.includes('auto')) {
      setTimeout(() => window.print(), 300);
    }
  </script>
</body>
</html>`;
  },
  
  /** Abre el recibo en una ventana nueva y dispara impresión */
  imprimir(reserva, autoprint = true) {
    if (!reserva.recibo_numero && !reserva.metodo_pago) {
      const ok = confirm('Esta reserva aún no tiene pago registrado.\n¿Quieres imprimir el recibo de todas formas?');
      if (!ok) return;
    }
    
    const html = this.generarHTML(reserva);
    const win = window.open('', '_blank', 'width=420,height=720');
    if (!win) {
      alert('Permite ventanas emergentes para imprimir el recibo');
      return;
    }
    win.document.write(html);
    win.document.close();
    if (autoprint) {
      setTimeout(() => win.print(), 400);
    }
  },
  
  /** Solo previsualiza, sin imprimir */
  preview(reserva) {
    this.imprimir(reserva, false);
  }
};

window.Recibo = Recibo;

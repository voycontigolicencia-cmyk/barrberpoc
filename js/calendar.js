/* ================================================================
   PLATAFORMA AGENDA — calendar.js
   
   Date picker simple. Se monta en #calendario y llama al callback
   con la fecha en formato yyyy-MM-dd al hacer click en un día.
   
   Respeta TENANT.diasOperacion (días que el negocio opera).
   No deja seleccionar fechas pasadas.
   ================================================================ */

(function inyectarCalendarStyles() {
  const css = `
    .cal-wrap { font-family: inherit; user-select: none; }
    .cal-head {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 12px;
    }
    .cal-title {
      font-size: 15px; font-weight: 600; color: var(--text, #fff);
      text-transform: capitalize;
    }
    .cal-btn {
      background: var(--card, #1A1A2E);
      border: 1px solid var(--border, #2A2A40);
      width: 32px; height: 32px;
      border-radius: 8px;
      cursor: pointer;
      color: var(--text, #fff);
      font-size: 16px;
      transition: all .2s;
    }
    .cal-btn:hover { background: var(--gold, #C9A84C); color: #000; }
    .cal-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;
    }
    .cal-day-name {
      text-align: center;
      font-size: 11px;
      font-weight: 600;
      color: var(--muted, #94A3B8);
      padding: 6px 0;
      text-transform: uppercase;
    }
    .cal-day {
      aspect-ratio: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all .15s;
      color: var(--text, #fff);
      border: 1px solid transparent;
    }
    .cal-day:hover:not(.cal-day--disabled):not(.cal-day--empty) {
      background: rgba(201,168,76,.15);
      border-color: var(--gold, #C9A84C);
    }
    .cal-day--today {
      background: rgba(201,168,76,.08);
      border-color: rgba(201,168,76,.4);
    }
    .cal-day--selected {
      background: var(--gold, #C9A84C);
      color: #000;
      font-weight: 700;
    }
    .cal-day--disabled {
      opacity: .25;
      cursor: not-allowed;
      text-decoration: line-through;
    }
    .cal-day--empty { cursor: default; }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();

const Calendar = {
  containerId: null,
  callback: null,
  current: new Date(),
  selected: null,
  
  init(containerId, callback) {
    this.containerId = containerId;
    this.callback = callback;
    this.current = new Date();
    this.current.setDate(1);
    this.render();
  },
  
  reset() {
    this.selected = null;
    this.render();
  },
  
  render() {
    const cont = document.getElementById(this.containerId);
    if (!cont) return;
    
    const year = this.current.getFullYear();
    const month = this.current.getMonth();
    const monthName = this.current.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
    
    const primerDia = new Date(year, month, 1).getDay(); // 0=dom
    const ultimoDia = new Date(year, month + 1, 0).getDate();
    
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const diasOp = (window.TENANT && window.TENANT.diasOperacion) || [1, 2, 3, 4, 5, 6];
    
    let html = '<div class="cal-wrap">';
    html += '<div class="cal-head">';
    html += '<button class="cal-btn" data-action="prev">‹</button>';
    html += `<div class="cal-title">${monthName}</div>`;
    html += '<button class="cal-btn" data-action="next">›</button>';
    html += '</div><div class="cal-grid">';
    
    ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].forEach(d => {
      html += `<div class="cal-day-name">${d}</div>`;
    });
    
    // Espacios antes del día 1
    for (let i = 0; i < primerDia; i++) {
      html += '<div class="cal-day cal-day--empty"></div>';
    }
    
    // Días del mes
    for (let d = 1; d <= ultimoDia; d++) {
      const fecha = new Date(year, month, d);
      const fechaStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const diaSemana = fecha.getDay();
      
      const esPasado = fecha < hoy;
      const noOpera = !diasOp.includes(diaSemana);
      const disabled = esPasado || noOpera;
      const esHoy = fecha.getTime() === hoy.getTime();
      const esSelected = this.selected === fechaStr;
      
      let cls = 'cal-day';
      if (disabled) cls += ' cal-day--disabled';
      if (esHoy) cls += ' cal-day--today';
      if (esSelected) cls += ' cal-day--selected';
      
      html += `<div class="${cls}" data-fecha="${fechaStr}">${d}</div>`;
    }
    
    html += '</div></div>';
    cont.innerHTML = html;
    
    // Handlers
    cont.querySelectorAll('[data-action="prev"]').forEach(b => {
      b.addEventListener('click', () => {
        this.current.setMonth(this.current.getMonth() - 1);
        this.render();
      });
    });
    cont.querySelectorAll('[data-action="next"]').forEach(b => {
      b.addEventListener('click', () => {
        this.current.setMonth(this.current.getMonth() + 1);
        this.render();
      });
    });
    cont.querySelectorAll('.cal-day:not(.cal-day--disabled):not(.cal-day--empty)').forEach(day => {
      day.addEventListener('click', () => {
        this.selected = day.dataset.fecha;
        this.render();
        if (this.callback) this.callback(this.selected);
      });
    });
  }
};

window.Calendar = Calendar;

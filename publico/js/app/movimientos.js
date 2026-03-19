// ===============================
// Gestión de movimientos y estadísticas
// ===============================
// Este módulo concentra todas las operaciones relacionadas con los movimientos
// (ventas, egresos, gastos, ajustes) y los gráficos/resúmenes que dependen de ellos.

const MOV_RANGO_LABELS = {
    dia: 'Diario',
    semana: 'Semanal',
    mes: 'Mensual',
    'año': 'Anual'
};
const MOV_RANGO_ORDEN = ['dia', 'semana', 'mes', 'año'];

const MOV_CATEGORIA_PREDICATES = {
    ingresos: (m) => m.tipo === 'venta',
    egresos: (m) => ['egreso', 'gasto', 'ajuste'].includes(m.tipo),
    porCobrar: (m) => m.tipo === 'venta' && Number(m.es_credito) === 1,
    porPagar: (m) => Boolean(m.proveedor || m.proveedor_id)
};

window.movimientosCategoriaSeleccionada = window.movimientosCategoriaSeleccionada || 'ingresos';
window.movimientosRangoSeleccionado = window.movimientosRangoSeleccionado || 'dia';
window._movimientosBusquedaActual = window._movimientosBusquedaActual || '';

// Función que convierte números a un texto monetario reutilizando formatearMoneda global cuando exista.
function formatearMoneda(valor) {
    const numero = Number(valor) || 0;
    if (typeof window.formatearMoneda === 'function') {
        return window.formatearMoneda(numero);
    }
    return `C$${numero.toFixed(2)}`;
}

// Función que recibe una fecha ISO y devuelve una etiqueta legible (default "Hoy" ante errores).
function formatearFechaHumana(isoDate) {
    if (!isoDate) return 'Hoy';
    const fecha = new Date(isoDate);
    if (Number.isNaN(fecha.getTime())) return 'Hoy';
    return fecha.toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Función que devuelve el texto amigable correspondiente al rango seleccionado.
function obtenerEtiquetaRango(valor) {
    return MOV_RANGO_LABELS[valor] || 'Personalizado';
}

// Función que calcula el número de semana ISO en UTC para una fecha dada.
function getWeekNumberUTC(date) {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Función que genera una llave normalizada (YYYY-MM, etc.) para agrupar registros por periodo.
function obtenerClavePeriodo(date, rango) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    switch (rango) {
        case 'semana': {
            const week = getWeekNumberUTC(date);
            return `${year}-W${String(week).padStart(2, '0')}`;
        }
        case 'mes':
            return `${year}-${month}`;
        case 'año':
            return `${year}`;
        case 'dia':
        default:
            return `${year}-${month}-${day}`;
    }
}

// Función que devuelve una etiqueta descriptiva del periodo según el rango aplicado.
function obtenerEtiquetaPeriodo(date, rango) {
    switch (rango) {
        case 'semana': {
            const week = getWeekNumberUTC(date);
            return `Sem ${String(week).padStart(2, '0')} ${date.getUTCFullYear()}`;
        }
        case 'mes':
            return date.toLocaleDateString('es-NI', { month: 'long', year: 'numeric' });
        case 'año':
            return String(date.getUTCFullYear());
        case 'dia':
        default:
            return date.toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric' });
    }
}

// Función que intenta convertir diversos formatos de fecha (timestamp, string, Date) a Date usable.
function parseMovimientoFechaValor(valor) {
    if (valor === null || valor === undefined) return null;
    if (valor instanceof Date && !Number.isNaN(valor.getTime())) return valor;
    if (typeof valor === 'number') {
        return new Date(valor * 1000);
    }
    const numeric = Number(valor);
    if (!Number.isNaN(numeric)) {
        const usesSeconds = Math.abs(numeric) < 1e12;
        return new Date(usesSeconds ? numeric * 1000 : numeric);
    }
    if (typeof valor === 'string') {
        const parsed = Date.parse(valor);
        if (!Number.isNaN(parsed)) return new Date(parsed);
    }
    return null;
}

// Función que agrupa los movimientos en buckets por periodo acumulando ingresos y egresos.
function agruparMovimientosPorPeriodo(movimientos = [], rango = 'dia') {
    const grupos = new Map();
    movimientos.forEach(m => {
        const fecha = parseMovimientoFechaValor(m.fecha);
        if (!fecha) return;
        const clave = obtenerClavePeriodo(fecha, rango);
        const etiqueta = obtenerEtiquetaPeriodo(fecha, rango);
        if (!grupos.has(clave)) {
            grupos.set(clave, {
                rawKey: clave,
                label: etiqueta,
                totalIngresos: 0,
                totalEgresos: 0,
                movimientos: []
            });
        }
        const bucket = grupos.get(clave);
        const monto = Number(m.monto) || 0;
        if (m.tipo === 'venta') {
            bucket.totalIngresos += monto;
        } else if (['egreso', 'gasto', 'ajuste'].includes(m.tipo)) {
            bucket.totalEgresos += monto;
        }
        bucket.movimientos.push(m);
    });
    return Array.from(grupos.values()).sort((a, b) => {
        if (a.rawKey === b.rawKey) return 0;
        return a.rawKey < b.rawKey ? 1 : -1; // más reciente primero
    });
}

/**
 * Garantiza valores iniciales para los filtros y actualiza las chips visibles sin disparar consultas.
 */
window.ensureMovimientosFiltros = function ensureMovimientosFiltros() {
    const fechaInput = document.getElementById('fechaBaseMovimientos');
    const rangoSelect = document.getElementById('rangoTiempoMovimientos');
    const hoy = new Date().toISOString().slice(0, 10);
    if (fechaInput && !fechaInput.value) {
        fechaInput.value = hoy;
        actualizarFechaMovimientos(hoy, { skipFetch: true });
    }
    if (rangoSelect) {
        if (!rangoSelect.value) {
            rangoSelect.value = 'dia';
        }
        window.movimientosRangoSeleccionado = rangoSelect.value;
        actualizarRangoMovimientos(rangoSelect.value, { skipFetch: true });
    }
};

/**
 * Carga los movimientos recientes desde el servidor (sin filtros).
 * Se usa para actualizar contadores o mostrar en consola.
 */
window.loadMovimientos = async function loadMovimientos() {
    try {
        const res = await fetch('/movimientos');
        const data = await res.json();
        console.log('Movimientos recientes:', data.movimientos?.slice(0, 50));
    } 
    catch (err) {
        console.error('Error cargando movimientos:', err);
    }
};

/**
 * Carga los movimientos con los filtros seleccionados (tipo, producto y rango temporal opcional).
 * Se usa en el módulo de "Movimientos" para mostrar resultados en tabla.
 */
window.loadMovimientosUI = async function loadMovimientosUI(options = {}) {
    try {
        window.ensureMovimientosFiltros && window.ensureMovimientosFiltros();
        const fechaBase = document.getElementById('fechaBaseMovimientos')?.value;
        const rangoSelect = document.getElementById('rangoTiempoMovimientos');
        const rango = rangoSelect?.value || window.movimientosRangoSeleccionado || 'dia';
        window.movimientosRangoSeleccionado = rango;
        const qs = new URLSearchParams();
        if (options.applyDateFilter && !fechaBase) {
            return alert('Selecciona una fecha base');
        }
        if (fechaBase) qs.set('fechaBase', fechaBase);
        if (rango) qs.set('rango', rango);

        const res = await fetch('/movimientos' + (qs.toString() ? '?' + qs.toString() : ''));
        const data = await res.json();
        if (!res.ok) return console.error('Error cargando movimientos', data);

        window.lastMovimientos = data.movimientos || [];
        actualizarResumenMovimientos(window.lastMovimientos);
        renderMovimientosCategoriaActual();
    } 
    catch (err) {
            console.error('Error cargando movimientos UI:', err);
    }
};

/**
 * Renderiza la tabla de movimientos en el módulo correspondiente.
 * @param {Array} movimientos - Lista de movimientos.
 */
window.renderMovimientosTable = function renderMovimientosTable(movimientos) {
    const tbody = document.getElementById('tablaMovimientosBody');
    if (!tbody) return;
    if (!movimientos?.length) {
        tbody.innerHTML = '<tr><td colspan="6">Sin movimientos en esta vista</td></tr>';
        return;
    }
    const rango = window.movimientosRangoSeleccionado || 'dia';
    const grupos = agruparMovimientosPorPeriodo(movimientos, rango);
    if (!grupos.length) {
        tbody.innerHTML = movimientos.map(crearFilaMovimiento).join('');
        return;
    }
    const rows = grupos.map(grupo => {
        const resumen = `
            <tr class="mov-periodo-row">
                <td colspan="6">
                    <div class="mov-periodo-resumen">
                        <span>Periodo <strong>${grupo.label}</strong></span>
                        <span>Ingresos <strong>${formatearMoneda(grupo.totalIngresos)}</strong></span>
                        <span>Egresos <strong>${formatearMoneda(grupo.totalEgresos)}</strong></span>
                        <span>Neto <strong>${formatearMoneda(grupo.totalIngresos - grupo.totalEgresos)}</strong></span>
                    </div>
                </td>
            </tr>`;
        const detalleFilas = grupo.movimientos.map(crearFilaMovimiento).join('');
        return resumen + detalleFilas;
    });

    tbody.innerHTML = rows.join('');
};

// Función auxiliar que devuelve la fila HTML representando un movimiento individual.
function crearFilaMovimiento(m) {
    const fechaObj = parseMovimientoFechaValor(m.fecha);
    const fecha = fechaObj ? fechaObj.toLocaleString('es-NI') : '-';
    const detalles = [
        m.descripcion,
        m.producto ? `Producto: ${m.producto}` : '',
        m.cliente ? `Cliente: ${m.cliente}` : '',
        m.proveedor ? `Proveedor: ${m.proveedor}` : ''
    ].filter(Boolean).join(' • ');
    const vinculo = m.proveedor ? `Proveedor: ${m.proveedor}` : (m.cliente ? `Cliente: ${m.cliente}` : '—');
    const monto = m.monto != null ? formatearMoneda(m.monto) : '—';
    return `
        <tr>
            <td>${fecha}</td>
            <td>${m.tipo}</td>
            <td>${detalles || '-'}</td>
            <td>${m.cantidad || 0}</td>
            <td>${monto}</td>
            <td>${vinculo}</td>
        </tr>`;
}

/**
 * Exporta los movimientos actuales a un archivo CSV descargable.
 */
window.exportMovimientosCSV = function exportMovimientosCSV() {
    if (!window.lastMovimientos?.length) return alert('No hay movimientos para exportar');

    const rows = [['fecha', 'tipo', 'producto', 'cantidad', 'monto', 'descripcion', 'cliente', 'proveedor']];
    window.lastMovimientos.forEach(m => {
        const fecha = m.fecha ? new Date(m.fecha * 1000).toISOString() : '';
        rows.push([
        fecha,
        m.tipo,
        m.producto || m.producto_id || '',
        m.cantidad || 0,
        m.monto ?? '',
        m.descripcion || '',
        m.cliente || '',
        m.proveedor || ''
        ]);
    });

    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'movimientos.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
};

/**
 * Carga las estadísticas de ventas desde el servidor y genera gráficos.
 * También actualiza la columna "estimado" en la tabla de productos.
 */
window.loadStats = async function loadStats() {
    try {
        const res = await fetch('/movimientos/estadisticas/resumen');
        const data = await res.json();
        if (!res.ok) return console.error('Error estadísticas', data);

        const resumen = data.resumen || [];
        const labels = resumen.map(r => r.nombre);
        const montos = resumen.map(r => Number(r.total_monto || 0));

        // Gráfico de barras: ingresos por producto
        const ctxBar = document.getElementById('salesBarChart').getContext('2d');
        if (window.barChart) window.barChart.destroy();
        window.barChart = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
            label: 'Ingresos (C$)',
            data: montos,
            backgroundColor: 'rgba(54,162,235,0.6)'
            }]
        }
        });

        // Gráfico de pastel: distribución de ingresos
        const ctxPie = document.getElementById('salesPieChart').getContext('2d');
        if (window.pieChart) window.pieChart.destroy();
        window.pieChart = new Chart(ctxPie, {
        type: 'pie',
        data: {
            labels,
            datasets: [{
            data: montos,
            backgroundColor: labels.map((_, i) => `hsl(${i * 40 % 360} 70% 50%)`)
            }]
        }
        });

        // Calcular precio estimado por producto
        const usuario_id = getUsuarioId();
        if (!usuario_id) throw new Error('Usuario no identificado');
        const resP = await fetch(`/productos?usuario_id=${usuario_id}`);
        const dataP = await resP.json();
        const prods = dataP.productos || [];
        window._productosCache = prods;
        try {
            window.actualizarResumenInventario && window.actualizarResumenInventario(prods);
        } catch (err) {
            console.warn('No se pudo actualizar el resumen de inventario', err);
        }
        const mapEst = {};
        resumen.forEach(r => {
        r.estimated_price = r.total_unidades ? (r.total_monto / r.total_unidades) : null;
        mapEst[r.id] = r.estimated_price;
        });

        prods.forEach(p => {
        p.estimated_price = mapEst[p.id] || null;
        });

        renderProductsTable(prods);
    } catch (err) {
        console.error('Error cargando estadísticas:', err);
    }
};

/**
 * Handler utilizado por el botón "Buscar" en el módulo de movimientos.
 * Aplica el rango seleccionado sin afectar la carga automática por defecto.
 */
window.filtrarPorRango = function filtrarPorRango() {
    window.loadMovimientosUI({ applyDateFilter: true });
};

// Función que aplica el filtro de categoría seleccionado (ingresos, egresos, etc.) a la lista.
function filtrarPorCategoria(datos) {
    const categoria = window.movimientosCategoriaSeleccionada || 'ingresos';
    const predicate = MOV_CATEGORIA_PREDICATES[categoria];
    return typeof predicate === 'function' ? datos.filter(predicate) : datos;
}

// Función que filtra movimientos por coincidencia de texto en campos clave.
function filtrarPorBusqueda(datos) {
    const termino = (window._movimientosBusquedaActual || '').trim();
    if (!termino) return datos;
    const lower = termino.toLowerCase();
    return datos.filter(m => {
        const texto = [
            m.tipo,
            m.descripcion,
            m.producto,
            m.cliente,
            m.proveedor
        ].filter(Boolean).join(' ').toLowerCase();
        return texto.includes(lower);
    });
}

// Función que compone los filtros de categoría y búsqueda para obtener la lista final.
function obtenerMovimientosFiltrados() {
    const base = window.lastMovimientos || [];
    const porCategoria = filtrarPorCategoria(base);
    return filtrarPorBusqueda(porCategoria);
}

// Función que renderiza la tabla según el filtro activo actual.
function renderMovimientosCategoriaActual() {
    const filtrados = obtenerMovimientosFiltrados();
    window.renderMovimientosTable(filtrados);
}

// Función expuesta que cambia la categoría activa y actualiza los indicadores visuales.
window.mostrarMovimientos = function mostrarMovimientos(tipo) {
    window.movimientosCategoriaSeleccionada = tipo;
    document.querySelectorAll('.mov-pill').forEach(btn => {
        const isActive = btn.dataset.mov === tipo;
        btn.classList.toggle('active', isActive);
        if (isActive) {
            btn.setAttribute('aria-current', 'true');
        } else {
            btn.removeAttribute('aria-current');
        }
    });
    renderMovimientosCategoriaActual();
};

// Función expuesta que actualiza el término de búsqueda y refresca la tabla.
window.filtrarBusquedaMovimientos = function filtrarBusquedaMovimientos(valor) {
    window._movimientosBusquedaActual = (valor || '').trim();
    renderMovimientosCategoriaActual();
};

// Función que borra el campo de búsqueda y muestra todos los resultados.
window.limpiarBusquedaMovimientos = function limpiarBusquedaMovimientos() {
    const input = document.getElementById('buscarMovimientos');
    if (input) input.value = '';
    window._movimientosBusquedaActual = '';
    renderMovimientosCategoriaActual();
};

// Función que recorre los rangos disponibles (día, semana, etc.) en orden circular.
window.cambiarRangoMovimientos = function cambiarRangoMovimientos() {
    const actual = window.movimientosRangoSeleccionado || 'dia';
    const idx = MOV_RANGO_ORDEN.indexOf(actual);
    const next = MOV_RANGO_ORDEN[(idx + 1) % MOV_RANGO_ORDEN.length];
    window.seleccionarRangoMovimientos(next);
};

// Función que selecciona explícitamente un rango y sincroniza el select correspondiente.
window.seleccionarRangoMovimientos = function seleccionarRangoMovimientos(rango) {
    if (!rango) return;
    const select = document.getElementById('rangoTiempoMovimientos');
    if (select) select.value = rango;
    window.movimientosRangoSeleccionado = rango;
    actualizarRangoMovimientos(rango);
};

// Función que actualiza el texto de los chips de rango y, salvo que se indique, recarga los datos.
window.actualizarRangoMovimientos = function actualizarRangoMovimientos(valor, options = {}) {
    const rangoActivo = valor || window.movimientosRangoSeleccionado || 'dia';
    window.movimientosRangoSeleccionado = rangoActivo;
    const etiqueta = obtenerEtiquetaRango(rangoActivo);
    const chip = document.getElementById('movRangoChip');
    if (chip) chip.textContent = `Vista ${etiqueta}`;
    const vistaActual = document.getElementById('movVistaActual');
    if (vistaActual) vistaActual.textContent = `Vista ${etiqueta}`;
    if (!options.skipFetch) filtrarPorRango();
};

// Función que abre el date picker nativo (o enfoca el input) para elegir fecha base.
window.abrirSelectorFechaMov = function abrirSelectorFechaMov() {
    const input = document.getElementById('fechaBaseMovimientos');
    if (!input) return;
    if (typeof input.showPicker === 'function') {
        input.showPicker();
    } else {
        input.focus();
        input.click();
    }
};

// Función que refresca el chip de fecha seleccionada y dispara el filtrado cuando corresponde.
window.actualizarFechaMovimientos = function actualizarFechaMovimientos(valor, options = {}) {
    const chip = document.getElementById('movFechaChip');
    if (chip) chip.textContent = formatearFechaHumana(valor);
    if (!options.skipFetch) filtrarPorRango();
};

// Función que resume ingresos y egresos totales para mostrarlos en tarjetas principales.
function actualizarResumenMovimientos(movimientos = []) {
    const ingresosEl = document.getElementById('movResumenIngresos');
    const egresosEl = document.getElementById('movResumenEgresos');
    const totalIngresos = movimientos.filter(m => m.tipo === 'venta').reduce((acc, m) => acc + (Number(m.monto) || 0), 0);
    const totalEgresos = movimientos.filter(m => ['egreso', 'gasto', 'ajuste'].includes(m.tipo)).reduce((acc, m) => acc + (Number(m.monto) || 0), 0);
    if (ingresosEl) ingresosEl.textContent = formatearMoneda(totalIngresos);
    if (egresosEl) egresosEl.textContent = formatearMoneda(totalEgresos);
}

// Exponer helpers para otros módulos si se requieren
window.renderMovimientosCategoriaActual = renderMovimientosCategoriaActual;
window.actualizarResumenMovimientos = actualizarResumenMovimientos;

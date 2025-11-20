// ===============================
// Gestión de movimientos y estadísticas
// ===============================
// Este módulo concentra todas las operaciones relacionadas con los movimientos
// (ventas, egresos, gastos, ajustes) y los gráficos/resúmenes que dependen de ellos.

/**
 * Garantiza que los campos de filtro de movimientos tengan valores iniciales coherentes.
 * Asigna la fecha de hoy y el rango "día" solo la primera vez que se abre el módulo.
 */
window.ensureMovimientosFiltros = function ensureMovimientosFiltros() {
    const fechaInput = document.getElementById('fechaBaseMovimientos');
    const rangoSelect = document.getElementById('rangoTiempoMovimientos');
    const hoy = new Date().toISOString().slice(0, 10);
    if (fechaInput && !fechaInput.value) fechaInput.value = hoy;
    if (rangoSelect && !rangoSelect.value) rangoSelect.value = 'dia';
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
        const tipo = document.getElementById('filterTipo')?.value || '';
        const producto = document.getElementById('filterProducto')?.value || '';
        const fechaBase = document.getElementById('fechaBaseMovimientos')?.value;
        const rango = document.getElementById('rangoTiempoMovimientos')?.value || 'dia';
        const qs = new URLSearchParams();
        if (tipo) qs.set('tipo', tipo);
        if (producto) qs.set('producto_id', producto);
        if (options.applyDateFilter) {
            if (!fechaBase) return alert('Selecciona una fecha base');
            qs.set('fechaBase', fechaBase);
            qs.set('rango', rango);
        }

        const res = await fetch('/movimientos' + (qs.toString() ? '?' + qs.toString() : ''));
        const data = await res.json();
        if (!res.ok) return console.error('Error cargando movimientos', data);

        window.lastMovimientos = data.movimientos || [];
            renderMovimientosTable(window.lastMovimientos);
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
    tbody.innerHTML = '';

    movimientos.forEach(m => {
        const fecha = m.fecha ? new Date(m.fecha * 1000).toLocaleString() : '-';
        const detalles = [m.descripcion, m.producto ? `Producto: ${m.producto}` : '', m.cliente ? `Cliente: ${m.cliente}` : '', m.proveedor ? `Proveedor: ${m.proveedor}` : '']
            .filter(Boolean)
            .join(' • ');
        const vinculo = m.proveedor ? `Proveedor: ${m.proveedor}` : (m.cliente ? `Cliente: ${m.cliente}` : '—');
        tbody.innerHTML += `
        <tr>
            <td>${fecha}</td>
            <td>${m.tipo}</td>
            <td>${detalles || '-'}</td>
            <td>${m.cantidad || 0}</td>
            <td>${m.monto != null ? ('$' + Number(m.monto).toFixed(2)) : '-'}</td>
            <td>${vinculo}</td>
        </tr>`;
    });
};

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
        const resP = await fetch('/productos');
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

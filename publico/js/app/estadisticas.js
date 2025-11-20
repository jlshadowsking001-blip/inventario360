/**
 * Paleta fija para replicar los colores del mockup compartido.
 */
const STATS_COLOR_SWATCH = ['#6fd4e9', '#7cb5ff', '#6c5ce7', '#8f53ff', '#c47dff', '#f19bff'];
const buildStatsPalette = (len) => Array.from({ length: len }, (_, i) => STATS_COLOR_SWATCH[i % STATS_COLOR_SWATCH.length]);

/**
 * Agrupa los datos por periodo (día, semana, mes, año) y acumula totales.
 */
function aggregatePeriodos(resumen = []) {
    const map = new Map();
    resumen.forEach(row => {
        if (!row) return;
        const key = row.periodo || '—';
        if (!map.has(key)) {
            map.set(key, {
                periodo: key,
                total_unidades: 0,
                total_monto: 0,
                total_costo: 0
            });
        }
        const bucket = map.get(key);
        bucket.total_unidades += Number(row.total_unidades) || 0;
        bucket.total_monto += Number(row.total_monto) || 0;
        bucket.total_costo += Number(row.total_costo) || 0;
    });
    return Array.from(map.values()).sort((a, b) => a.periodo.localeCompare(b.periodo));
}

/**
 * Agrupa los datos por producto y acumula totales.
 */
function aggregateProductos(resumen = []) {
    const map = new Map();
    resumen.forEach(row => {
        if (!row) return;
        const key = row.id || row.producto_id || row.nombre || '—';
        if (!map.has(key)) {
            map.set(key, {
                id: key,
                nombre: row.nombre || `Producto ${key}`,
                total_unidades: 0,
                total_monto: 0,
                total_costo: 0
            });
        }
        const bucket = map.get(key);
        bucket.total_unidades += Number(row.total_unidades) || 0;
        bucket.total_monto += Number(row.total_monto) || 0;
        bucket.total_costo += Number(row.total_costo) || 0;
    });
    return Array.from(map.values()).sort((a, b) => (b.total_monto || 0) - (a.total_monto || 0));
}

/**
 * Establece fecha y rango por defecto al cargar el módulo.
 */
window.ensureEstadisticasFiltros = function ensureEstadisticasFiltros() {
    const fechaInput = document.getElementById('fechaBaseEstadisticas');
    const rangoSelect = document.getElementById('rangoTiempoEstadisticas');
    const hoy = new Date().toISOString().slice(0, 10);
    if (fechaInput && !fechaInput.value) fechaInput.value = hoy;
    if (rangoSelect && !rangoSelect.value) rangoSelect.value = 'dia';
};

/**
 * Carga los datos desde el backend y actualiza:
 * - Tabla de resumen
 * - Totales rápidos
 * - Gráficos de barras y pastel
 */
window.filtrarEstadisticas = async function filtrarEstadisticas() {
    window.ensureEstadisticasFiltros();
    const fechaBase = document.getElementById('fechaBaseEstadisticas')?.value;
    const rango = document.getElementById('rangoTiempoEstadisticas')?.value || 'dia';
    if (!fechaBase) return alert('Selecciona una fecha base');

    try {
        const res = await fetch(`/estadisticas?rango=${encodeURIComponent(rango)}&fechaBase=${encodeURIComponent(fechaBase)}`);
        const data = await res.json();
        if (!res.ok) return alert(data.error || 'Error cargando estadísticas');

        const resumen = data.resumen || [];
        let periodos = data.periodos || [];
        let productos = data.productos || [];

        if (!periodos.length && resumen.length) {
            periodos = aggregatePeriodos(resumen);
        }
        if (!productos.length && resumen.length) {
            productos = aggregateProductos(resumen);
        }

        // --- Tabla detallada por periodo/producto ---
        const tbody = document.getElementById('tablaEstadisticasBody');
        tbody.innerHTML = '';
        resumen.forEach(r => {
            const ganancia = (r.total_monto || 0) - (r.total_costo || 0);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${r.periodo}</td>
                <td>${r.nombre}</td>
                <td>${r.total_unidades}</td>
                <td>${r.precio_unitario?.toFixed(2) || '-'}</td>
                <td>${r.total_costo?.toFixed(2) || '-'}</td>
                <td>${ganancia.toFixed(2)}</td>
            `;
            tbody.appendChild(tr);
        });

        // --- Totales rápidos en la cabecera del módulo ---
        const totalVentas = periodos.reduce((a, b) => a + (b.total_monto || 0), 0);
        const totalCostos = periodos.reduce((a, b) => a + (b.total_costo || 0), 0);
        const totalUnidades = periodos.reduce((a, b) => a + (b.total_unidades || 0), 0);
        const gananciaTotal = totalVentas - totalCostos;

        document.getElementById('totalVentas').textContent = totalVentas.toFixed(2);
        document.getElementById('costoTotal').textContent = totalCostos.toFixed(2);
        document.getElementById('gananciaTotal').textContent = gananciaTotal.toFixed(2);
        document.getElementById('productosVendidos').textContent = totalUnidades;

            // --- Gráfico de barras: ventas por periodo ---
        const labels = periodos.map(p => p.periodo);
        const montosActuales = periodos.map(p => p.total_monto || 0);
        const promedioHistorico = periodos.map((_, i) => {
        const subset = periodos.slice(0, i + 1);
        const total = subset.reduce((acc, p) => acc + (p.total_monto || 0), 0);
        return total / subset.length;
        });

        const safeLabels = labels.length ? labels : ['Sin datos'];
        const safeMontos = montosActuales.length ? montosActuales : [0];
        const safePromedios = promedioHistorico.length ? promedioHistorico : [0];

        const ctxBar = document.getElementById('salesBarChart').getContext('2d');
        if (window.barChart) window.barChart.destroy();
        window.barChart = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: safeLabels,
            datasets: [
            {
                label: `Ventas por ${rango}`,
                data: safeMontos,
                backgroundColor: '#4d2ed1',
                borderRadius: 12,
                borderSkipped: false,
                borderColor: '#4d2ed1'
            },
            {
                label: 'Promedio acumulado',
                data: safePromedios,
                backgroundColor: '#cab9ff',
                borderRadius: 12,
                borderSkipped: false,
                borderColor: '#cab9ff'
            }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
            tooltip: {
                backgroundColor: '#2b1c52',
                padding: 10,
                titleFont: { size: 14, family: 'Poppins' },
                bodyFont: { size: 12 }
            }
            },
            scales: {
            x: {
                grid: { display: false },
                ticks: { color: '#4a4171', font: { weight: 600 } }
            },
            y: {
                grid: { color: 'rgba(77,55,166,0.12)', drawBorder: false },
                ticks: { color: '#4a4171' }
            }
            }
        }
        });

        // --- Gráfico de pastel: distribución del capital invertido en inventario ---
        try {
        const resInventario = await fetch('/inventario');
        if (!resInventario.ok) throw new Error('Error al cargar inventario');
        const inventario = await resInventario.json();
        const productosInventario = aggregateInventario(inventario);

        const pieLabels = productosInventario.map(p => p.nombre);
        const pieData = productosInventario.map(p => p.costo_total);
        const piePalette = buildStatsPalette(pieLabels.length || 1);

        const ctxPie = document.getElementById('salesPieChart').getContext('2d');
        if (window.pieChart) window.pieChart.destroy();
        window.pieChart = new Chart(ctxPie, {
            type: 'pie',
            data: {
            labels: pieLabels,
            datasets: [{
                label: 'Distribución del capital invertido en inventario',
                data: pieData,
                backgroundColor: piePalette,
                borderColor: '#fff',
                borderWidth: 2
            }]
            },
            options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                position: 'right',
                labels: {
                    color: '#2b1c52',
                    usePointStyle: true,
                    pointStyle: 'circle',
                    padding: 16
                }
                },
                tooltip: {
                callbacks: {
                    label: function (context) {
                    const label = context.label || '';
                    const value = context.raw || 0;
                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                    const porcentaje = total ? ((value / total) * 100).toFixed(1) : 0;
                    return `${label}: C$${value.toFixed(2)} (${porcentaje}%)`;
                    }
                }
                }
            }
            }
        });
    } catch (err) {
        console.error('Error cargando estadísticas:', err);
        alert('Error al cargar estadísticas');
    }
};

// Carga automática al iniciar la página
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.ensureEstadisticasFiltros();
        if (!window.__estadisticasAutocargadas) {
            window.__estadisticasAutocargadas = true;
            window.filtrarEstadisticas && window.filtrarEstadisticas();
        }
    } catch (err) {
        console.warn('No se pudieron inicializar los filtros de estadísticas:', err);
    }
});
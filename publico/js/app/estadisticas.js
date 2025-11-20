/**
 * Normaliza los controles del módulo de estadísticas estableciendo fecha y rango por defecto.
 * Esto evita que el usuario tenga que seleccionar manualmente la combinación más común (día actual).
 */
window.ensureEstadisticasFiltros = function ensureEstadisticasFiltros() {
    const fechaInput = document.getElementById('fechaBaseEstadisticas');
    const rangoSelect = document.getElementById('rangoTiempoEstadisticas');
    const hoy = new Date().toISOString().slice(0, 10);
    if (fechaInput && !fechaInput.value) fechaInput.value = hoy;
    if (rangoSelect && !rangoSelect.value) rangoSelect.value = 'dia';
};

/**
 * Llama al backend con los filtros seleccionados y reconstruye:
 * 1) Tabla de periodos/productos.
 * 2) Totales rápidos.
 * 3) Las gráficas de barras y pastel.
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
        const totalVentas = resumen.reduce((a, b) => a + (b.total_monto || 0), 0);
        const totalCostos = resumen.reduce((a, b) => a + (b.total_costo || 0), 0);
        const totalUnidades = resumen.reduce((a, b) => a + (b.total_unidades || 0), 0);
        const gananciaTotal = totalVentas - totalCostos;

        document.getElementById('totalVentas').textContent = totalVentas.toFixed(2);
        document.getElementById('costoTotal').textContent = totalCostos.toFixed(2);
        document.getElementById('gananciaTotal').textContent = gananciaTotal.toFixed(2);
        document.getElementById('productosVendidos').textContent = totalUnidades;

        // --- Gráficas comparativas ---
        const labels = resumen.map(r => r.periodo);
        const montos = resumen.map(r => r.total_monto || 0);

        const ctxBar = document.getElementById('salesBarChart').getContext('2d');
        if (window.barChart) window.barChart.destroy();
        window.barChart = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
            label: `Ventas por ${rango}`,
            data: montos,
            backgroundColor: 'rgba(54,162,235,0.6)'
            }]
        }
        });

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

    } 
    catch (err) {
        console.error('Error cargando estadísticas:', err);
        alert('Error al cargar estadísticas');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    try {
        window.ensureEstadisticasFiltros();
        if (!window.__estadisticasAutocargadas) {
            window.__estadisticasAutocargadas = true;
            // Cargar automáticamente el rango del día para mostrar datos sin interacción inicial.
            window.filtrarEstadisticas && window.filtrarEstadisticas();
        }
    } catch (err) {
        console.warn('No se pudieron inicializar los filtros de estadísticas:', err);
    }
});
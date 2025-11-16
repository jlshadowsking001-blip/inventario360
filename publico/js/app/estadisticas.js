/**
 * Solicita estadísticas agregadas al backend y actualiza la UI.
 */
window.filtrarEstadisticas = async function filtrarEstadisticas() {
    const fechaBase = document.getElementById('fechaBase')?.value;
    const rango = document.getElementById('rangoTiempo')?.value;
    if (!fechaBase || !rango) return alert('Selecciona fecha base y rango');

    try {
        const res = await fetch(`/estadisticas?rango=${rango}&fechaBase=${fechaBase}`);
        const data = await res.json();
        if (!res.ok) return alert(data.error || 'Error cargando estadísticas');

        const resumen = data.resumen || [];

        // Actualizar tabla
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

        // Totales
        const totalVentas = resumen.reduce((a, b) => a + (b.total_monto || 0), 0);
        const totalCostos = resumen.reduce((a, b) => a + (b.total_costo || 0), 0);
        const totalUnidades = resumen.reduce((a, b) => a + (b.total_unidades || 0), 0);
        const gananciaTotal = totalVentas - totalCostos;

        document.getElementById('totalVentas').textContent = totalVentas.toFixed(2);
        document.getElementById('costoTotal').textContent = totalCostos.toFixed(2);
        document.getElementById('gananciaTotal').textContent = gananciaTotal.toFixed(2);
        document.getElementById('productosVendidos').textContent = totalUnidades;

        // Gráficas
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
// Módulo de ajustes (stub mínimo para evitar errores de importación)
// Exporta funciones globales que la UI puede llamar.

window.guardarAjustes = function() {
    try {
        const nombreEmpresa = document.getElementById('nombreEmpresa')?.value || '';
        const moneda = document.getElementById('moneda')?.value || '';
        const notificaciones = !!document.getElementById('notificaciones')?.checked;
        const ajustes = { nombreEmpresa, moneda, notificaciones };
        localStorage.setItem('ajustesInventario360', JSON.stringify(ajustes));
        alert('Ajustes guardados');
    } catch (e) {
        console.warn('Error guardando ajustes:', e);
        alert('No se pudo guardar ajustes');
    }
};

window.exportarDatos = function() {
    alert('Función de exportar datos no implementada aún');
};

window.confirmarReset = function() {
    if (confirm('¿Seguro que deseas restablecer el sistema? Esto eliminará datos locales.')) {
        localStorage.clear();
        alert('Sistema restablecido (local)');
        window.location.reload();
    }
};

export default {};

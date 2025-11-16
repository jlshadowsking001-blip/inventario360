// ===============================
// Navegación entre módulos visuales
// ===============================

/**
 * Muestra el módulo con el ID especificado y oculta los demás.
 * @param {string} id - ID del módulo a mostrar.
 */
function mostrarModulo(id) {
    const modulos = document.querySelectorAll('.modulo');
    modulos.forEach(m => m.classList.remove('activo'));
    const activo = document.getElementById(id);
    if (activo) activo.classList.add('activo');
    }

// Exportar función para uso desde HTML inline
window.mostrarModulo = mostrarModulo;
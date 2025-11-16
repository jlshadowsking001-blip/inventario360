// ===============================
// Control del modal genérico
// ===============================

/**
 * Abre el modal con un título y contenido HTML personalizado.
 * @param {string} titulo - Título del modal.
 * @param {string} contenidoHTML - Contenido HTML que se insertará en el formulario del modal.
 */
window.abrirModal = function abrirModal(titulo, contenidoHTML) {
    const modal = document.getElementById('modal');
    const form = document.getElementById('modal-form');
    const tituloEl = document.getElementById('modal-titulo');
    if (modal && form && tituloEl) {
        tituloEl.textContent = titulo;
        form.innerHTML = contenidoHTML;
        modal.style.display = 'block';
    }
};

/**
 * Cierra el modal genérico.
 */
window.cerrarModal = function cerrarModal() {
    const modal = document.getElementById('modal');
    if (modal) modal.style.display = 'none';
};
// ===============================
// Control del modal genérico
// ===============================

const MODAL_FORM_ID = 'modal-form';

/**
 * Abre el modal con un título y contenido HTML personalizado.
 * Permite pasar opciones adicionales como el handler de submit o el selector a enfocar.
 * @param {string} titulo - Título del modal.
 * @param {string} contenidoHTML - Contenido HTML que se insertará en el formulario del modal.
 * @param {{ submitHandler?: string, focusSelector?: string }} options - Opciones de configuración.
 */
window.abrirModal = function abrirModal(titulo, contenidoHTML, options = {}) {
    const modal = document.getElementById('modal');
    const form = document.getElementById(MODAL_FORM_ID);
    const tituloEl = document.getElementById('modal-titulo');
    if (!modal || !form || !tituloEl) return;

    tituloEl.textContent = titulo;
    form.innerHTML = contenidoHTML;
    form.dataset.submitHandler = options.submitHandler || '';

    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';

    if (options.focusSelector) {
        setTimeout(() => {
            const el = form.querySelector(options.focusSelector);
            if (el && typeof el.focus === 'function') {
                el.focus();
            }
        }, 0);
    }
};

/**
 * Cierra el modal genérico y limpia el formulario interno.
 */
window.cerrarModal = function cerrarModal() {
    const modal = document.getElementById('modal');
    const form = document.getElementById(MODAL_FORM_ID);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
    if (form) {
        form.innerHTML = '';
        form.dataset.submitHandler = '';
        delete form.dataset.productId;
    }
};

// Cerrar modal al presionar Escape o al hacer clic en el fondo sombreado
document.addEventListener('keydown', (evt) => {
    if (evt.key === 'Escape') {
        window.cerrarModal();
    }
});

document.addEventListener('click', (evt) => {
    const modal = document.getElementById('modal');
    if (!modal || modal.style.display !== 'block') return;
    if (evt.target === modal) {
        window.cerrarModal();
    }
});
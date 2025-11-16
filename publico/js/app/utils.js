// ===============================
// Funciones utilitarias globales
// ===============================

/**
 * Aplica un retraso controlado a la ejecución de una función.
 * Útil para buscadores o inputs que no deben disparar eventos constantemente.
 * @param {Function} fn - Función a ejecutar.
 * @param {number} delay - Tiempo en milisegundos.
 * @returns {Function}
 */
window.debounce = function debounce(fn, delay) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
};

/**
 * Formatea una fecha en formato legible (dd/mm/yyyy).
 * @param {Date|string|number} fecha - Fecha a formatear.
 * @returns {string}
 */
window.formatearFecha = function formatearFecha(fecha) {
    const d = new Date(fecha);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
};

/**
 * Formatea un número como moneda en córdobas.
 * @param {number} valor - Valor numérico.
 * @returns {string}
 */
window.formatearMoneda = function formatearMoneda(valor) {
    n `C$${Number(valor).toFixed(2)}`;
};

/**
 * Calcula la ganancia a partir de precio y costo.
 * @param {number} precio - Precio de venta.
 * @param {number} costo - Costo del producto.
 * @returns {number}
 */
window.calcularGanancia = function calcularGanancia(precio, costo) {
    return Number(precio) - Number(costo);
};

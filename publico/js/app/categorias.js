// ===============================
// Gestión de categorías
// ===============================

window.categorias = [];
window._categoriaInventarioActiva = null;
window._categoriaVentaActiva = null;
window._busquedaVentas = '';

function normalizarTextoBusqueda(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function coincideBusquedaProducto(producto, query) {
    if (!query) return true;
    const texto = normalizarTextoBusqueda([
        producto.nombre,
        producto.id,
        producto.codigo
    ].filter(value => value != null).join(' '));
    return query.split(/\s+/).every(term => texto.includes(term));
}

/**
 * Carga las categorías desde el servidor y las renderiza en los selectores.
 */
window.cargarCategorias = async function cargarCategorias() {
    try {
        const usuario_id = getUsuarioId();
        if (!usuario_id) return showToast('Usuario no identificado', 'error');

        const res = await fetch(`/categorias?usuario_id=${usuario_id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error cargando categorías');

        categorias.length = 0;
        (data.categorias || []).forEach(c => categorias.push(c));

        const select = document.getElementById('categoria');
        const filtroSelect = document.getElementById('filterProducto');
        if (select) select.innerHTML = '<option value="">Sin categoría</option>';
        if (filtroSelect) filtroSelect.innerHTML = '<option value="">Todos</option>';

        categorias.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.nombre;
            if (select) select.appendChild(option);

            if (filtroSelect) {
                const opt2 = document.createElement('option');
                opt2.value = cat.id;
                opt2.textContent = cat.nombre;
                filtroSelect.appendChild(opt2);
            }
            });
        renderizarCategoriasHeader();
    } 
    catch (err) {
        console.warn('No se pudieron cargar categorías desde el servidor:', err);
        if (categorias.length === 0) categorias.push({ id: 1, nombre: 'General' });
        renderizarCategoriasHeader();
    }
};

/**
 * Envía una nueva categoría al servidor y actualiza la lista.
 */
window.guardarCategoria = async function guardarCategoria() {
    const nombre = document.getElementById('nombreCategoria').value.trim();
    if (!nombre) return showToast('El nombre es obligatorio', 'error');

    const usuario_id = getUsuarioId();
    if (!usuario_id) return showToast('Usuario no identificado', 'error');

    try {
        const res = await fetch('/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, usuario_id })
        });

        const data = await res.json();
        if (!res.ok) return showToast(data.error || 'Error creando categoría', 'error');

        showToast(`Categoría "${data.categoria.nombre}" creada`, 'success');
        document.getElementById('nombreCategoria').value = ''; // Limpiar input
        await cargarCategorias();
    } catch (err) {
        console.error('Error creando categoría:', err);
        showToast('Error creando categoría', 'error');
    }
};

/**
 * Filtra los productos por categoría seleccionada.
 * @param {number|string} categoriaId - ID de la categoría.
 */
window.filtrarPorCategoria = function filtrarPorCategoria(categoriaId) {
    window._categoriaInventarioActiva = String(categoriaId);
    const buscador = document.getElementById('buscador');
    window.searchProducts(buscador ? buscador.value : '');
    marcarCategoriaInventarioActiva();
};

/**
 * Restablece la tabla para mostrar todos los productos sin filtro.
 */
window.mostrarTodosProductos = function mostrarTodosProductos() {
    window._categoriaInventarioActiva = null;
    const buscador = document.getElementById('buscador');
    window.searchProducts(buscador ? buscador.value : '');
    marcarCategoriaInventarioActiva();
};

/**
 * Renderiza los botones de categorías en el encabezado del inventario.
 */
window.renderizarCategoriasHeader = function renderizarCategoriasHeader() {
    const cont = document.getElementById('categoriasHeader');
    if (!cont) return;
    cont.innerHTML = '';

    const btnTodos = document.createElement('button');
    btnTodos.textContent = 'Todos los productos';
    btnTodos.className = 'btn-categoria btn-categoria--todos';
    btnTodos.onclick = () => window.mostrarTodosProductos();
    btnTodos.classList.toggle('is-active', window._categoriaInventarioActiva == null);
    cont.appendChild(btnTodos);

    categorias.forEach(cat => {
        const btn = document.createElement('button');
        btn.textContent = cat.nombre;
        btn.className = 'btn-categoria';
        btn.dataset.categoria = String(cat.id);
        btn.onclick = () => filtrarPorCategoria(cat.id);
        cont.appendChild(btn);
    });

    marcarCategoriaInventarioActiva();
    renderizarCategoriasVentas();
};

function marcarCategoriaInventarioActiva() {
    const buttons = document.querySelectorAll('#categoriasHeader button');
    buttons.forEach(btn => {
        const todos = btn.classList.contains('btn-categoria--todos');
        const activa = todos
            ? window._categoriaInventarioActiva == null
            : btn.dataset.categoria === String(window._categoriaInventarioActiva);
        btn.classList.toggle('is-active', activa);
    });
}

/**
 * Renderiza los chips de categorías en la vista de ventas para filtrar el inventario rápido.
 */
window.renderizarCategoriasVentas = function renderizarCategoriasVentas() {
    const cont = document.getElementById('ventasCategorias');
    if (!cont) return;
    cont.innerHTML = '';

    const crearBtn = (label, value) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ventas-chip-btn';
        btn.textContent = label;
        btn.dataset.categoria = value == null ? '' : String(value);
        btn.addEventListener('click', () => window.filtrarVentasPorCategoria(value == null ? null : value));
        cont.appendChild(btn);
        return btn;
    };

    crearBtn('Todas', null);
    categorias.forEach(cat => crearBtn(cat.nombre, cat.id));
    marcarCategoriaVentasActiva(window._categoriaVentaActiva);
};

/**
 * Aplica un filtro de categoría sobre el inventario mostrado en ventas y marca el chip activo.
 */
window.filtrarVentasPorCategoria = function filtrarVentasPorCategoria(categoriaId) {
    window._categoriaVentaActiva = categoriaId == null ? null : String(categoriaId);
    window.filtrarVentasPorTexto(window._busquedaVentas);
    marcarCategoriaVentasActiva(window._categoriaVentaActiva);
};

window.filtrarVentasPorTexto = function filtrarVentasPorTexto(value) {
    window._busquedaVentas = String(value || '');
    const productos = window._productosCache || [];
    const query = normalizarTextoBusqueda(window._busquedaVentas);
    const categoriaId = window._categoriaVentaActiva;
    const filtrados = productos.filter(producto =>
        (categoriaId == null || String(producto.categoria_id) === String(categoriaId)) &&
        coincideBusquedaProducto(producto, query)
    );
    if (typeof window.renderSalesInventory === 'function') {
        window.renderSalesInventory(filtrados);
    }
};

window.limpiarBusquedaVentas = function limpiarBusquedaVentas() {
    const buscador = document.getElementById('buscadorVentas');
    if (buscador) buscador.value = '';
    window.filtrarVentasPorTexto('');
};

// Función interna que aplica la clase 'is-active' al chip correspondiente al filtro actual.
function marcarCategoriaVentasActiva(categoriaId) {
    const chips = document.querySelectorAll('#ventasCategorias button');
    chips.forEach(btn => {
        const value = btn.dataset.categoria || '';
        const isAll = value === '';
        const matches = !isAll && categoriaId != null ? Number(value) === Number(categoriaId) : isAll && (categoriaId == null || categoriaId === '');
        if (matches) {
            btn.classList.add('is-active');
        } else {
            btn.classList.remove('is-active');
        }
    });
}
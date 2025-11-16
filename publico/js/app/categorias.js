// ===============================
// Gestión de categorías
// ===============================

window.categorias = [];

/**
 * Carga las categorías desde el servidor y las renderiza en los selectores.
 */
window.cargarCategorias = async function cargarCategorias() {
    try {
        const res = await fetch('/categorias');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error cargando categorías');

        categorias.length = 0;
        (data.categorias || []).forEach(c => categorias.push(c));

        const select = document.getElementById('categoria');
        const filtroSelect = document.getElementById('filterProducto');
        if (select) select.innerHTML = '';
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
    if (!nombre) return alert('El nombre es obligatorio');

    try {
        const res = await fetch('/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre })
        });

        const data = await res.json();
        if (!res.ok) return alert(data.error || 'Error creando categoría');

        alert(`Categoría "${data.categoria.nombre}" creada`);
        await cargarCategorias();
    } catch (err) {
        console.error('Error creando categoría:', err);
        alert('Error creando categoría');
    }
};

/**
 * Filtra los productos por categoría seleccionada.
 * @param {number|string} categoriaId - ID de la categoría.
 */
window.filtrarPorCategoria = function filtrarPorCategoria(categoriaId) {
    fetch('/productos')
        .then(r => r.json())
        .then(data => {
        const prods = (data.productos || []).filter(p => Number(p.categoria_id) === Number(categoriaId));
        renderProductsTable(prods);
        })
        .catch(err => console.warn('No se pudo filtrar por categoría:', err));
};

/**
 * Renderiza los botones de categorías en el encabezado del inventario.
 */
window.renderizarCategoriasHeader = function renderizarCategoriasHeader() {
    const cont = document.getElementById('categoriasHeader');
    if (!cont) return;
    cont.innerHTML = '';

    categorias.forEach(cat => {
        const btn = document.createElement('button');
        btn.textContent = cat.nombre;
        btn.className = 'btn-categoria';
        btn.onclick = () => filtrarPorCategoria(cat.id);
        cont.appendChild(btn);
    });
};
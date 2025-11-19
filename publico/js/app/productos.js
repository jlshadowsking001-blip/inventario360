// ===============================
// Gestión de productos e inventario
// ===============================

window._productosCache = window._productosCache || [];

/**
 * Guarda un nuevo producto en la base de datos, incluyendo imagen opcional.
 */
window.guardarProducto = async function guardarProducto() {
    try {
        const nombre = document.getElementById('producto').value;
        const categoria = document.getElementById('categoria').value || null;
        const cantidad = parseInt(document.getElementById('cantidad').value) || 0;
        const precio = parseFloat(document.getElementById('precio').value) || 0;
        const costo = parseFloat(document.getElementById('costo').value) || 0;
        const fileInput = document.getElementById('imagenProducto');
        let dataUrl = null;

        if (fileInput?.files?.[0]) {
        dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(fileInput.files[0]);
        });
        }

        const payload = { nombre, descripcion: null, precio, costo, existencia: cantidad, categoria_id: categoria };
        if (dataUrl) payload.dataUrl = dataUrl;

        const res = await fetch('/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) return alert(data.error || 'Error creando producto');

        alert('Producto creado');
        loadProducts();
        cargarCategorias();
    } catch (err) {
        console.error('Error guardando producto:', err);
        alert('Error guardando producto');
    }
};

/**
 * Carga todos los productos desde el servidor y los renderiza en la tabla.
 */
window.loadProducts = async function loadProducts() {
    try {
        const res = await fetch('/productos');
        const data = await res.json();
        if (res.ok) {
        window._productosCache = data.productos || [];
        renderProductsTable(window._productosCache);
        try { renderSalesInventory(window._productosCache); } catch (e) {}
        try { renderCanasta(); } catch (e) {}
        } else {
        console.error('Error cargando productos', data);
        }
    } catch (err) {
        console.error('Error al fetch productos:', err);
    }
};

/**
 * Renderiza la tabla principal del inventario con inputs editables y botones de acción.
 * @param {Array} productos - Lista de productos.
 */
window.renderProductsTable = function renderProductsTable(productos) {
    const tbody = document.getElementById('tablaInventarioBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    productos.forEach(p => {
        const fila = document.createElement('tr');
        const ganancia = (Number(p.precio || 0) - Number(p.costo || 0)).toFixed(2);
        const estimado = p.estimated_price ? Number(p.estimated_price).toFixed(2) : '-';
        fila.innerHTML = `
        <td>${p.id}</td>
        <td>${p.nombre}</td>
        <td>${p.updated_at ? new Date(p.updated_at * 1000).toLocaleDateString() : (p.created_at ? new Date(p.created_at * 1000).toLocaleDateString() : '—')}</td>
        <td><input data-id="${p.id}" class="input-existencia" type="number" value="${p.existencia || 0}" style="width:70px"></td>
        <td><input data-id="${p.id}" class="input-precio" type="number" step="0.01" value="${p.precio || 0}" style="width:80px"></td>
        <td>${estimado}</td>
        <td>${p.costo != null ? ('$' + Number(p.costo).toFixed(2)) : '—'}</td>
        <td>$${ganancia}</td>
        <td>
            <button class="btn-editar" data-id="${p.id}">Editar</button>
            <button class="btn-eliminar" data-id="${p.id}">Eliminar</button>
        </td>
        `;
        tbody.appendChild(fila);
    });

    // Listeners para inputs y botones
    document.querySelectorAll('.input-precio').forEach(inp => {
        inp.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        const precio = parseFloat(e.target.value) || 0;
        updateProduct(id, { precio });
        });
    });

    document.querySelectorAll('.input-existencia').forEach(inp => {
        inp.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        const existencia = parseInt(e.target.value) || 0;
        updateProduct(id, { existencia });
        });
    });

    tbody.querySelectorAll('.btn-editar').forEach(b => b.addEventListener('click', (e) => {
        editarProducto(e.target.dataset.id);
    }));

    tbody.querySelectorAll('.btn-eliminar').forEach(b => b.addEventListener('click', (e) => {
        eliminarProducto(e.target.dataset.id);
    }));
};

/**
 * Actualiza campos específicos de un producto en el servidor.
 * @param {string} id - ID del producto.
 * @param {object} fields - Campos a actualizar.
 */
window.updateProduct = async function updateProduct(id, fields) {
    try {
        const res = await fetch(`/productos/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields)
        });
        const data = await res.json();
        if (!res.ok) {
        alert(data.error || 'Error actualizando producto');
        } else {
        loadProducts();
        loadStats();
        }
    } catch (err) {
        console.error('Error actualizando producto:', err);
    }
};

window.editarProducto = function editarProducto(id) {
    const producto = (window._productosCache || []).find(p => Number(p.id) === Number(id));
    if (!producto) return alert('Producto no encontrado');

    abrirModal('Editar Producto', `
        <div class="modal-form-row"><div class="col"><label>Producto:</label><input id="producto" name="nombre" type="text" required></div><div class="col"><label>Categoría:</label><select id="categoria" name="categoria"><option value="">Sin categoría</option></select></div></div>
        <div class="modal-form-row"><div class="col"><label>Cantidad:</label><input id="cantidad" name="cantidad" type="number" value="0"></div><div class="col"><label>Precio:</label><input id="precio" name="precio" type="number" step="0.01" value="0"></div></div>
        <div class="modal-form-row"><div class="col"><label>Costo:</label><input id="costo" name="costo" type="number" step="0.01" value="0"></div></div>
        <div style="text-align:right; margin-top:10px;"><button type="submit" class="btn-action primary">Guardar Cambios</button></div>
    `, { submitHandler: 'producto-editar', focusSelector: '#producto' });

    const form = document.getElementById('modal-form');
    if (form) form.dataset.productId = producto.id;

    const nombreInput = document.getElementById('producto');
    const cantidadInput = document.getElementById('cantidad');
    const precioInput = document.getElementById('precio');
    const costoInput = document.getElementById('costo');
    const categoriaSelect = document.getElementById('categoria');

    if (nombreInput) nombreInput.value = producto.nombre || '';
    if (cantidadInput) cantidadInput.value = producto.existencia ?? 0;
    if (precioInput) precioInput.value = producto.precio ?? 0;
    if (costoInput) costoInput.value = producto.costo ?? 0;

    if (categoriaSelect) {
        categoriaSelect.innerHTML = '<option value="">Sin categoría</option>';
        (window.categorias || []).forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.nombre;
            categoriaSelect.appendChild(opt);
        });
        if (producto.categoria_id) categoriaSelect.value = producto.categoria_id;
    }
};

window.actualizarProductoModal = async function actualizarProductoModal() {
    const form = document.getElementById('modal-form');
    if (!form?.dataset?.productId) return alert('Producto no válido');

    const nombre = document.getElementById('producto').value.trim();
    if (!nombre) return alert('El nombre es obligatorio');

    const payload = {
        nombre,
        categoria_id: document.getElementById('categoria').value || null,
        existencia: parseInt(document.getElementById('cantidad').value) || 0,
        precio: parseFloat(document.getElementById('precio').value) || 0,
        costo: parseFloat(document.getElementById('costo').value) || 0
    };

    await updateProduct(form.dataset.productId, payload);
    cerrarModal();
    alert('Producto actualizado');
};

window.eliminarProducto = async function eliminarProducto(id) {
    if (!confirm('¿Eliminar este producto? Esta acción no se puede deshacer.')) return;
    try {
        const res = await fetch(`/productos/${encodeURIComponent(id)}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) return alert(data.error || 'No se pudo eliminar');
        alert('Producto eliminado');
        loadProducts();
        loadMovimientos();
        loadStats();
    } catch (err) {
        console.error('Error eliminando producto:', err);
        alert('Error eliminando producto');
    }
};

/**
 * Filtra productos en el inventario por nombre, ID o código.
 * @param {string} q - Texto de búsqueda.
 */
window.searchProducts = function searchProducts(q) {
    if (!window._productosCache) return;
    const query = String(q || '').trim().toLowerCase();
    if (!query) {
        renderProductsTable(window._productosCache);
        return;
    }
    const filtered = window._productosCache.filter(p => {
        if (!p) return false;
        const nombre = (p.nombre || '').toLowerCase();
        const id = p.id != null ? String(p.id) : '';
        const codigo = p.codigo != null ? String(p.codigo).toLowerCase() : '';
        return nombre.includes(query) || id.includes(query) || codigo.includes(query);
    });
    renderProductsTable(filtered);
    try { renderSalesInventory(filtered); } catch (e) {}
};

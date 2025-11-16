// ===============================
// Gestión de productos e inventario
// ===============================

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
            <button class="btn-vender" data-id="${p.id}">Vender</button>
            <button class="btn-egreso" data-id="${p.id}">Egreso</button>
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

    document.querySelectorAll('.btn-vender').forEach(b => b.addEventListener('click', (e) => {
        venderProducto(e.target.dataset.id);
    }));

    document.querySelectorAll('.btn-egreso').forEach(b => b.addEventListener('click', (e) => {
        registrarEgreso(e.target.dataset.id);
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

/**
 * Registra una venta de un producto solicitando la cantidad.
 * @param {string} id - ID del producto.
 */
window.venderProducto = function venderProducto(id) {
    const cantidad = parseInt(prompt('Cantidad a vender (unidades):', '1'));
    if (!cantidad || cantidad <= 0) return;
    fetch('/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'venta', producto_id: id, cantidad })
    }).then(r => r.json()).then(resp => {
        if (resp.error) return alert(resp.error);
        alert('Venta registrada');
        loadProducts();
        loadMovimientos();
        loadStats();
    }).catch(err => {
        console.error('Error registrando venta:', err);
        alert('Error registrando venta');
    });
};

/**
 * Registra un egreso (salida de inventario) para un producto.
 * @param {string} id - ID del producto.
 */
window.registrarEgreso = function registrarEgreso(id) {
    const cantidad = parseInt(prompt('Cantidad de egreso (unidades):', '1'));
    if (!cantidad || cantidad <= 0) return;
    const descripcion = prompt('Descripción del egreso (opcional):', 'Egreso');
    fetch('/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'egreso', producto_id: id, cantidad, descripcion })
    }).then(r => r.json()).then(resp => {
        if (resp.error) return alert(resp.error);
        alert('Egreso registrado');
        loadProducts();
        loadMovimientos();
        loadStats();
    }).catch(err => {
        console.error('Error registrando egreso:', err);
        alert('Error registrando egreso');
    });
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

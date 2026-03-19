// ===============================
// Gestión de productos e inventario
// ===============================

window._productosCache = window._productosCache || [];
const DEFAULT_PRODUCT_IMAGE = 'assets/logoinventario360.png';

// Función helper que convierte un File en un DataURL para enviarlo vía JSON.
async function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Función que recalcula los totales mostrados en las tarjetas del módulo de inventario.
window.actualizarResumenInventario = function actualizarResumenInventario(productos = window._productosCache || []) {
    const totalArticulosEl = document.getElementById('totalArticulos');
    const costoInventarioEl = document.getElementById('costoInventario');
    if (!totalArticulosEl && !costoInventarioEl) return;

    const lista = Array.isArray(productos) ? productos : [];
    const totalRegistros = lista.length;
    const totalCapital = lista.reduce((acc, prod) => {
        const unidades = Number(prod.existencia) || 0;
        const costoUnit = Number(prod.costo);
        const precioUnit = Number(prod.precio);
        const base = Number.isFinite(costoUnit) ? costoUnit : (Number.isFinite(precioUnit) ? precioUnit : 0);
        return acc + (unidades * base);
    }, 0);

    if (totalArticulosEl) totalArticulosEl.textContent = `${totalRegistros} productos`;

    if (costoInventarioEl) {
        const formato = typeof window.formatearMoneda === 'function'
            ? window.formatearMoneda(totalCapital)
            : `C$${Number(totalCapital || 0).toFixed(2)}`;
        costoInventarioEl.textContent = formato;
    }
};

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

        if (!nombre.trim()) return showToast('El nombre es obligatorio', 'error');
        if (cantidad < 0) return showToast('La cantidad no puede ser negativa', 'error');
        if (precio < 0) return showToast('El precio no puede ser negativo', 'error');
        if (costo < 0) return showToast('El costo no puede ser negativo', 'error');

        const usuario_id = getUsuarioId();
        if (!usuario_id) return showToast('Usuario no identificado', 'error');

        if (fileInput?.files?.[0]) {
            dataUrl = await fileToDataUrl(fileInput.files[0]);
        }

        const payload = { nombre, descripcion: null, precio, costo, existencia: cantidad, categoria_id: categoria, usuario_id };
        if (dataUrl) payload.dataUrl = dataUrl;

        const res = await fetch('/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) return showToast(data.error || 'Error creando producto', 'error');

        showToast('Producto creado', 'success');

        // Limpiar formulario para permitir crear otro producto enseguida
        const productoIn = document.getElementById('producto');
        const categoriaIn = document.getElementById('categoria');
        const cantidadIn = document.getElementById('cantidad');
        const precioIn = document.getElementById('precio');
        const costoIn = document.getElementById('costo');
        const imagenIn = document.getElementById('imagenProducto');

        if (productoIn) productoIn.value = '';
        if (categoriaIn) categoriaIn.value = '';
        if (cantidadIn) cantidadIn.value = '0';
        if (precioIn) precioIn.value = '0';
        if (costoIn) costoIn.value = '0';
        if (imagenIn) imagenIn.value = '';

        loadProducts();
        cargarCategorias();
    } catch (err) {
        console.error('Error guardando producto:', err);
        showToast('Error guardando producto', 'error');
    }
};

/**
 * Carga todos los productos desde el servidor y los renderiza en la tabla.
 */
window.loadProducts = async function loadProducts() {
    try {
        const usuario_id = getUsuarioId();
        if (!usuario_id) return showToast('Usuario no identificado', 'error');

        const res = await fetch(`/productos?usuario_id=${usuario_id}`);
        const data = await res.json();
        if (res.ok) {
        window._productosCache = data.productos || [];
        window.actualizarResumenInventario(window._productosCache);
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
        const imagenSrc = p.image_url || DEFAULT_PRODUCT_IMAGE;
        const fechaRef = p.updated_at || p.created_at;
        fila.innerHTML = `
        <td>${p.id}</td>
        <td>${p.nombre}</td>
        <td class="inventario-img-cell">
            <img class="inventario-img" src="${imagenSrc}" alt="Producto ${p.nombre || p.id}">
        </td>
        <td>${fechaRef ? new Date(fechaRef * 1000).toLocaleDateString() : '—'}</td>
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

// Función que llena y muestra el modal de edición con los datos del producto seleccionado.
window.editarProducto = function editarProducto(id) {
    const producto = (window._productosCache || []).find(p => Number(p.id) === Number(id));
    if (!producto) return alert('Producto no encontrado');

    const imagenActual = producto.image_url || DEFAULT_PRODUCT_IMAGE;

    abrirModal('Editar Producto', `
        <div class="modal-form-row"><div class="col"><label>Producto:</label><input id="producto" name="nombre" type="text" required></div><div class="col"><label>Categoría:</label><select id="categoria" name="categoria"><option value="">Sin categoría</option></select></div></div>
        <div class="modal-form-row"><div class="col"><label>Cantidad:</label><input id="cantidad" name="cantidad" type="number" value="0"></div><div class="col"><label>Precio:</label><input id="precio" name="precio" type="number" step="0.01" value="0"></div></div>
        <div class="modal-form-row"><div class="col"><label>Costo:</label><input id="costo" name="costo" type="number" step="0.01" value="0"></div></div>
        <div class="modal-form-row">
            <div class="col">
                <label>Vista previa:</label>
                <div class="producto-img-preview">
                    <img id="previewImagenProducto" src="${imagenActual}" alt="Vista previa del producto">
                </div>
                <div id="imagenActualTexto" style="margin-top:6px; font-size:12px; color:#555;"></div>
            </div>
            <div class="col">
                <label>Actualizar imagen:</label>
                <input id="imagenProducto" name="imagenProducto" type="file" accept="image/*">
                <small id="imagenProductoAyuda" style="display:block; margin-top:6px; color:var(--color-muted);">Deja vacío si quieres conservar la imagen actual.</small>
            </div>
        </div>
        <div style="text-align:right; margin-top:10px;"><button type="submit" class="btn btn--primary">Guardar Cambios</button></div>
    `, { submitHandler: 'producto-editar', focusSelector: '#producto' });

    const form = document.getElementById('modal-form');
    if (form) form.dataset.productId = producto.id;

    const nombreInput = document.getElementById('producto');
    const cantidadInput = document.getElementById('cantidad');
    const precioInput = document.getElementById('precio');
    const costoInput = document.getElementById('costo');
    const categoriaSelect = document.getElementById('categoria');
    const previewImg = document.getElementById('previewImagenProducto');
    const fileInput = document.getElementById('imagenProducto');

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

    if (previewImg) {
        previewImg.src = imagenActual;
        previewImg.alt = producto.image_url ? `Imagen del producto ${producto.nombre}` : 'Sin imagen';
    }

    const infoImagen = document.getElementById('imagenActualTexto');
    if (infoImagen) {
        infoImagen.textContent = producto.image_url ? 'Imagen actual (puedes cambiarla)' : 'No hay imagen actual. Selecciona un archivo para agregar imagen';
    }

    const ayudaImagen = document.getElementById('imagenProductoAyuda');
    if (ayudaImagen) {
        ayudaImagen.textContent = producto.image_url ? 'Deja vacío si quieres conservar la imagen actual.' : 'Debe seleccionar una imagen si deseas agregar una.';
    }

    if (fileInput && previewImg) {
        fileInput.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            if (!file) {
                previewImg.src = imagenActual;
                return;
            }
            try {
                previewImg.src = await fileToDataUrl(file);
            } catch (error) {
                console.error('Error leyendo imagen seleccionada', error);
            }
        });
    }
};

// Función que toma los valores del modal de edición y envía la actualización al servidor.
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

    const fileInput = document.getElementById('imagenProducto');
    if (fileInput?.files?.[0]) {
        try {
            payload.dataUrl = await fileToDataUrl(fileInput.files[0]);
        } catch (error) {
            console.error('Error convirtiendo imagen', error);
            alert('No se pudo leer la imagen seleccionada');
            return;
        }
    }

    await updateProduct(form.dataset.productId, payload);
    cerrarModal();
    alert('Producto actualizado');
};

// Función que elimina un producto tras confirmar y refresca los datos relacionados.
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

// ===============================
// Gestión de productos e inventario
// ===============================

window._productosCache = window._productosCache || [];
window._productosSeleccionadosParaEliminar = window._productosSeleccionadosParaEliminar || new Set();
window._modoSeleccionEliminarProductos = false;
window._eliminandoProductosEnCola = false;
const DEFAULT_PRODUCT_IMAGE = 'assets/logoinventario360.png';

function escaparHTML(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[caracter]);
}

window.seleccionarArchivoInventario = function seleccionarArchivoInventario() {
    document.getElementById('archivoInventarioExcel')?.click();
};

window.importarInventarioExcel = async function importarInventarioExcel(file) {
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) {
        showToast('Selecciona un archivo Excel .xlsx', 'error');
        return;
    }
    if (file.size > 10 * 1024 * 1024) {
        showToast('El archivo no puede superar los 10 MB', 'error');
        return;
    }

    const usuario_id = getUsuarioId();
    if (!usuario_id) return showToast('Usuario no identificado', 'error');

    const boton = document.getElementById('btnImportarInventario');
    if (boton) boton.disabled = true;
    try {
        const res = await fetch(`/productos/importar?usuario_id=${encodeURIComponent(usuario_id)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: file
        });
        const data = await res.json();
        if (!res.ok) return showToast(data.error || 'No se pudo importar el inventario', 'error');

        await window.cargarCategorias();
        await window.loadProducts();
        const detalle = `${data.creados} nuevos, ${data.actualizados} actualizados, ${data.preciosGuardados || 0} con precio de venta guardado, ${data.sinExistencia || 0} sin existencia y ${data.erroresTotal || 0} filas con datos inválidos`;
        showToast(`Importación completada: ${detalle}`, 'success');
        if (data.errores?.length) console.warn('Filas omitidas durante la importación:', data.errores);
    } catch (err) {
        console.error('Error importando inventario desde Excel:', err);
        showToast('Error al importar el archivo Excel', 'error');
    } finally {
        if (boton) boton.disabled = false;
        const input = document.getElementById('archivoInventarioExcel');
        if (input) input.value = '';
    }
};

document.getElementById('archivoInventarioExcel')?.addEventListener('change', event => {
    window.importarInventarioExcel(event.target.files?.[0]);
});

function actualizarColaEliminacion() {
    const cola = document.getElementById('colaEliminarProductos');
    const contador = document.getElementById('contadorColaEliminar');
    const lista = document.getElementById('listaColaEliminar');
    const confirmar = document.getElementById('confirmarColaEliminar');
    const seleccionarTodos = document.getElementById('seleccionarTodosEliminar');
    const tabla = document.querySelector('.tabla-inventario');
    const botonEliminar = document.getElementById('btnEliminarProducto');
    const seleccionados = window._productosSeleccionadosParaEliminar;

    if (cola) cola.hidden = !window._modoSeleccionEliminarProductos;
    if (tabla) tabla.classList.toggle('is-delete-mode', window._modoSeleccionEliminarProductos);
    if (botonEliminar) {
        botonEliminar.textContent = window._modoSeleccionEliminarProductos ? 'Salir de eliminación' : 'Eliminar Producto';
        botonEliminar.setAttribute('aria-pressed', String(window._modoSeleccionEliminarProductos));
        botonEliminar.disabled = window._eliminandoProductosEnCola;
    }
    if (contador) {
        const total = seleccionados.size;
        contador.textContent = `${total} ${total === 1 ? 'producto seleccionado' : 'productos seleccionados'}`;
    }
    if (confirmar) {
        confirmar.disabled = seleccionados.size === 0 || window._eliminandoProductosEnCola;
        confirmar.textContent = `Eliminar seleccionados${seleccionados.size ? ` (${seleccionados.size})` : ''}`;
    }
    if (seleccionarTodos) {
        const productos = window._productosCache || [];
        const todosSeleccionados = productos.length > 0 &&
            productos.every(producto => seleccionados.has(String(producto.id)));
        seleccionarTodos.textContent = todosSeleccionados ? 'Desmarcar todo' : 'Seleccionar todos';
        seleccionarTodos.disabled = productos.length === 0 || window._eliminandoProductosEnCola;
        seleccionarTodos.setAttribute('aria-pressed', String(todosSeleccionados));
    }
    document.getElementById('limpiarColaEliminar')?.toggleAttribute('disabled', window._eliminandoProductosEnCola);
    document.getElementById('cancelarColaEliminar')?.toggleAttribute('disabled', window._eliminandoProductosEnCola);
    document.querySelectorAll('.producto-seleccion-eliminar').forEach(checkbox => {
        checkbox.disabled = window._eliminandoProductosEnCola;
    });
    if (!lista) return;

    lista.replaceChildren();
    const productos = (window._productosCache || []).filter(producto => seleccionados.has(String(producto.id)));
    productos.forEach(producto => {
        const etiqueta = document.createElement('span');
        etiqueta.className = 'inventario-delete-queue__item';

        const nombre = document.createElement('span');
        const referencia = producto.codigo ? ` · ${producto.codigo}` : '';
        nombre.textContent = `${producto.nombre} · ID ${producto.id}${referencia}`;
        etiqueta.appendChild(nombre);

        const quitar = document.createElement('button');
        quitar.type = 'button';
        quitar.className = 'inventario-delete-queue__remove';
        quitar.textContent = '×';
        quitar.disabled = window._eliminandoProductosEnCola;
        quitar.setAttribute('aria-label', `Quitar ${producto.nombre} de la cola`);
        quitar.addEventListener('click', () => cambiarSeleccionEliminacion(producto.id, false));
        etiqueta.appendChild(quitar);
        lista.appendChild(etiqueta);
    });
}

function cambiarSeleccionEliminacion(productoId, seleccionado) {
    const id = String(productoId);
    if (seleccionado) {
        window._productosSeleccionadosParaEliminar.add(id);
    } else {
        window._productosSeleccionadosParaEliminar.delete(id);
    }
    actualizarColaEliminacion();
}

function vaciarColaEliminacion() {
    window._productosSeleccionadosParaEliminar.clear();
    actualizarColaEliminacion();
    const tabla = document.querySelector('.tabla-inventario');
    tabla?.querySelectorAll('.producto-seleccion-eliminar').forEach(checkbox => {
        checkbox.checked = false;
        checkbox.closest('tr')?.classList.remove('is-selected-for-deletion');
    });
}

function alternarSeleccionTodosEliminar() {
    const productos = window._productosCache || [];
    if (productos.length === 0) return;
    const seleccionados = window._productosSeleccionadosParaEliminar;
    const todosSeleccionados = productos.every(producto => seleccionados.has(String(producto.id)));

    if (todosSeleccionados) {
        seleccionados.clear();
    } else {
        productos.forEach(producto => seleccionados.add(String(producto.id)));
    }
    actualizarColaEliminacion();
    document.querySelectorAll('.producto-seleccion-eliminar').forEach(checkbox => {
        checkbox.checked = seleccionados.has(String(checkbox.dataset.id));
        checkbox.closest('tr')?.classList.toggle('is-selected-for-deletion', checkbox.checked);
    });
}

async function confirmarEliminacionEnCola() {
    const ids = [...window._productosSeleccionadosParaEliminar];
    if (!ids.length) return;

    const seleccionados = (window._productosCache || [])
        .filter(producto => ids.includes(String(producto.id)));
    const ejemplos = seleccionados.slice(0, 3).map(producto => `• ${producto.nombre}`).join('\n');
    const otros = seleccionados.length > 3 ? `\n• y ${seleccionados.length - 3} más` : '';
    if (!confirm(`¿Eliminar definitivamente ${ids.length} ${ids.length === 1 ? 'producto' : 'productos'}?\n\n${ejemplos}${otros}\n\nEsta acción no se puede deshacer.`)) return;

    const usuario_id = getUsuarioId();
    if (!usuario_id) return showToast('Usuario no identificado', 'error');

    window._eliminandoProductosEnCola = true;
    actualizarColaEliminacion();
    const eliminados = [];
    const errores = [];

    try {
        for (const id of ids) {
            const producto = seleccionados.find(item => String(item.id) === id);
            try {
                const res = await fetch(`/productos/${encodeURIComponent(id)}?usuario_id=${encodeURIComponent(usuario_id)}`, {
                    method: 'DELETE'
                });
                const data = await res.json();
                if (!res.ok) {
                    errores.push(`${producto?.nombre || id}: ${data.error || 'no se pudo eliminar'}`);
                    continue;
                }
                eliminados.push(id);
                window._productosSeleccionadosParaEliminar.delete(id);
            } catch (error) {
                console.error(`Error eliminando producto ${id}:`, error);
                errores.push(`${producto?.nombre || id}: error de conexión`);
            }
        }

        if (eliminados.length) await window.loadProducts();
        if (errores.length) {
            showToast(`${eliminados.length} eliminados; ${errores.length} permanecen en la cola`, 'error');
            console.error('Productos que no se pudieron eliminar:', errores);
        } else {
            showToast(`${eliminados.length} ${eliminados.length === 1 ? 'producto eliminado' : 'productos eliminados'}`, 'success');
            window._modoSeleccionEliminarProductos = false;
        }
        actualizarColaEliminacion();
    } finally {
        window._eliminandoProductosEnCola = false;
        actualizarColaEliminacion();
    }
}

document.getElementById('seleccionarTodosEliminar')?.addEventListener('click', alternarSeleccionTodosEliminar);
document.getElementById('limpiarColaEliminar')?.addEventListener('click', vaciarColaEliminacion);
document.getElementById('cancelarColaEliminar')?.addEventListener('click', () => {
    vaciarColaEliminacion();
    window._modoSeleccionEliminarProductos = false;
    actualizarColaEliminacion();
});
document.getElementById('confirmarColaEliminar')?.addEventListener('click', confirmarEliminacionEnCola);

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
        const codigo = document.getElementById('codigoProducto')?.value.trim() || null;
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

        const payload = { nombre, codigo, descripcion: null, precio, costo, existencia: cantidad, categoria_id: categoria, usuario_id };
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
        const codigoIn = document.getElementById('codigoProducto');
        const categoriaIn = document.getElementById('categoria');
        const cantidadIn = document.getElementById('cantidad');
        const precioIn = document.getElementById('precio');
        const costoIn = document.getElementById('costo');
        const imagenIn = document.getElementById('imagenProducto');

        if (productoIn) productoIn.value = '';
        if (codigoIn) codigoIn.value = '';
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
        const idsActuales = new Set(window._productosCache.map(producto => String(producto.id)));
        window._productosSeleccionadosParaEliminar.forEach(id => {
            if (!idsActuales.has(id)) window._productosSeleccionadosParaEliminar.delete(id);
        });
        window.actualizarResumenInventario(window._productosCache);
        const buscador = document.getElementById('buscador');
        window.searchProducts(buscador ? buscador.value : '');
        const buscadorVentas = document.getElementById('buscadorVentas');
        if (typeof window.filtrarVentasPorTexto === 'function') {
            window.filtrarVentasPorTexto(buscadorVentas ? buscadorVentas.value : '');
        } else {
            renderSalesInventory(window._productosCache);
        }
        actualizarColaEliminacion();
        try { renderCanasta(); } catch (e) {}
        } else {
        console.error('Error cargando productos', data);
        }
    } catch (err) {
        console.error('Error al fetch productos:', err);
    }
};

/**
 * Renderiza la tabla principal del inventario con inputs editables.
 * @param {Array} productos - Lista de productos.
 */
window.renderProductsTable = function renderProductsTable(productos) {
    const tbody = document.getElementById('tablaInventarioBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!productos.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="inventario-empty">No se encontraron productos.</td></tr>';
        return;
    }

    productos.forEach(p => {
        const fila = document.createElement('tr');
        const ganancia = (Number(p.precio || 0) - Number(p.costo || 0)).toFixed(2);
        const estimado = p.estimated_price ? Number(p.estimated_price).toFixed(2) : '-';
        const imagenSrc = p.image_url || DEFAULT_PRODUCT_IMAGE;
        const fechaRef = p.updated_at || p.created_at;
        const nombre = escaparHTML(p.nombre);
        const codigo = escaparHTML(p.codigo);
        const id = escaparHTML(p.id);
        const seleccionadoParaEliminar = window._productosSeleccionadosParaEliminar.has(String(p.id));
        fila.innerHTML = `
        <td>
            <div class="inventario-product-cell">
                <input class="producto-seleccion-eliminar" type="checkbox" data-id="${id}" aria-label="Seleccionar ${nombre}, ID ${id}, para eliminar" ${seleccionadoParaEliminar ? 'checked' : ''}>
                <img class="inventario-img" src="${escaparHTML(imagenSrc)}" alt="Producto ${nombre}">
                <span>${nombre}${p.codigo ? `<small class="inventario-codigo">Código: ${codigo}</small>` : ''}</span>
            </div>
        </td>
        <td><input data-id="${id}" class="input-precio" type="number" step="0.01" value="${p.precio || 0}" style="width:80px"></td>
        <td><input data-id="${id}" class="input-costo" type="number" min="0" step="0.01" value="${p.costo ?? 0}" style="width:80px"></td>
        <td><input data-id="${id}" class="input-existencia" type="number" value="${p.existencia || 0}" style="width:70px"></td>
        <td>$${ganancia}</td>
        <td>${estimado}</td>
        <td>${fechaRef ? new Date(fechaRef * 1000).toLocaleDateString() : '—'}</td>
        <td><button class="btn-editar" data-id="${id}">Editar</button></td>
        `;
        tbody.appendChild(fila);
    });
    tbody.querySelectorAll('.producto-seleccion-eliminar').forEach(checkbox => {
        checkbox.addEventListener('change', event => {
            const input = event.currentTarget;
            cambiarSeleccionEliminacion(input.dataset.id, input.checked);
            input.closest('tr')?.classList.toggle('is-selected-for-deletion', input.checked);
        });
        checkbox.closest('tr')?.classList.toggle('is-selected-for-deletion', checkbox.checked);
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

    document.querySelectorAll('.input-costo').forEach(inp => {
        inp.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        const costo = Number(e.target.value);
        if (!Number.isFinite(costo) || costo < 0) {
            showToast('El costo no puede ser negativo', 'error');
            const producto = (window._productosCache || []).find(p => Number(p.id) === Number(id));
            e.target.value = producto?.costo ?? 0;
            return;
        }
        updateProduct(id, { costo });
        });
    });

    tbody.querySelectorAll('.btn-editar').forEach(b => b.addEventListener('click', (e) => {
        editarProducto(e.target.dataset.id);
    }));

};

window.abrirModalEliminarProducto = function abrirModalEliminarProducto() {
    const productos = window._productosCache || [];
    if (!productos.length) return showToast('No hay productos para eliminar', 'info');
    window._modoSeleccionEliminarProductos = !window._modoSeleccionEliminarProductos;
    if (!window._modoSeleccionEliminarProductos) vaciarColaEliminacion();
    actualizarColaEliminacion();
    window.searchProducts(document.getElementById('buscador')?.value || '');
};

function actualizarFilaProductoEnInventario(producto) {
    const filas = document.querySelectorAll('#tablaInventarioBody tr');
    const fila = [...filas].find(row => row.querySelector('[data-id]')?.dataset.id === String(producto.id));
    if (!fila) return;

    const precio = Number(producto.precio) || 0;
    const costo = Number(producto.costo) || 0;
    const inputPrecio = fila.querySelector('.input-precio');
    const inputCosto = fila.querySelector('.input-costo');
    const inputExistencia = fila.querySelector('.input-existencia');
    if (inputPrecio) inputPrecio.value = String(precio);
    if (inputCosto) inputCosto.value = String(costo);
    if (inputExistencia) inputExistencia.value = String(Number(producto.existencia) || 0);
    if (fila.cells[4]) fila.cells[4].textContent = (precio - costo).toFixed(2);

    const fechaRef = producto.updated_at || producto.created_at;
    if (fila.cells[6]) {
        fila.cells[6].textContent = fechaRef
            ? new Date(Number(fechaRef) * 1000).toLocaleDateString()
            : '—';
    }
}

/**
 * Actualiza campos específicos de un producto en el servidor.
 * @param {string} id - ID del producto.
 * @param {object} fields - Campos a actualizar.
 */
window.updateProduct = async function updateProduct(id, fields) {
    const camposEnLinea = ['precio', 'costo', 'existencia'];
    const actualizacionEnLinea = Object.keys(fields).every(campo => camposEnLinea.includes(campo));
    const productoAnterior = (window._productosCache || []).find(producto => String(producto.id) === String(id));
    const filas = document.querySelectorAll('#tablaInventarioBody tr');
    const fila = [...filas].find(row => row.querySelector('[data-id]')?.dataset.id === String(id));
    const entradasPorCampo = {
        precio: fila?.querySelector('.input-precio'),
        costo: fila?.querySelector('.input-costo'),
        existencia: fila?.querySelector('.input-existencia')
    };
    const entradasEnEdicion = Object.keys(fields)
        .map(campo => entradasPorCampo[campo])
        .filter(Boolean);
    entradasEnEdicion.forEach(input => { input.disabled = true; });
    const restaurarEntradas = () => {
        if (!productoAnterior) return;
        Object.entries(fields).forEach(([campo]) => {
            const input = entradasPorCampo[campo];
            if (input) input.value = String(productoAnterior[campo] ?? 0);
        });
    };

    try {
        const usuario_id = getUsuarioId();
        if (!usuario_id) return showToast('Usuario no identificado', 'error');
        const res = await fetch(`/productos/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, usuario_id })
        });
        const data = await res.json();
        if (!res.ok) {
        restaurarEntradas();
        showToast(data.error || 'Error actualizando producto', 'error');
        return false;
        } else {
        if (productoAnterior) {
            Object.assign(productoAnterior, data.producto || fields);
            window.actualizarResumenInventario(window._productosCache);
            if (actualizacionEnLinea) {
            actualizarFilaProductoEnInventario(productoAnterior);
            } else {
                const contenedorTabla = document.querySelector('.inventario-tabla-scroll');
                const scrollTop = contenedorTabla?.scrollTop || 0;
                const scrollLeft = contenedorTabla?.scrollLeft || 0;
                window.searchProducts(document.getElementById('buscador')?.value || '');
                if (contenedorTabla) {
                    contenedorTabla.scrollTop = scrollTop;
                    contenedorTabla.scrollLeft = scrollLeft;
                }
            }
            if (!actualizacionEnLinea || fields.precio !== undefined || fields.existencia !== undefined) {
                window.filtrarVentasPorTexto?.(window._busquedaVentas || '');
            }
            if (fields.precio !== undefined) showToast('Precio guardado', 'success');
            return true;
        }
        await loadProducts();
        return true;
        }
    } catch (err) {
        restaurarEntradas();
        console.error('Error actualizando producto:', err);
        showToast('Error actualizando producto', 'error');
        return false;
    } finally {
        entradasEnEdicion.forEach(input => { input.disabled = false; });
    }
};

// Función que llena y muestra el modal de edición con los datos del producto seleccionado.
window.editarProducto = function editarProducto(id) {
    const producto = (window._productosCache || []).find(p => Number(p.id) === Number(id));
    if (!producto) return showToast('Producto no encontrado', 'error');

    const imagenActual = producto.image_url || DEFAULT_PRODUCT_IMAGE;

    abrirModal('Editar Producto', `
        <div class="modal-form-row"><div class="col"><label>Producto:</label><input id="producto" name="nombre" type="text" required></div><div class="col"><label>Código:</label><input id="codigoProducto" name="codigo" type="text"></div><div class="col"><label>Categoría:</label><select id="categoria" name="categoria"><option value="">Sin categoría</option></select></div></div>
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
    const codigoInput = document.getElementById('codigoProducto');
    const cantidadInput = document.getElementById('cantidad');
    const precioInput = document.getElementById('precio');
    const costoInput = document.getElementById('costo');
    const categoriaSelect = document.getElementById('categoria');
    const previewImg = document.getElementById('previewImagenProducto');
    const fileInput = document.getElementById('imagenProducto');

    if (nombreInput) nombreInput.value = producto.nombre || '';
    if (codigoInput) codigoInput.value = producto.codigo || '';
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
    if (!form?.dataset?.productId) return showToast('Producto no válido', 'error');

    const nombre = document.getElementById('producto').value.trim();
    if (!nombre) return showToast('El nombre es obligatorio', 'error');

    const payload = {
        nombre,
        codigo: document.getElementById('codigoProducto')?.value.trim() || null,
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
            showToast('No se pudo leer la imagen seleccionada', 'error');
            return;
        }
    }

    const updated = await updateProduct(form.dataset.productId, payload);
    if (!updated) return;
    cerrarModal();
    showToast('Producto actualizado', 'success');
};

// Función que elimina un producto tras confirmar y refresca los datos relacionados.
window.eliminarProducto = async function eliminarProducto(id) {
    if (!confirm('¿Eliminar este producto? Esta acción no se puede deshacer.')) return;
    try {
        const usuario_id = getUsuarioId();
        if (!usuario_id) return showToast('Usuario no identificado', 'error');
        const res = await fetch(`/productos/${encodeURIComponent(id)}?usuario_id=${encodeURIComponent(usuario_id)}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) return showToast(data.error || 'No se pudo eliminar', 'error');
        cerrarModal();
        showToast('Producto eliminado', 'success');
        await loadProducts();
        await loadMovimientos();
        await loadStats();
    } catch (err) {
        console.error('Error eliminando producto:', err);
        showToast('Error eliminando producto', 'error');
    }
};

/**
 * Filtra productos en el inventario por nombre, ID o código.
 * @param {string} q - Texto de búsqueda.
 */
window.searchProducts = function searchProducts(q) {
    if (!window._productosCache) return;
    const query = String(q || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    const categoriaId = window._categoriaInventarioActiva;
    const filtered = window._productosCache.filter(p => {
        if (!p) return false;
        if (categoriaId != null && String(p.categoria_id) !== String(categoriaId)) return false;
        if (!query) return true;
        const searchable = [p.nombre, p.id, p.codigo]
            .filter(value => value != null)
            .join(' ')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
        return query.split(/\s+/).every(term => searchable.includes(term));
    });
    filtered.sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', { sensitivity: 'base' }));
    renderProductsTable(filtered);
};

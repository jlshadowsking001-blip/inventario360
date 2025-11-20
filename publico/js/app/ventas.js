// ===============================
// Lógica de ventas y canasta
// ===============================

window._canasta = window._canasta || [];

/**
 * Renderiza la tabla de productos disponibles para venta.
 * @param {Array} productos - Lista de productos.
 */
window.renderSalesInventory = function renderSalesInventory(productos) {
    const tbody = document.getElementById('tablaventasBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    (productos || []).forEach(p => {
        const tr = document.createElement('tr');
        const disponible = Number(p.existencia) || 0;
        const precio = Number(p.precio) || 0;
        const precioTexto = typeof window.formatearMoneda === 'function'
            ? window.formatearMoneda(precio)
            : `C$${precio.toFixed(2)}`;
        const imagen = p.image_url || p.imagen || 'assets/logoinventario360.png';
        tr.classList.add('venta-producto-row');
        tr.dataset.id = p.id;
        tr.innerHTML = `
        <td class="venta-producto-img-cell"><img src="${imagen}" alt="${p.nombre}" class="venta-producto-img"></td>
        <td>
            <div class="venta-producto-nombre">${p.nombre}</div>
            ${p.descripcion ? `<small class="venta-producto-desc">${p.descripcion}</small>` : ''}
        </td>
        <td>${disponible}</td>
        <td>${precioTexto}</td>
        `;
        tbody.appendChild(tr);

        tr.addEventListener('click', () => {
            addToCanasta(p.id, 1);
        });
    });
};

/**
 * Agrega un producto a la canasta o incrementa su cantidad si ya existe.
 * @param {string} id - ID del producto.
 * @param {number} cantidad - Cantidad a agregar.
 */
window.addToCanasta = function addToCanasta(id, cantidad) {
    const prod = (window._productosCache || []).find(x => String(x.id) === String(id));
    if (!prod) return alert('Producto no encontrado');
    const exist = window._canasta.find(i => String(i.id) === String(id));
    if (exist) {
        exist.cantidad = Number(exist.cantidad) + Number(cantidad);
    } else {
        window._canasta.push({ id: prod.id, nombre: prod.nombre, precio: prod.precio || 0, cantidad: Number(cantidad) });
    }
    renderCanasta();
};

/**
 * Renderiza la tabla de productos en la canasta de venta.
 */
window.renderCanasta = function renderCanasta() {
    const body = document.getElementById('canastaBody');
    if (!body) return;
    body.innerHTML = '';

    window._canasta.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
        <td>${item.nombre}</td>
        <td><input data-id="${item.id}" class="canasta-cantidad" type="number" value="${item.cantidad}" style="width:70px"></td>
        <td>${item.precio}</td>
        <td>${(item.precio * item.cantidad).toFixed(2)}</td>
        <td><button class="btn-remove-canasta" data-id="${item.id}">Eliminar</button></td>
        `;
        body.appendChild(tr);
    });

    body.querySelectorAll('.canasta-cantidad').forEach(inp => inp.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        const v = parseInt(e.target.value) || 1;
        const it = window._canasta.find(i => String(i.id) === String(id));
        if (it) {
        it.cantidad = v;
        renderCanasta();
        }
    }));

    body.querySelectorAll('.btn-remove-canasta').forEach(b => b.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        window._canasta = window._canasta.filter(i => String(i.id) !== String(id));
        renderCanasta();
    }));
};

/**
 * Limpia la canasta actual y reinicia la venta.
 */
window.Nuevaventa = function Nuevaventa() {
    if (!confirm('Iniciar nueva venta y vaciar canasta actual?')) return;
    window._canasta = [];
    renderCanasta();
};

/**
 * Vacía la canasta sin registrar venta.
 */
window.vaciarcanasta = function vaciarcanasta() {
    if (!confirm('Vaciar canasta?')) return;
    window._canasta = [];
    renderCanasta();
};

/**
 * Finaliza la venta actual y registra los movimientos en el servidor.
 */
window.terminarventa = async function terminarventa() {
    if (!window._canasta?.length) return alert('Canasta vacía');
    const clienteSelect = document.getElementById('clienteVentaSelect');
    const clienteId = clienteSelect && clienteSelect.value ? clienteSelect.value : null;

    try {
        for (const item of window._canasta) {
        const res = await fetch('/movimientos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
            tipo: 'venta',
            producto_id: item.id,
            cantidad: item.cantidad,
            cliente_id: clienteId || null
            })
        });
        const data = await res.json();
        if (!res.ok) {
            console.warn('Error registrando venta de', item.nombre, data);
        }
        }

        alert('Venta registrada correctamente');
        window._canasta = [];
        renderCanasta();
        loadProducts();
        loadMovimientos();
        loadMovimientosUI();
        loadStats();
    } catch (err) {
        console.error('Error finalizando venta:', err);
        alert('Error al registrar la venta');
    }
};

window.abrirModalGasto = function abrirModalGasto() {
    const proveedores = window._proveedoresCache || [];
    const options = proveedores.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
    abrirModal('Registrar gasto', `
        <div class="modal-form-row">
            <div class="col">
                <label>Monto (C$)</label>
                <input id="gastoMonto" type="number" step="0.01" min="0" required>
            </div>
            <div class="col">
                <label>Proveedor (opcional)</label>
                <select id="gastoProveedor">
                    <option value="">Sin proveedor</option>
                    ${options}
                </select>
            </div>
        </div>
        <label>Descripción</label>
        <textarea id="gastoDescripcion" rows="3" placeholder="Describe el gasto"></textarea>
        <div style="text-align:right; margin-top:12px;">
            <button type="submit" class="btn-action primary">Guardar gasto</button>
        </div>
    `, { submitHandler: 'gasto', focusSelector: '#gastoMonto' });
};

window.guardarGasto = async function guardarGasto() {
    const monto = parseFloat(document.getElementById('gastoMonto').value);
    if (!monto || monto <= 0) return alert('El monto es obligatorio');
    const descripcion = (document.getElementById('gastoDescripcion').value || '').trim() || 'Gasto';
    const proveedor = document.getElementById('gastoProveedor').value || null;

    try {
        const res = await fetch('/movimientos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipo: 'gasto', monto, descripcion, proveedor_id: proveedor || null })
        });
        const data = await res.json();
        if (!res.ok) return alert(data.error || 'No se pudo registrar el gasto');
        alert('Gasto registrado');
        cerrarModal();
        loadMovimientos();
        loadMovimientosUI();
    } catch (err) {
        console.error('Error guardando gasto:', err);
        alert('Error guardando gasto');
    }
};

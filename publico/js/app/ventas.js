// ===============================
// Lógica de ventas y canasta
// ===============================

window._canasta = window._canasta || [];
window.modoVentaActual = window.modoVentaActual || 'contado';

// Función que muestra u oculta el aviso cuando se intenta vender a crédito sin cliente asignado.
function actualizarAvisoCredito() {
    const aviso = document.getElementById('ventasCreditoAviso');
    const clienteSelect = document.getElementById('clienteVentaSelect');
    const requiereAviso = window.modoVentaActual === 'credito' && !(clienteSelect && clienteSelect.value);
    if (aviso) {
        aviso.hidden = !requiereAviso;
    }
}

// Función que aplica el estado activo a los botones de modo de pago y refresca el aviso.
function sincronizarModoVentaUI() {
    document.querySelectorAll('.ventas-pago-btn').forEach(btn => {
        const isActive = btn.dataset.mode === window.modoVentaActual;
        btn.classList.toggle('is-active', isActive);
    });
    actualizarAvisoCredito();
}

// Función pública que cambia entre venta de contado o a crédito y refresca la vista.
window.seleccionarModoVenta = function seleccionarModoVenta(modo) {
    window.modoVentaActual = modo === 'credito' ? 'credito' : 'contado';
    sincronizarModoVentaUI();
};

window.actualizarAvisoCredito = actualizarAvisoCredito;

// IIFE que espera a que exista el selector de clientes, liga su evento change y sincroniza la UI.
(function ensureClienteSelectListener() {
    const select = document.getElementById('clienteVentaSelect');
    if (!select) {
        setTimeout(ensureClienteSelectListener, 150);
        return;
    }
    if (!select.dataset.ventaListener) {
        select.addEventListener('change', actualizarAvisoCredito);
        select.dataset.ventaListener = '1';
    }
    sincronizarModoVentaUI();
})();

/**
 * Renderiza la tabla de productos disponibles para venta.
 * @param {Array} productos - Lista de productos.
 */
window.renderSalesInventory = function renderSalesInventory(productos) {
    const contenedor = document.getElementById('tablaventasBody');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    const lista = Array.isArray(productos) ? productos : [];
    if (!lista.length) {
        contenedor.innerHTML = '<p class="ventas-empty">No hay productos disponibles.</p>';
        return;
    }

    lista.forEach(p => {
        const card = document.createElement('article');
        card.className = 'venta-card';
        const disponible = Number(p.existencia) || 0;
        const precio = Number(p.precio) || 0;
        const precioTexto = typeof window.formatearMoneda === 'function'
            ? window.formatearMoneda(precio)
            : `C$${precio.toFixed(2)}`;
        const imagen = p.image_url || p.imagen || 'assets/logoinventario360.png';

        card.innerHTML = `
            <div class="venta-card-img-wrapper">
                <img src="${imagen}" alt="${p.nombre}">
            </div>
            <span class="venta-card-title">${p.nombre}</span>
            <div class="venta-card-meta">
                <span class="venta-card-price">${precioTexto}</span>
                <span class="venta-card-stock">Exist. ${disponible}</span>
            </div>
        `;

        card.addEventListener('click', () => addToCanasta(p.id, 1));
        contenedor.appendChild(card);
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
    const totalEl = document.getElementById('canastaTotal');
    if (!body) return;
    body.innerHTML = '';

    let totalGeneral = 0;
    const productos = window._productosCache || [];

    if (!window._canasta.length) {
        body.innerHTML = '<p class="ventas-empty">Tu canasta está vacía.</p>';
        if (totalEl) {
            const totalTexto = typeof window.formatearMoneda === 'function'
                ? window.formatearMoneda(0)
                : 'C$0.00';
            totalEl.textContent = totalTexto;
        }
        return;
    }

    window._canasta.forEach(item => {
        const subtotal = Number(item.precio || 0) * Number(item.cantidad || 0);
        totalGeneral += subtotal;
        const productoRef = productos.find(p => String(p.id) === String(item.id));
        const imagen = productoRef?.image_url || productoRef?.imagen || 'assets/logoinventario360.png';
        const precioTexto = typeof window.formatearMoneda === 'function'
            ? window.formatearMoneda(item.precio || 0)
            : `C$${Number(item.precio || 0).toFixed(2)}`;
        const subtotalTexto = typeof window.formatearMoneda === 'function'
            ? window.formatearMoneda(subtotal)
            : `C$${subtotal.toFixed(2)}`;

        const row = document.createElement('div');
        row.className = 'canasta-item';
        row.innerHTML = `
            <div class="canasta-item-thumb"><img src="${imagen}" alt="${item.nombre}"></div>
            <div class="canasta-item-content">
                <div class="canasta-item-title">${item.nombre}</div>
                <div class="canasta-item-controls">
                    <label>Cantidad</label>
                    <input data-id="${item.id}" class="canasta-cantidad" type="number" min="1" value="${item.cantidad}">
                    <span class="canasta-item-price">${precioTexto}</span>
                    <span class="canasta-item-subtotal">${subtotalTexto}</span>
                </div>
            </div>
            <button class="canasta-remove" data-id="${item.id}" aria-label="Eliminar">×</button>
        `;
        body.appendChild(row);
    });

    if (totalEl) {
        const totalTexto = typeof window.formatearMoneda === 'function'
            ? window.formatearMoneda(totalGeneral)
            : `C$${totalGeneral.toFixed(2)}`;
        totalEl.textContent = totalTexto;
    }

    body.querySelectorAll('.canasta-cantidad').forEach(inp => inp.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        const v = Math.max(1, parseInt(e.target.value, 10) || 1);
        const it = window._canasta.find(i => String(i.id) === String(id));
        if (it) {
            it.cantidad = v;
            renderCanasta();
        }
    }));

    body.querySelectorAll('.canasta-remove').forEach(btn => btn.addEventListener('click', (e) => {
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
    const usuario_id = getUsuarioId();
    if (!usuario_id) return alert('Usuario no identificado. Inicia sesión nuevamente.');
    const clienteSelect = document.getElementById('clienteVentaSelect');
    const clienteId = clienteSelect && clienteSelect.value ? clienteSelect.value : null;
    if (window.modoVentaActual === 'credito' && !clienteId) {
        actualizarAvisoCredito();
        return alert('Selecciona un cliente para registrar una venta a crédito.');
    }

    try {
        for (const item of window._canasta) {
        const res = await fetch('/movimientos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
            tipo: 'venta',
            usuario_id,
            producto_id: item.id,
            cantidad: item.cantidad,
            cliente_id: clienteId || null,
            es_credito: window.modoVentaActual === 'credito' ? 1 : 0
            })
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || `No se pudo registrar la venta de ${item.nombre}`);
        }
        }

        alert('Venta registrada correctamente');
        window._canasta = [];
        renderCanasta();
        seleccionarModoVenta('contado');
        loadProducts();
        loadMovimientos();
        loadMovimientosUI();
        loadStats();
    } catch (err) {
        console.error('Error finalizando venta:', err);
        alert(`No se pudo completar la venta. Verifica los movimientos antes de volver a intentarlo. ${err.message}`);
        loadProducts();
        loadMovimientos();
        loadMovimientosUI();
        loadStats();
    }
};

// Función que despliega el modal para capturar un gasto manual asociado (o no) a un proveedor.
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
            <button type="submit" class="btn btn--primary">Guardar gasto</button>
        </div>
    `, { submitHandler: 'gasto', focusSelector: '#gastoMonto' });
};

// Función que valida el formulario del modal de gasto y crea el movimiento vía API.
window.guardarGasto = async function guardarGasto() {
    const monto = parseFloat(document.getElementById('gastoMonto').value);
    if (!monto || monto <= 0) return alert('El monto es obligatorio');
    const usuario_id = getUsuarioId();
    if (!usuario_id) return alert('Usuario no identificado. Inicia sesión nuevamente.');
    const descripcion = (document.getElementById('gastoDescripcion').value || '').trim() || 'Gasto';
    const proveedor = document.getElementById('gastoProveedor').value || null;

    try {
        const res = await fetch('/movimientos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipo: 'gasto', usuario_id, monto, descripcion, proveedor_id: proveedor || null })
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

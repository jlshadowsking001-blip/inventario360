// ===============================
// Lógica de ventas y canasta
// ===============================

window._canasta = window._canasta || [];
window.modoVentaActual = window.modoVentaActual || 'contado';
window._seleccionVentas = window._seleccionVentas || Object.create(null);
window._ventasMovimientos = window._ventasMovimientos || [];
window._ventasTabActual = window._ventasTabActual || 'venta';

function fechaLocalParaInput() {
    const hoy = new Date();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    return `${hoy.getFullYear()}-${mes}-${dia}`;
}

const fechaVentaInput = document.getElementById('fechaVenta');
if (fechaVentaInput && !fechaVentaInput.value) {
    fechaVentaInput.value = fechaLocalParaInput();
}

const fechaResumenVentasInput = document.getElementById('ventasFechaResumen');
if (fechaResumenVentasInput) {
    fechaResumenVentasInput.value = fechaLocalParaInput();
    fechaResumenVentasInput.addEventListener('change', () => window.cargarResumenVentas());
}

function monedaVenta(valor) {
    const numero = Number(valor) || 0;
    return typeof window.formatearMoneda === 'function'
        ? window.formatearMoneda(numero)
        : `C$${numero.toFixed(2)}`;
}

function setVistaProcesoVentas(vista) {
    const proceso = document.getElementById('ventasProceso');
    const inicio = document.getElementById('ventasInicio');
    if (!proceso || !inicio) return;
    inicio.hidden = true;
    proceso.hidden = false;
    proceso.classList.toggle('is-selector', vista === 'selector');
    proceso.classList.toggle('is-checkout', vista === 'checkout');
}

function actualizarFooterSeleccionVentas() {
    let cantidadTotal = 0;
    let precioTotal = 0;
    const productos = window._productosCache || [];
    Object.entries(window._seleccionVentas).forEach(([id, cantidad]) => {
        const producto = productos.find(item => String(item.id) === String(id));
        if (!producto || cantidad <= 0) return;
        cantidadTotal += cantidad;
        precioTotal += (Number(producto.precio) || 0) * cantidad;
    });

    const cantidadEl = document.getElementById('ventasSeleccionCantidad');
    const totalEl = document.getElementById('ventasSeleccionTotal');
    const boton = document.getElementById('ventasAgregarSeleccion');
    if (cantidadEl) cantidadEl.textContent = String(cantidadTotal);
    if (totalEl) totalEl.textContent = monedaVenta(precioTotal);
    if (boton) boton.disabled = cantidadTotal === 0;
}

function obtenerExistenciaDisponible(producto) {
    const yaEnCanasta = window._canasta.find(item => String(item.id) === String(producto.id));
    return Math.max(0, (Number(producto.existencia) || 0) - (Number(yaEnCanasta?.cantidad) || 0));
}

function cambiarCantidadSeleccionada(id, cambio) {
    const producto = (window._productosCache || []).find(item => String(item.id) === String(id));
    if (!producto) return;
    const actual = Number(window._seleccionVentas[id]) || 0;
    const nueva = Math.max(0, Math.min(obtenerExistenciaDisponible(producto), actual + cambio));
    if (nueva === 0) {
        delete window._seleccionVentas[id];
    } else {
        window._seleccionVentas[id] = nueva;
    }

    const query = String(window._busquedaVentas || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const categoriaId = window._categoriaVentaActiva;
    window.renderSalesInventory((window._productosCache || []).filter(item => {
        const texto = [item.nombre, item.codigo, item.id]
            .filter(value => value != null)
            .join(' ')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
        return (categoriaId == null || String(item.categoria_id) === String(categoriaId)) &&
            (!query || query.split(/\s+/).every(term => texto.includes(term)));
    }));
    actualizarFooterSeleccionVentas();
}

function renderListaResumenVentas(movimientos) {
    const lista = document.getElementById('ventasResumenLista');
    if (!lista) return;
    lista.replaceChildren();

    const esVenta = window._ventasTabActual === 'venta';
    const items = movimientos.filter(movimiento => esVenta
        ? movimiento.tipo === 'venta'
        : ['egreso', 'gasto', 'ajuste'].includes(movimiento.tipo));

    if (!items.length) {
        const empty = document.createElement('div');
        empty.className = 'ventas-overview-empty';
        const icon = document.createElement('span');
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = '▤';
        const message = document.createElement('p');
        message.textContent = `No tienes registros de ${esVenta ? 'ventas' : 'egresos'} en esta fecha.`;
        empty.append(icon, message);
        lista.appendChild(empty);
        return;
    }

    items.forEach(movimiento => {
        const item = document.createElement('article');
        item.className = 'ventas-activity-card';

        const icon = document.createElement('span');
        icon.className = `ventas-activity-icon${esVenta ? ' is-income' : ' is-expense'}`;
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = esVenta ? '↗' : '↙';

        const content = document.createElement('div');
        content.className = 'ventas-activity-content';
        const title = document.createElement('strong');
        title.textContent = movimiento.producto || movimiento.descripcion || (esVenta ? 'Venta de producto' : 'Gasto');
        const details = [];
        if (Number(movimiento.cantidad) > 0) details.push(`${movimiento.cantidad} unidades`);
        if (movimiento.cliente) details.push(movimiento.cliente);
        if (movimiento.proveedor) details.push(movimiento.proveedor);
        const subtitle = document.createElement('small');
        subtitle.textContent = details.join(' · ') || (esVenta ? 'Venta registrada' : 'Egreso registrado');
        content.append(title, subtitle);

        const amount = document.createElement('strong');
        amount.className = `ventas-activity-amount${esVenta ? ' is-income' : ' is-expense'}`;
        amount.textContent = monedaVenta(movimiento.monto);
        item.append(icon, content, amount);
        lista.appendChild(item);
    });
}

window.cargarResumenVentas = async function cargarResumenVentas() {
    const lista = document.getElementById('ventasResumenLista');
    const fecha = document.getElementById('ventasFechaResumen')?.value || fechaLocalParaInput();
    const usuarioId = getUsuarioId();
    if (!usuarioId) {
        if (lista) lista.textContent = 'No se pudo identificar al usuario. Inicia sesión nuevamente.';
        return;
    }

    if (lista) lista.textContent = 'Cargando movimientos…';
    try {
        const query = new URLSearchParams({
            usuario_id: usuarioId,
            fechaBase: fecha,
            rango: 'dia'
        });
        const response = await fetch(`/movimientos?${query.toString()}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'No se pudieron cargar los movimientos');
        if (document.getElementById('ventasFechaResumen')?.value !== fecha) return;

        const movimientos = Array.isArray(data.movimientos) ? data.movimientos : [];
        window._ventasMovimientos = movimientos;
        const ingresos = movimientos
            .filter(movimiento => movimiento.tipo === 'venta')
            .reduce((total, movimiento) => total + (Number(movimiento.monto) || 0), 0);
        const egresos = movimientos
            .filter(movimiento => ['egreso', 'gasto', 'ajuste'].includes(movimiento.tipo))
            .reduce((total, movimiento) => total + (Number(movimiento.monto) || 0), 0);

        document.getElementById('ventasBalanceTotal').textContent = monedaVenta(ingresos - egresos);
        document.getElementById('ventasIngresosTotal').textContent = monedaVenta(ingresos);
        document.getElementById('ventasEgresosTotal').textContent = monedaVenta(egresos);
        renderListaResumenVentas(movimientos);
    } catch (error) {
        console.error('Error cargando resumen de ventas:', error);
        if (lista) {
            lista.replaceChildren();
            const message = document.createElement('p');
            message.className = 'ventas-overview-error';
            message.textContent = `No se pudieron cargar los movimientos. ${error.message}`;
            lista.appendChild(message);
        }
    }
};

window.seleccionarPestanaVentas = function seleccionarPestanaVentas(tipo) {
    window._ventasTabActual = tipo === 'egreso' ? 'egreso' : 'venta';
    document.querySelectorAll('.ventas-overview-tabs [data-tipo]').forEach(button => {
        const active = button.dataset.tipo === window._ventasTabActual;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', String(active));
    });
    renderListaResumenVentas(window._ventasMovimientos);
};

window.mostrarInicioVentas = function mostrarInicioVentas() {
    const proceso = document.getElementById('ventasProceso');
    const inicio = document.getElementById('ventasInicio');
    if (proceso) proceso.hidden = true;
    if (inicio) inicio.hidden = false;
    window.cargarResumenVentas();
};

window.iniciarNuevaVenta = function iniciarNuevaVenta() {
    if (window._canasta.length) {
        setVistaProcesoVentas('checkout');
        window.renderCanasta();
        return;
    }
    window._seleccionVentas = Object.create(null);
    window._categoriaVentaActiva = null;
    window._busquedaVentas = '';
    const buscador = document.getElementById('buscadorVentas');
    if (buscador) buscador.value = '';
    setVistaProcesoVentas('selector');
    window.renderizarCategoriasVentas?.();
    window.filtrarVentasPorTexto?.('');
    actualizarFooterSeleccionVentas();
};

window.volverASeleccionVentas = function volverASeleccionVentas() {
    setVistaProcesoVentas('selector');
    window.renderizarCategoriasVentas?.();
    window.filtrarVentasPorTexto?.(window._busquedaVentas || '');
    actualizarFooterSeleccionVentas();
};

window.confirmarSeleccionVentas = function confirmarSeleccionVentas() {
    const productos = window._productosCache || [];
    const seleccion = Object.entries(window._seleccionVentas)
        .filter(([, cantidad]) => Number(cantidad) > 0);
    if (!seleccion.length) return showToast('Selecciona al menos un producto.', 'info');

    const invalido = seleccion.find(([id, cantidad]) => {
        const producto = productos.find(item => String(item.id) === String(id));
        return !producto || Number(cantidad) > obtenerExistenciaDisponible(producto);
    });
    if (invalido) return showToast('La existencia de un producto cambió. Revisa la selección.', 'error');

    seleccion.forEach(([id, cantidad]) => window.addToCanasta(id, Number(cantidad)));
    window._seleccionVentas = Object.create(null);
    setVistaProcesoVentas('checkout');
    window.renderCanasta();
};

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

    const lista = Array.isArray(productos)
        ? [...productos]
            .filter(producto => Number(producto.existencia) > 0)
            .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', { sensitivity: 'base' }))
        : [];
    if (!lista.length) {
        const mensaje = window._busquedaVentas?.trim()
            ? 'No se encontraron productos.'
            : 'No hay productos con existencias disponibles.';
        const empty = document.createElement('p');
        empty.className = 'ventas-empty';
        empty.textContent = mensaje;
        contenedor.appendChild(empty);
        actualizarFooterSeleccionVentas();
        return;
    }

    lista.forEach(p => {
        const card = document.createElement('article');
        card.className = 'venta-card';
        const disponible = Number(p.existencia) || 0;
        const cantidadSeleccionada = Number(window._seleccionVentas[p.id]) || 0;
        const maxSeleccionable = obtenerExistenciaDisponible(p);
        const imageWrapper = document.createElement('div');
        imageWrapper.className = 'venta-card-img-wrapper';
        const image = document.createElement('img');
        image.src = p.image_url || p.imagen || 'assets/logoinventario360.png';
        image.alt = p.nombre || 'Producto';
        imageWrapper.appendChild(image);

        const info = document.createElement('div');
        info.className = 'venta-card-info';
        const title = document.createElement('span');
        title.className = 'venta-card-title';
        title.textContent = p.nombre || 'Producto sin nombre';
        const stock = document.createElement('span');
        stock.className = 'venta-card-stock';
        stock.textContent = `${disponible} disponibles`;
        const price = document.createElement('strong');
        price.className = 'venta-card-price';
        price.textContent = monedaVenta(p.precio);
        info.append(title, stock, price);

        const quantity = document.createElement('div');
        quantity.className = 'venta-card-quantity';
        quantity.setAttribute('aria-label', `Cantidad de ${p.nombre || 'producto'}`);
        const minus = document.createElement('button');
        minus.type = 'button';
        minus.textContent = '−';
        minus.setAttribute('aria-label', `Quitar una unidad de ${p.nombre || 'producto'}`);
        minus.disabled = cantidadSeleccionada === 0;
        minus.addEventListener('click', () => cambiarCantidadSeleccionada(p.id, -1));
        const value = document.createElement('span');
        value.textContent = String(cantidadSeleccionada);
        const plus = document.createElement('button');
        plus.type = 'button';
        plus.textContent = '+';
        plus.setAttribute('aria-label', `Agregar una unidad de ${p.nombre || 'producto'}`);
        plus.disabled = cantidadSeleccionada >= maxSeleccionable;
        plus.addEventListener('click', () => cambiarCantidadSeleccionada(p.id, 1));
        quantity.append(minus, value, plus);

        card.classList.toggle('is-selected', cantidadSeleccionada > 0);
        card.append(imageWrapper, info, quantity);
        contenedor.appendChild(card);
    });
    actualizarFooterSeleccionVentas();
};

/**
 * Agrega un producto a la canasta o incrementa su cantidad si ya existe.
 * @param {string} id - ID del producto.
 * @param {number} cantidad - Cantidad a agregar.
 */
window.addToCanasta = function addToCanasta(id, cantidad) {
    const prod = (window._productosCache || []).find(x => String(x.id) === String(id));
    if (!prod) return showToast('Producto no encontrado', 'error');
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
 * Vacía la canasta sin registrar venta.
 */
window.vaciarcanasta = function vaciarcanasta() {
    if (!window._canasta.length) return;
    window._canasta = [];
    renderCanasta();
    window.showToast('La canasta se vació correctamente', 'success');
};

/**
 * Finaliza la venta actual y registra los movimientos en el servidor.
 */
window.terminarventa = async function terminarventa() {
    if (!window._canasta?.length) return showToast('Canasta vacía', 'info');
    const usuario_id = getUsuarioId();
    if (!usuario_id) return showToast('Usuario no identificado. Inicia sesión nuevamente.', 'error');
    const clienteSelect = document.getElementById('clienteVentaSelect');
    const clienteId = clienteSelect && clienteSelect.value ? clienteSelect.value : null;
    if (window.modoVentaActual === 'credito' && !clienteId) {
        actualizarAvisoCredito();
        return showToast('Selecciona un cliente para registrar una venta a crédito.', 'error');
    }
    const fecha = document.getElementById('fechaVenta')?.value;
    if (!fecha) return showToast('Selecciona la fecha de la venta.', 'error');

    try {
        for (const item of window._canasta) {
        const res = await fetch('/movimientos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
            tipo: 'venta',
            usuario_id,
            fecha,
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

        showToast('Venta registrada correctamente', 'success');
        window._canasta = [];
        renderCanasta();
        const fechaInput = document.getElementById('fechaVenta');
        if (fechaInput) fechaInput.value = fechaLocalParaInput();
        seleccionarModoVenta('contado');
        window.mostrarInicioVentas();
        loadProducts();
        loadMovimientos();
        loadMovimientosUI();
        loadStats();
    } catch (err) {
        console.error('Error finalizando venta:', err);
        showToast(`No se pudo completar la venta. Verifica los movimientos antes de volver a intentarlo. ${err.message}`, 'error', 6000);
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
        <label for="gastoFecha">Fecha del gasto</label>
        <input id="gastoFecha" type="date" value="${fechaLocalParaInput()}" required>
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
    if (!monto || monto <= 0) return showToast('El monto es obligatorio', 'error');
    const usuario_id = getUsuarioId();
    if (!usuario_id) return showToast('Usuario no identificado. Inicia sesión nuevamente.', 'error');
    const descripcion = (document.getElementById('gastoDescripcion').value || '').trim() || 'Gasto';
    const proveedor = document.getElementById('gastoProveedor').value || null;
    const fecha = document.getElementById('gastoFecha').value;
    if (!fecha) return showToast('Selecciona la fecha del gasto.', 'error');

    try {
        const res = await fetch('/movimientos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipo: 'gasto', usuario_id, fecha, monto, descripcion, proveedor_id: proveedor || null })
        });
        const data = await res.json();
        if (!res.ok) return showToast(data.error || 'No se pudo registrar el gasto', 'error');
        showToast('Gasto registrado', 'success');
        cerrarModal();
        loadMovimientos();
        loadMovimientosUI();
        window.cargarResumenVentas();
    } catch (err) {
        console.error('Error guardando gasto:', err);
        showToast('Error guardando gasto', 'error');
    }
};

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
        tr.innerHTML = `
        <td>${p.id}</td>
        <td>${p.nombre}</td>
        <td>${p.updated_at ? new Date(p.updated_at * 1000).toLocaleDateString() : (p.created_at ? new Date(p.created_at * 1000).toLocaleDateString() : '—')}</td>
        <td><input data-id="${p.id}" class="venta-cantidad" type="number" value="1" style="width:70px"></td>
        <td>${p.precio || 0}</td>
        <td>${p.costo != null ? ('$' + Number(p.costo).toFixed(2)) : '—'}</td>
        <td><button class="btn-add-to-canasta" data-id="${p.id}">Agregar</button></td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.btn-add-to-canasta').forEach(btn => btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        const input = tbody.querySelector(`input.venta-cantidad[data-id="${id}"]`);
        const cantidad = input ? parseInt(input.value) || 1 : 1;
        addToCanasta(id, cantidad);
    }));
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

    try {
        for (const item of window._canasta) {
        const res = await fetch('/movimientos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
            tipo: 'venta',
            producto_id: item.id,
            cantidad: item.cantidad
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
        loadStats();
    } catch (err) {
        console.error('Error finalizando venta:', err);
        alert('Error al registrar la venta');
    }
};

// ===============================
// CRUD de Proveedores
// ===============================

window._proveedoresCache = window._proveedoresCache || [];

/**
 * Carga la lista de proveedores desde el servidor y la renderiza en la tabla.
 */
window.loadProveedores = async function loadProveedores() {
    try {
        const res = await fetch('/proveedores');
        const data = await res.json();
        if (!res.ok) return console.error('Error cargando proveedores', data);
        window._proveedoresCache = data.proveedores || [];
        renderProveedoresTable(window._proveedoresCache);
        window.actualizarResumenProveedores && window.actualizarResumenProveedores(data.resumen || {});
    } catch (err) {
        console.error('Error cargando proveedores:', err);
    }
};

window.actualizarResumenProveedores = function actualizarResumenProveedores(resumen = {}) {
    const totalProvEl = document.getElementById('totalProveedoresResumen');
    const totalPagarEl = document.getElementById('totalPorPagarResumen');
    if (totalProvEl) totalProvEl.textContent = resumen.totalProveedores != null ? resumen.totalProveedores : (window._proveedoresCache?.length || 0);
    if (totalPagarEl) {
        const monto = Number(resumen.totalPorPagar || 0);
        const formatted = typeof window.formatearMoneda === 'function' ? window.formatearMoneda(monto) : `C$${monto.toFixed(2)}`;
        totalPagarEl.textContent = formatted;
    }
};

/**
 * Renderiza la tabla editable de proveedores con campos contenteditable y botones de eliminar.
 * @param {Array} items - Lista de proveedores.
 */
window.renderProveedoresTable = function renderProveedoresTable(items) {
    const cont = document.getElementById('listaProveedores');
    if (!cont) return;

    cont.innerHTML = '';
    const table = document.createElement('table');
    table.className = 'tabla-proveedores';
    table.innerHTML = `<thead><tr><th>ID</th><th>Nombre</th><th>Contacto</th><th>Teléfono</th><th>Email</th><th>Pendiente</th><th>Acciones</th></tr></thead>`;
    const tbody = document.createElement('tbody');

    items.forEach(p => {
        const tr = document.createElement('tr');
        const saldo = Number(p.total_por_pagar) || 0;
        const saldoTexto = typeof window.formatearMoneda === 'function' ? window.formatearMoneda(saldo) : `C$${saldo.toFixed(2)}`;
        tr.innerHTML = `
        <td>${p.id}</td>
        <td contenteditable="true" data-field="nombre" data-id="${p.id}">${p.nombre || ''}</td>
        <td contenteditable="true" data-field="contacto" data-id="${p.id}">${p.contacto || ''}</td>
        <td contenteditable="true" data-field="telefono" data-id="${p.id}">${p.telefono || ''}</td>
        <td contenteditable="true" data-field="email" data-id="${p.id}">${p.email || ''}</td>
        <td>${saldoTexto}</td>
        <td><button data-id="${p.id}" class="btn-delete-proveedor">Eliminar</button></td>
        `;
        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    cont.appendChild(table);

    // Guardar cambios al salir del campo editable
    table.querySelectorAll('td[contenteditable="true"]').forEach(td => {
        td.addEventListener('blur', async (e) => {
        const id = e.target.dataset.id;
        const field = e.target.dataset.field;
        const value = e.target.textContent.trim();
        try {
            await fetch('/proveedores/' + encodeURIComponent(id), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [field]: value })
            });
        } catch (err) {
            console.error('Error actualizando proveedor:', err);
        }
        });
    });

    // Eliminar proveedor
    table.querySelectorAll('.btn-delete-proveedor').forEach(b => b.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (!confirm('Eliminar proveedor?')) return;
        try {
        await fetch('/proveedores/' + encodeURIComponent(id), { method: 'DELETE' });
        loadProveedores();
        } catch (err) {
        console.error(err);
        }
    }));
};

/**
 * Agrega un nuevo proveedor con el nombre ingresado en el input.
 */
window.agregarProveedor = async function agregarProveedor() {
    const nombre = document.getElementById('nuevoProveedor').value.trim();
    if (!nombre) return alert('Nombre requerido');
    try {
        const res = await fetch('/proveedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre })
        });
        const data = await res.json();
        if (!res.ok) return alert(data.error || 'Error creando proveedor');
        document.getElementById('nuevoProveedor').value = '';
        loadProveedores();
    } catch (err) {
        console.error('Error creando proveedor:', err);
        alert('Error creando proveedor');
    }
};

// Guardar proveedor desde modal con campos: nombre, telefono, direccion, correo
window.guardarProveedor = async function guardarProveedor() {
    const nombre = (document.getElementById('nombreProveedor') || {}).value || '';
    const telefono = (document.getElementById('telefonoProveedor') || {}).value || '';
    const direccion = (document.getElementById('direccionProveedor') || {}).value || '';
    const correo = (document.getElementById('correoProveedor') || {}).value || '';

    if (!nombre.trim()) return alert('Nombre es obligatorio');

    try {
        const res = await fetch('/proveedores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre: nombre.trim(), contacto: direccion.trim() || null, telefono: telefono.trim(), email: correo.trim() })
        });
        const data = await res.json();
        if (!res.ok) return alert(data.error || 'Error creando proveedor');
        alert(`Proveedor "${data.proveedor?.nombre || nombre}" creado`);
        if (typeof window.loadProveedores === 'function') await window.loadProveedores();
        if (typeof window.cerrarModal === 'function') window.cerrarModal();
    } catch (err) {
        console.error('Error creando proveedor:', err);
        alert('Error creando proveedor');
    }
};

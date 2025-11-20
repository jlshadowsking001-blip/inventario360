// ===============================
// CRUD de Clientes
// ===============================

window._clientesCache = window._clientesCache || [];

/**
 * Obtiene la lista de clientes desde el backend y la pinta en el módulo.
 */
window.loadClientes = async function loadClientes() {
    try {
        const res = await fetch('/clientes');
        const data = await res.json();
        if (!res.ok) {
            console.error('Error cargando clientes', data);
            return;
        }
        window._clientesCache = data.clientes || [];
        renderClientesList(window._clientesCache);
        window.actualizarResumenClientes && window.actualizarResumenClientes(data.resumen || {});
        refrescarSelectorClientes();
    } catch (err) {
        console.error('Error cargando clientes:', err);
    }
};

window.actualizarResumenClientes = function actualizarResumenClientes(resumen = {}) {
    const totalClientesEl = document.getElementById('totalClientesResumen');
    const totalCobrarEl = document.getElementById('totalPorCobrarResumen');
    if (totalClientesEl) totalClientesEl.textContent = resumen.totalClientes != null ? resumen.totalClientes : (window._clientesCache?.length || 0);
    if (totalCobrarEl) {
        const monto = Number(resumen.totalPorCobrar || 0);
        const formatted = typeof window.formatearMoneda === 'function' ? window.formatearMoneda(monto) : `C$${monto.toFixed(2)}`;
        totalCobrarEl.textContent = formatted;
    }
};

/**
 * Renderiza la lista simple de clientes con acciones para editar y eliminar.
 * @param {Array} clientes - Colección recibida desde la API.
 */
window.renderClientesList = function renderClientesList(clientes) {
    const cont = document.getElementById('listaClientes');
    if (!cont) return;

    cont.innerHTML = '';
    const table = document.createElement('table');
    table.className = 'tabla-clientes';
    table.innerHTML = `
        <thead>
            <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Teléfono</th>
                <th>Email</th>
                <th>Dirección</th>
                <th>Por cobrar</th>
                <th>Acciones</th>
            </tr>
        </thead>
    `;

    const tbody = document.createElement('tbody');

    if (!clientes.length) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="7">Sin clientes registrados</td>';
        tbody.appendChild(tr);
    } else {
        clientes.forEach(cliente => {
            const tr = document.createElement('tr');
            const saldo = Number(cliente.total_credito) || 0;
            const saldoTexto = typeof window.formatearMoneda === 'function'
                ? window.formatearMoneda(saldo)
                : `C$${saldo.toFixed(2)}`;
            tr.innerHTML = `
                <td>${cliente.id}</td>
                <td>${cliente.nombre || '—'}</td>
                <td>${cliente.telefono || '—'}</td>
                <td>${cliente.email || '—'}</td>
                <td>${cliente.direccion || '—'}</td>
                <td>${saldoTexto}</td>
                <td>
                    <button data-id="${cliente.id}" class="btn-editar-cliente">Editar</button>
                    <button data-id="${cliente.id}" class="btn-eliminar-cliente">Eliminar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    table.appendChild(tbody);
    cont.appendChild(table);

    cont.querySelectorAll('.btn-editar-cliente').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = Number(e.target.dataset.id);
            const cliente = clientes.find(c => Number(c.id) === id);
            if (cliente) editarCliente(cliente);
        });
    });

    cont.querySelectorAll('.btn-eliminar-cliente').forEach(btn => {
        btn.addEventListener('click', (e) => eliminarCliente(e.target.dataset.id));
    });
};

/**
 * Agrega un cliente usando el campo rápido del módulo.
 */
window.agregarCliente = async function agregarCliente() {
    const input = document.getElementById('nuevoCliente');
    if (!input) return;
    const nombre = input.value.trim();
    if (!nombre) return alert('Nombre requerido');

    try {
        const res = await fetch('/clientes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre })
        });
        const data = await res.json();
        if (!res.ok) return alert(data.error || 'Error creando cliente');
        input.value = '';
        loadClientes();
    } catch (err) {
        console.error('Error creando cliente:', err);
        alert('Error creando cliente');
    }
};

/**
 * Guarda un cliente desde el modal detallado.
 */
window.guardarCliente = async function guardarCliente() {
    const nombre = (document.getElementById('nombreCliente') || {}).value || '';
    const telefono = (document.getElementById('telefonoCliente') || {}).value || '';
    const direccion = (document.getElementById('direccionCliente') || {}).value || '';
    const correo = (document.getElementById('correoCliente') || {}).value || '';

    if (!nombre.trim()) return alert('Nombre es obligatorio');

    try {
        const res = await fetch('/clientes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre: nombre.trim(), telefono: telefono.trim(), direccion: direccion.trim(), email: correo.trim() })
        });
        const data = await res.json();
        if (!res.ok) return alert(data.error || 'Error creando cliente');
        alert(`Cliente "${data.cliente?.nombre || nombre}" creado`);
        await loadClientes();
        if (typeof window.cerrarModal === 'function') window.cerrarModal();
    } catch (err) {
        console.error('Error creando cliente:', err);
        alert('Error creando cliente');
    }
};

async function editarCliente(cliente) {
    const nuevoNombre = prompt('Nombre', cliente.nombre || '') || '';
    if (!nuevoNombre.trim()) return alert('Nombre es obligatorio');
    const nuevoTelefono = prompt('Teléfono', cliente.telefono || '') || '';
    const nuevoEmail = prompt('Email', cliente.email || '') || '';
    const nuevaDireccion = prompt('Dirección', cliente.direccion || '') || '';

    try {
        await fetch('/clientes/' + encodeURIComponent(cliente.id), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre: nuevoNombre.trim(), telefono: nuevoTelefono.trim(), email: nuevoEmail.trim(), direccion: nuevaDireccion.trim() })
        });
        loadClientes();
    } catch (err) {
        console.error('Error actualizando cliente:', err);
        alert('Error actualizando cliente');
    }
}

async function eliminarCliente(id) {
    if (!confirm('¿Eliminar cliente?')) return;
    try {
        const res = await fetch('/clientes/' + encodeURIComponent(id), { method: 'DELETE' });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            alert(data.error || 'No se pudo eliminar');
        }
        loadClientes();
    } catch (err) {
        console.error('Error eliminando cliente:', err);
        alert('Error eliminando cliente');
    }
}

function refrescarSelectorClientes() {
    const select = document.getElementById('clienteVentaSelect');
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">Sin cliente</option>';
    (window._clientesCache || []).forEach(cliente => {
        const opt = document.createElement('option');
        opt.value = cliente.id;
        opt.textContent = cliente.nombre;
        select.appendChild(opt);
    });
    if (current && select.querySelector(`option[value="${current}"]`)) {
        select.value = current;
    }
}
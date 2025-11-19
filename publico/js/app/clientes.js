// ===============================
// CRUD de Clientes
// ===============================

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
        renderClientesList(data.clientes || []);
    } catch (err) {
        console.error('Error cargando clientes:', err);
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
    if (!clientes.length) {
        const empty = document.createElement('li');
        empty.textContent = 'Sin clientes registrados';
        cont.appendChild(empty);
        return;
    }

    clientes.forEach(cliente => {
        const li = document.createElement('li');
        li.className = 'cliente-item';
        const datosContacto = [cliente.telefono, cliente.email].filter(Boolean).join(' · ');
        li.innerHTML = `
        <div class="cliente-info">
            <strong>${cliente.nombre || '—'}</strong>
            <small>${datosContacto || 'Sin contacto'}</small>
        </div>`;

        const acciones = document.createElement('div');
        acciones.className = 'cliente-acciones';

        const editarBtn = document.createElement('button');
        editarBtn.textContent = 'Editar';
        editarBtn.addEventListener('click', () => editarCliente(cliente));

        const eliminarBtn = document.createElement('button');
        eliminarBtn.textContent = 'Eliminar';
        eliminarBtn.addEventListener('click', () => eliminarCliente(cliente.id));

        acciones.appendChild(editarBtn);
        acciones.appendChild(eliminarBtn);
        li.appendChild(acciones);
        cont.appendChild(li);
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
// ===============================
// INVENTARIO360 - Flujo principal
// ===============================

// --- Navegación entre módulos ---
window.mostrarModulo = function(nombreModulo) {
    // Ocultar todos los módulos
    document.querySelectorAll('.modulo').forEach(sec => {
        sec.style.display = 'none';
        sec.classList.remove('activo');
    });

  // Mostrar el módulo seleccionado
    const target = document.getElementById(nombreModulo);
    if (target) {
        target.style.display = 'block';
        target.classList.add('activo');

        // Actualizar título en la barra superior
        const titulo = document.getElementById('topbarTitulo');
        if (titulo) titulo.textContent = nombreModulo;
    }
};

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    mostrarModulo('inventario');
});

// Normalizar y encapsular handlers definidos con atributo `onclick`
// Esto evita que errores en ejecución de un handler rompan otros scripts.
function normalizeInlineOnclicks(){
    try{
        const els = Array.from(document.querySelectorAll('[onclick]'));
        els.forEach(el => {
            const code = el.getAttribute('onclick');
            if (!code) return;
            // Remover atributo inline y reemplazar por listener controlado
            el.removeAttribute('onclick');
            el.addEventListener('click', function(evt){
                try{
                    // Ejecutar el código original en contexto del elemento
                    // Usamos Function para replicar comportamiento inline, pero protegido
                    const fn = new Function(code);
                    return fn.call(this, evt);
                } catch(err){
                    console.error('Error ejecutando onclick:', code, err);
                    // Mostrar aviso ligero al usuario pero sin romper la app
                    // (descomenta alert si quieres notificar directamente)
                    // alert('Error interno al ejecutar acción');
                }
            });
        });
    } catch(e){ console.error('normalizeInlineOnclicks error', e); }
}

// Ejecutar normalización también al cargar DOM y cuando se abra el modal
document.addEventListener('DOMContentLoaded', () => normalizeInlineOnclicks());

// --- Acciones internas del inventario ---
window.crearProducto = function() {
    // Contenido del modal para crear producto
    abrirModal('Crear Producto', `
        <div class="modal-form-row"><div class="col"><label>Producto:</label><input id="producto" name="nombre" type="text" required></div><div class="col"><label>Categoría:</label><select id="categoria" name="categoria"><option value="">Sin categoría</option></select></div></div>
        <div class="modal-form-row"><div class="col"><label>Cantidad:</label><input id="cantidad" name="cantidad" type="number" value="0"></div><div class="col"><label>Precio:</label><input id="precio" name="precio" type="number" step="0.01" value="0"></div></div>
        <div class="modal-form-row"><div class="col"><label>Costo:</label><input id="costo" name="costo" type="number" step="0.01" value="0"></div></div>
        <div class="modal-form-row"><div class="col"><label>Imagen (opcional):</label><input id="imagenProducto" name="imagenProducto" type="file" accept="image/*"></div></div>
        <div style="text-align:right; margin-top:10px;"><button type="submit" class="btn-action primary">Guardar Producto</button></div>
    `, { submitHandler: 'producto' });
    // Cargar opciones de categorías dentro del select del modal
    setTimeout(() => { try { window.cargarCategorias(); const sel = document.getElementById('categoria'); if (sel) { sel.innerHTML = '<option value="">Sin categoría</option>'; window.categorias.forEach(c=> { const opt = document.createElement('option'); opt.value = c.id; opt.textContent = c.nombre; sel.appendChild(opt); }); } } catch(e){} }, 50);
};

window.crearCategorias = function() {
    abrirModal('Crear Categoría', `
        <label>Nombre de categoría:</label>
        <input id="nombreCategoria" name="nombre" type="text" required>
        <div style="text-align:right; margin-top:10px;"><button type="submit" class="btn-action">Guardar Categoría</button></div>
    `, { submitHandler: 'categoria' });
};

window.verCategorias = function() {
    abrirModal('Categorías', `
        <ul id="listaCategorias">
        <!-- Aquí se llenará dinámicamente -->
        </ul>
    `);
};

window.crearCliente = function() {
    abrirModal('Crear Cliente', `
        <div class="modal-form-row"><div class="col"><label>Nombre:</label><input id="nombreCliente" name="nombre" type="text" required></div></div>
        <div class="modal-form-row"><div class="col"><label>Teléfono:</label><input id="telefonoCliente" name="telefono" type="text" required></div></div>
        <div class="modal-form-row"><div class="col"><label>Dirección:</label><input id="direccionCliente" name="direccion" type="text"></div></div>
        <div class="modal-form-row"><div class="col"><label>Correo:</label><input id="correoCliente" name="correo" type="email"></div></div>
        <div style="text-align:right; margin-top:10px;"><button type="submit" class="btn-action">Guardar Cliente</button></div>
    `, { submitHandler: 'cliente' });
};

window.crearProveedor = function() {
    abrirModal('Crear Proveedor', `
        <div class="modal-form-row"><div class="col"><label>Nombre:</label><input id="nombreProveedor" name="nombre" type="text" required></div></div>
        <div class="modal-form-row"><div class="col"><label>Teléfono:</label><input id="telefonoProveedor" name="telefono" type="text" required></div></div>
        <div class="modal-form-row"><div class="col"><label>Dirección:</label><input id="direccionProveedor" name="direccion" type="text"></div></div>
        <div class="modal-form-row"><div class="col"><label>Correo:</label><input id="correoProveedor" name="correo" type="email"></div></div>
        <div style="text-align:right; margin-top:10px;"><button type="submit" class="btn-action">Guardar Proveedor</button></div>
    `, { submitHandler: 'proveedor' });
};

const MODAL_HANDLERS = {
    producto: () => window.guardarProducto && window.guardarProducto(),
    categoria: () => window.guardarCategoria && window.guardarCategoria(),
    cliente: () => window.guardarCliente && window.guardarCliente(),
    proveedor: () => window.guardarProveedor && window.guardarProveedor(),
    'producto-editar': () => window.actualizarProductoModal && window.actualizarProductoModal()
};

document.addEventListener('submit', async (e) => {
    const form = e.target;
    if (!form || form.id !== 'modal-form') return;

    e.preventDefault();
    const handlerKey = form.dataset.submitHandler;
    const handler = handlerKey ? MODAL_HANDLERS[handlerKey] : null;
    if (typeof handler !== 'function') return;
    try {
        await handler();
    } catch (err) {
        console.error('Error procesando formulario modal:', err);
        alert('Error procesando formulario');
    }
});
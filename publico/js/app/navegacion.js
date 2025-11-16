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

// --- Manejo de modal genérico ---
window.abrirModal = function(titulo, contenidoHTML) {
    const modal = document.getElementById('modal');
    const modalTitulo = document.getElementById('modal-titulo');
    const modalForm = document.getElementById('modal-form');
    if (modal && modalTitulo && modalForm) {
        modal.style.display = 'block';
        modalTitulo.textContent = titulo;
        modalForm.innerHTML = contenidoHTML;
        document.body.style.overflow = 'hidden'; // bloquear scroll
    }
};

window.cerrarModal = function() {
    const modal = document.getElementById('modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = ''; // restaurar scroll
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
        <form id="modal-form-producto">
            <div class="modal-form-row"><div class="col"><label>Producto:</label><input id="producto" name="nombre" type="text" required></div><div class="col"><label>Categoría:</label><select id="categoria" name="categoria"></select></div></div>
            <div class="modal-form-row"><div class="col"><label>Cantidad:</label><input id="cantidad" name="cantidad" type="number" value="0"></div><div class="col"><label>Precio:</label><input id="precio" name="precio" type="number" step="0.01" value="0"></div></div>
            <div class="modal-form-row"><div class="col"><label>Costo:</label><input id="costo" name="costo" type="number" step="0.01" value="0"></div></div>
            <div class="modal-form-row"><div class="col"><label>Imagen (opcional):</label><input id="imagenProducto" name="imagenProducto" type="file" accept="image/*"></div></div>
            <div style="text-align:right; margin-top:10px;"><button type="submit" class="btn-action primary">Guardar Producto</button></div>
        </form>
    `);
    // Cargar opciones de categorías dentro del select del modal
    setTimeout(() => { try { window.cargarCategorias(); const sel = document.getElementById('categoria'); if (sel) { sel.innerHTML = ''; window.categorias.forEach(c=> { const opt = document.createElement('option'); opt.value = c.id; opt.textContent = c.nombre; sel.appendChild(opt); }); } } catch(e){} }, 50);
};

window.crearCategorias = function() {
    abrirModal('Crear Categoría', `
        <form id="modal-form-categoria">
            <label>Nombre de categoría:</label>
            <input id="nombreCategoria" name="nombre" type="text" required>
            <div style="text-align:right; margin-top:10px;"><button type="submit" class="btn-action">Guardar Categoría</button></div>
        </form>
    `);
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
        <form id="modal-form-cliente">
            <div class="modal-form-row"><div class="col"><label>Nombre:</label><input id="nombreCliente" name="nombre" type="text" required></div></div>
            <div class="modal-form-row"><div class="col"><label>Teléfono:</label><input id="telefonoCliente" name="telefono" type="text" required></div></div>
            <div class="modal-form-row"><div class="col"><label>Dirección:</label><input id="direccionCliente" name="direccion" type="text"></div></div>
            <div class="modal-form-row"><div class="col"><label>Correo:</label><input id="correoCliente" name="correo" type="email"></div></div>
            <div style="text-align:right; margin-top:10px;"><button type="submit" class="btn-action">Guardar Cliente</button></div>
        </form>
    `);
};

window.crearProveedor = function() {
    abrirModal('Crear Proveedor', `
        <form id="modal-form-proveedor">
            <div class="modal-form-row"><div class="col"><label>Nombre:</label><input id="nombreProveedor" name="nombre" type="text" required></div></div>
            <div class="modal-form-row"><div class="col"><label>Teléfono:</label><input id="telefonoProveedor" name="telefono" type="text" required></div></div>
            <div class="modal-form-row"><div class="col"><label>Dirección:</label><input id="direccionProveedor" name="direccion" type="text"></div></div>
            <div class="modal-form-row"><div class="col"><label>Correo:</label><input id="correoProveedor" name="correo" type="email"></div></div>
            <div style="text-align:right; margin-top:10px;"><button type="submit" class="btn-action">Guardar Proveedor</button></div>
        </form>
    `);
};

// Manejo centralizado del envío de formularios dentro del modal
document.addEventListener('submit', async function(e) {
    // Solo manejar formularios que estén dentro del modal
    const modal = document.getElementById('modal');
    if (!modal) return;
    const form = e.target;
    if (!modal.contains(form)) return;

    e.preventDefault();
    try {
        if (form.id === 'modal-form-producto') {
            // Llamar a la función existente que guarda productos (usa ids en el DOM)
            await window.guardarProducto();
            return;
        }
        if (form.id === 'modal-form-categoria') {
            // Llamar a la función existente que guarda categorías
            await window.guardarCategoria();
            return;
        }
        if (form.id === 'modal-form-cliente') {
            await window.guardarCliente();
            return;
        }
        if (form.id === 'modal-form-proveedor') {
            await window.guardarProveedor();
            return;
        }
    } catch (err) {
        console.error('Error procesando formulario modal:', err);
        alert('Error procesando formulario');
    }
});
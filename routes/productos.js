const express = require('express');
const router = express.Router();
const db = require('../db');
const { parseImageDataUrl } = require('../servicios/imagenes');
const { leerProductosExcel } = require('../servicios/importadorInventarioExcel');

async function bloquearInventarioUsuario(conexion, usuario_id) {
  const [usuarios] = await conexion.execute(
    'SELECT id FROM usuarios WHERE id = ? FOR UPDATE',
    [usuario_id]
  );
  return usuarios.length > 0;
}

async function buscarProductoConNombre(conexion, usuario_id, nombre, excluir_id = null) {
  const parametros = [usuario_id, nombre];
  let sql = 'SELECT id FROM productos WHERE usuario_id = ? AND LOWER(nombre) COLLATE utf8mb4_unicode_ci = LOWER(?) COLLATE utf8mb4_unicode_ci';
  if (excluir_id !== null) {
    sql += ' AND id <> ?';
    parametros.push(excluir_id);
  }
  sql += ' ORDER BY id LIMIT 1';
  const [productos] = await conexion.execute(sql, parametros);
  return productos[0] || null;
}

async function nombresIguales(conexion, nombreActual, nombreNuevo) {
  const [filas] = await conexion.execute(
    'SELECT LOWER(?) COLLATE utf8mb4_unicode_ci = LOWER(?) COLLATE utf8mb4_unicode_ci AS iguales',
    [nombreActual, nombreNuevo]
  );
  return Boolean(filas[0]?.iguales);
}

const productWithImageUrl = (row, usuario_id) => {
  const { image_data, image_mime, ...producto } = row;
  if (image_mime) {
    const imageVersion = row.updated_at || row.created_at || 0;
    producto.image_url = `/productos/${row.id}/imagen?usuario_id=${encodeURIComponent(usuario_id)}&v=${imageVersion}`;
  }
  return producto;
};

// Devuelve todos los productos junto con la categoría asociada
router.get('/', (req, res)=>{
  const usuario_id = req.body.usuario_id || req.query.usuario_id;
  if (!usuario_id) return res.status(400).json({ error: 'usuario_id requerido' });
  db.all(
    `SELECT p.id, p.nombre, p.codigo, p.descripcion, p.precio, p.costo, p.existencia, p.categoria_id, p.image_url, p.image_mime, p.created_at, p.updated_at, c.nombre as categoria
      FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id AND c.usuario_id = ?
      WHERE p.usuario_id = ?`,
    [usuario_id, usuario_id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Error leyendo productos' });
      res.json({ productos: rows.map(row => productWithImageUrl(row, usuario_id)) });
    }
  );
});

router.get('/:id/imagen', (req, res) => {
  const { id } = req.params;
  const usuario_id = req.query.usuario_id;
  if (!usuario_id) return res.status(400).json({ error: 'usuario_id requerido' });

  db.get(
    'SELECT image_data, image_mime FROM productos WHERE id = ? AND usuario_id = ?',
    [id, usuario_id],
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Error leyendo imagen del producto' });
      if (!row || !row.image_data || !row.image_mime) return res.status(404).json({ error: 'Imagen no encontrada' });
      res.set('Cache-Control', 'private, no-store');
      res.type(row.image_mime).send(row.image_data);
    }
  );
});

const recibirArchivoExcel = express.raw({ type: 'application/octet-stream', limit: '10mb' });
router.post('/importar', (req, res, next) => {
  recibirArchivoExcel(req, res, err => {
    if (err) {
      const limiteExcedido = err.status === 413;
      return res.status(limiteExcedido ? 413 : 400).json({
        error: limiteExcedido ? 'El archivo Excel no puede superar los 10 MB' : 'No se pudo leer el archivo Excel'
      });
    }
    next();
  });
}, async (req, res) => {
  const usuario_id = req.query.usuario_id || req.get('x-usuario-id');
  if (!usuario_id) return res.status(400).json({ error: 'usuario_id requerido' });
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({ error: 'Selecciona un archivo Excel válido' });
  }

  let importacion;
  try {
    importacion = await leerProductosExcel(req.body);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'No se pudo leer el archivo Excel' });
  }

  if (!importacion.productos.length) {
    return res.json({
      creados: 0,
      actualizados: 0,
      omitidos: importacion.sinExistencia + importacion.erroresTotal,
      sinExistencia: importacion.sinExistencia,
      erroresTotal: importacion.erroresTotal,
      errores: importacion.errores.slice(0, 20)
    });
  }

  let conexion;
  let transaccionIniciada = false;
  try {
    conexion = await db._pool.getConnection();
    await conexion.beginTransaction();
    transaccionIniciada = true;
    if (!await bloquearInventarioUsuario(conexion, usuario_id)) {
      await conexion.rollback();
      transaccionIniciada = false;
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const categoriasPorNombre = new Map();
    const productosExistentes = new Map();
    let creados = 0;
    let actualizados = 0;

    for (const producto of importacion.productos) {
      let categoria_id = producto.categoria === undefined ? undefined : null;
      if (producto.categoria) {
        const claveCategoria = producto.categoria.toLocaleLowerCase('es');
        if (categoriasPorNombre.has(claveCategoria)) {
          categoria_id = categoriasPorNombre.get(claveCategoria);
        } else {
          const [categorias] = await conexion.execute(
            'SELECT id FROM categorias WHERE usuario_id = ? AND LOWER(nombre) = LOWER(?) LIMIT 1',
            [usuario_id, producto.categoria]
          );
          if (categorias.length) {
            categoria_id = categorias[0].id;
          } else {
            const [resultado] = await conexion.execute(
              'INSERT INTO categorias (nombre, usuario_id) VALUES (?, ?)',
              [producto.categoria, usuario_id]
            );
            categoria_id = resultado.insertId;
          }
          categoriasPorNombre.set(claveCategoria, categoria_id);
        }
      }

      const claveNombre = `nombre:${producto.nombre.toLocaleLowerCase('es')}`;
      const claveCodigo = producto.codigo ? `codigo:${producto.codigo.toLocaleLowerCase('es')}` : null;
      let existente = productosExistentes.get(claveNombre);
      if (existente === undefined && claveCodigo) existente = productosExistentes.get(claveCodigo);
      if (existente === undefined) {
        const porNombre = await buscarProductoConNombre(conexion, usuario_id, producto.nombre);
        if (porNombre) {
          existente = porNombre.id;
        } else if (producto.codigo) {
          const [porCodigo] = await conexion.execute(
            'SELECT id FROM productos WHERE usuario_id = ? AND codigo = ? ORDER BY id LIMIT 1',
            [usuario_id, producto.codigo]
          );
          existente = porCodigo.length ? porCodigo[0].id : null;
        } else {
          existente = null;
        }
      }

      const campos = {
        nombre: producto.nombre,
        codigo: producto.codigo,
        categoria_id,
        existencia: producto.existencia,
        costo: producto.costo,
        precio: producto.precio
      };

      if (existente) {
        const actualizaciones = [];
        const valores = [];
        for (const [campo, valor] of Object.entries(campos)) {
          if (valor === undefined || (
            valor === null && ['codigo', 'existencia', 'costo', 'precio'].includes(campo)
          )) continue;
          actualizaciones.push(`${campo} = ?`);
          valores.push(valor);
        }
        valores.push(existente, usuario_id);
        await conexion.execute(
          `UPDATE productos SET ${actualizaciones.join(', ')}, updated_at = UNIX_TIMESTAMP() WHERE id = ? AND usuario_id = ?`,
          valores
        );
        actualizados += 1;
      } else {
        const [resultado] = await conexion.execute(
          `INSERT INTO productos (nombre, codigo, descripcion, precio, costo, existencia, categoria_id, created_at, usuario_id)
           VALUES (?, ?, NULL, ?, ?, ?, ?, UNIX_TIMESTAMP(), ?)`,
          [
            producto.nombre,
            producto.codigo ?? null,
            producto.precio ?? 0,
            producto.costo ?? 0,
            producto.existencia ?? 0,
            categoria_id ?? null,
            usuario_id
          ]
        );
        creados += 1;
        existente = resultado.insertId;
      }
      productosExistentes.set(claveNombre, existente);
      if (claveCodigo) productosExistentes.set(claveCodigo, existente);
    }

    await conexion.commit();
    transaccionIniciada = false;
    res.json({
      creados,
      actualizados,
      omitidos: importacion.sinExistencia + importacion.erroresTotal,
      sinExistencia: importacion.sinExistencia,
      erroresTotal: importacion.erroresTotal,
      errores: importacion.errores.slice(0, 20)
    });
  } catch (err) {
    if (conexion && transaccionIniciada) await conexion.rollback();
    console.error('Error importando inventario desde Excel:', err);
    res.status(500).json({ error: 'No se pudo completar la importación; no se guardaron cambios' });
  } finally {
    if (conexion) conexion.release();
  }
});

// Recupera un producto específico por ID para vistas de detalle/edición
router.get('/:id', (req, res)=>{
  const id = req.params.id;
  const usuario_id = req.body.usuario_id || req.query.usuario_id;
  if (!usuario_id) return res.status(400).json({ error: 'usuario_id requerido' });
  db.get('SELECT * FROM productos WHERE id = ? AND usuario_id = ?', [id, usuario_id], (err, row) => {
    if (err) return res.status(500).json({ error: 'Error leyendo producto' });
    if (!row) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ producto: productWithImageUrl(row, usuario_id) });
  });
});

// Crea un producto nuevo y guarda la imagen enviada en base64 si existe
router.post('/', async (req, res) => {
  const { codigo, descripcion, precio, costo, existencia, categoria_id, dataUrl, usuario_id } = req.body;
  const nombre = String(req.body.nombre || '').trim();
  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });
  if (nombre.length > 255) return res.status(400).json({ error: 'El nombre no puede superar los 255 caracteres' });
  if (!usuario_id) return res.status(400).json({ error: 'usuario_id requerido' });
  if (precio < 0 || costo < 0 || existencia < 0) return res.status(400).json({ error: 'Valores no pueden ser negativos' });

  const image = dataUrl ? parseImageDataUrl(dataUrl) : null;
  if (dataUrl && !image) return res.status(400).json({ error: 'Imagen inválida o supera el límite de 30 MB' });

  let conexion;
  let transaccionIniciada = false;
  try {
    conexion = await db._pool.getConnection();
    await conexion.beginTransaction();
    transaccionIniciada = true;
    if (!await bloquearInventarioUsuario(conexion, usuario_id)) {
      await conexion.rollback();
      transaccionIniciada = false;
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    if (await buscarProductoConNombre(conexion, usuario_id, nombre)) {
      await conexion.rollback();
      transaccionIniciada = false;
      return res.status(409).json({ error: `Ya existe un producto llamado "${nombre}"` });
    }
    const [resultado] = await conexion.execute(
      `INSERT INTO productos (nombre, codigo, descripcion, precio, costo, existencia, categoria_id, image_url, image_data, image_mime, created_at, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, UNIX_TIMESTAMP(), ?)`,
      [nombre, codigo || null, descripcion || null, precio || 0, costo || 0, existencia || 0, categoria_id || null, image ? image.buffer : null, image ? image.mime : null, usuario_id]
    );
    const [filas] = await conexion.execute(
      'SELECT * FROM productos WHERE id = ? AND usuario_id = ?',
      [resultado.insertId, usuario_id]
    );
    await conexion.commit();
    transaccionIniciada = false;
    res.json({ producto: productWithImageUrl(filas[0], usuario_id) });
  } catch (err) {
    if (conexion && transaccionIniciada) await conexion.rollback();
    console.error('Error creando producto:', err);
    res.status(500).json({ error: 'Error creando producto' });
  } finally {
    if (conexion) conexion.release();
  }
});

// Reemplaza todos los campos del producto y actualiza marca de tiempo
router.put('/:id', async (req, res) => {
  const id = req.params.id;
  const { codigo, descripcion, precio, costo, existencia, categoria_id, usuario_id } = req.body;
  const nombre = String(req.body.nombre || '').trim();
  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });
  if (nombre.length > 255) return res.status(400).json({ error: 'El nombre no puede superar los 255 caracteres' });
  if (!usuario_id) return res.status(400).json({ error: 'usuario_id requerido' });
  if (precio < 0 || costo < 0 || existencia < 0) return res.status(400).json({ error: 'Valores no pueden ser negativos' });
  let conexion;
  let transaccionIniciada = false;
  try {
    conexion = await db._pool.getConnection();
    await conexion.beginTransaction();
    transaccionIniciada = true;
    if (!await bloquearInventarioUsuario(conexion, usuario_id)) {
      await conexion.rollback();
      transaccionIniciada = false;
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const [productoActual] = await conexion.execute(
      'SELECT id, nombre FROM productos WHERE id = ? AND usuario_id = ?',
      [id, usuario_id]
    );
    if (!productoActual.length) {
      await conexion.rollback();
      transaccionIniciada = false;
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    if (!await nombresIguales(conexion, productoActual[0].nombre, nombre) &&
      await buscarProductoConNombre(conexion, usuario_id, nombre, id)) {
      await conexion.rollback();
      transaccionIniciada = false;
      return res.status(409).json({ error: `Ya existe otro producto llamado "${nombre}"` });
    }
    await conexion.execute(
      `UPDATE productos SET nombre = ?, codigo = ?, descripcion = ?, precio = ?, costo = ?, existencia = ?, categoria_id = ?, updated_at = UNIX_TIMESTAMP() WHERE id = ? AND usuario_id = ?`,
      [nombre, codigo || null, descripcion || null, precio || 0, costo || 0, existencia || 0, categoria_id || null, id, usuario_id]
    );
    const [filas] = await conexion.execute('SELECT * FROM productos WHERE id = ? AND usuario_id = ?', [id, usuario_id]);
    await conexion.commit();
    transaccionIniciada = false;
    res.json({ producto: productWithImageUrl(filas[0], usuario_id) });
  } catch (err) {
    if (conexion && transaccionIniciada) await conexion.rollback();
    console.error('Error actualizando producto:', err);
    res.status(500).json({ error: 'Error actualizando producto' });
  } finally {
    if (conexion) conexion.release();
  }
});

// Permite actualizar campos puntuales del producto y subir una nueva imagen
router.patch('/:id', async (req, res) => {
  const id = req.params.id;
  const fields = [];
  const values = [];
  const usuario_id = req.body.usuario_id;
  if (!usuario_id) return res.status(400).json({ error: 'usuario_id requerido' });
  const nombre = req.body.nombre === undefined ? undefined : String(req.body.nombre || '').trim();
  if (nombre !== undefined && !nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });
  if (nombre !== undefined && nombre.length > 255) {
    return res.status(400).json({ error: 'El nombre no puede superar los 255 caracteres' });
  }
  for (const campo of ['precio', 'costo', 'existencia']) {
    if (req.body[campo] === undefined) continue;
    const valor = req.body[campo];
    if (valor === null || valor === '' || !Number.isFinite(Number(valor)) || Number(valor) < 0) {
      return res.status(400).json({ error: 'El precio, costo y existencia deben ser valores no negativos' });
    }
  }
  ['precio', 'existencia', 'nombre', 'codigo', 'descripcion', 'costo', 'categoria_id'].forEach(k => {
    if (req.body[k] !== undefined) {
      fields.push(`${k} = ?`);
      values.push(k === 'nombre' ? nombre : req.body[k]);
    }
  });
  let image = null;
  if (req.body.dataUrl !== undefined) {
    image = parseImageDataUrl(req.body.dataUrl);
    if (!image) return res.status(400).json({ error: 'Imagen inválida o supera el límite de 30 MB' });
    fields.push('image_data = ?', 'image_mime = ?', 'image_url = NULL');
    values.push(image.buffer, image.mime);
  }

  if (fields.length === 0) return res.status(400).json({ error: 'Nada para actualizar' });
  const shouldStampUpdate = ['existencia', 'precio', 'costo', 'codigo'].some(k => req.body[k] !== undefined) || Boolean(image);
  if (shouldStampUpdate) {
    fields.push("updated_at = UNIX_TIMESTAMP()");
  }
  values.push(id, usuario_id);
  let conexion;
  let transaccionIniciada = false;
  try {
    conexion = await db._pool.getConnection();
    await conexion.beginTransaction();
    transaccionIniciada = true;
    if (!await bloquearInventarioUsuario(conexion, usuario_id)) {
      await conexion.rollback();
      transaccionIniciada = false;
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const [productoActual] = await conexion.execute(
      'SELECT id, nombre FROM productos WHERE id = ? AND usuario_id = ?',
      [id, usuario_id]
    );
    if (!productoActual.length) {
      await conexion.rollback();
      transaccionIniciada = false;
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    if (nombre !== undefined &&
      !await nombresIguales(conexion, productoActual[0].nombre, nombre) &&
      await buscarProductoConNombre(conexion, usuario_id, nombre, id)) {
      await conexion.rollback();
      transaccionIniciada = false;
      return res.status(409).json({ error: `Ya existe otro producto llamado "${nombre}"` });
    }
    const sql = `UPDATE productos SET ${fields.join(', ')} WHERE id = ? AND usuario_id = ?`;
    await conexion.execute(sql, values);
    const [filas] = await conexion.execute('SELECT * FROM productos WHERE id = ? AND usuario_id = ?', [id, usuario_id]);
    await conexion.commit();
    transaccionIniciada = false;
    res.json({ producto: productWithImageUrl(filas[0], usuario_id) });
  } catch (err) {
    if (conexion && transaccionIniciada) await conexion.rollback();
    console.error('Error actualizando producto:', err);
    res.status(500).json({ error: 'Error actualizando producto' });
  } finally {
    if (conexion) conexion.release();
  }
});

// Elimina un producto y devuelve error si el registro no existía
router.delete('/:id', (req, res)=>{
  const id = req.params.id;
  const usuario_id = req.body.usuario_id || req.query.usuario_id;
  if (!usuario_id) return res.status(400).json({ error: 'usuario_id requerido' });
  db.run('DELETE FROM productos WHERE id = ? AND usuario_id = ?', [id, usuario_id], function (err) {
    if (err) return res.status(500).json({ error: 'Error eliminando producto' });
    if (this.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ mensaje: 'Producto eliminado' });
  });
});

module.exports = router;

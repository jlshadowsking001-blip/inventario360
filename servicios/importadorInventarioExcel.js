const ExcelJS = require('exceljs');

const MAX_FILAS_POR_HOJA = 20000;
const MAX_FILAS_LIBRO = 50000;
const MAX_PRODUCTOS = 10000;

function normalizarEncabezado(valor) {
    return String(valor ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function obtenerValorCelda(hoja, fila, columna, usarTexto = false) {
    if (columna == null) return undefined;
    const celda = hoja.getRow(fila).getCell(columna);
    if (usarTexto && celda.text) return celda.text.trim();
    const valor = celda.value;
    if (valor && typeof valor === 'object') {
        if (valor.result !== undefined) return valor.result;
        if (Array.isArray(valor.richText)) return valor.richText.map(parte => parte.text).join('');
        if (valor.text !== undefined) return valor.text;
    }
    return valor;
}

function detectarColumnas(hoja, fila) {
    const columnas = {};
    const encabezados = hoja.getRow(fila);

    encabezados.eachCell({ includeEmpty: false }, (celda, indice) => {
        const texto = normalizarEncabezado(celda.text || celda.value);
        if (!texto) return;
        const textoPrecioVenta = texto.replace(/\s+(c|cs|usd|mxn|eur|cordobas?)$/, '');

        if (!columnas.nombre && /^(nombre|producto|name|product|nombre producto|nombre del producto|articulo|nombre articulo)$/.test(texto)) {
            columnas.nombre = indice;
        } else if (!columnas.codigo && /^(codigo|codigo producto|codigo del producto|product code|sku|clave|referencia)$/.test(texto)) {
            columnas.codigo = indice;
        } else if (!columnas.categoria && /^(categoria|category|categoria producto|familia|departamento|apartado|tipo)$/.test(texto)) {
            columnas.categoria = indice;
        } else if (!columnas.existencia && /^(cant|cantidad|cantidad disponible|cantidad en existencia|existencia|existencias|stock|stock actual|unidades|qty|quantity)$/.test(texto)) {
            columnas.existencia = indice;
        } else if (!columnas.costo && !texto.includes('inventario') &&
            /^(costo|costos|coste|costo compra|costo de compra|coste compra|precio compra|precio de compra|precio de costo|costo unitario|unit cost|cost)$/.test(texto)) {
            columnas.costo = indice;
        } else if (!columnas.precio && !texto.includes('inventario') &&
            /^(precio|precio venta|precio de venta|precio unitario venta|precio venta unitario|precio unitario de venta|precio al publico|precio publico|p venta|pvp|sale price|venta|price)$/.test(textoPrecioVenta)) {
            columnas.precio = indice;
        } else if (!columnas.precioInventario &&
            /^(precio inventario|precio del inventario|valor inventario|valor del inventario)$/.test(texto)) {
            columnas.precioInventario = indice;
        }
    });

    const tieneValoresImportables = ['codigo', 'categoria', 'existencia', 'costo', 'precio']
        .some(campo => columnas[campo] != null);
    return columnas.nombre != null && tieneValoresImportables ? columnas : null;
}

function convertirNumero(valor, campo) {
    if (valor == null || String(valor).trim() === '') return null;
    if (typeof valor === 'number') {
        if (Number.isFinite(valor)) return valor;
        throw new Error(`${campo} no es un número válido`);
    }

    let texto = String(valor).trim().replace(/[^\d,.\-]/g, '');
    if (texto.includes(',') && texto.includes('.')) {
        if (texto.lastIndexOf(',') > texto.lastIndexOf('.')) {
            texto = texto.replace(/\./g, '').replace(',', '.');
        } else {
            texto = texto.replace(/,/g, '');
        }
    } else if (texto.includes(',')) {
        texto = texto.replace(',', '.');
    }

    if (!texto || texto === '-') throw new Error(`${campo} no es un número válido`);
    const numero = Number(texto);
    if (!Number.isFinite(numero) || numero < 0) {
        throw new Error(`${campo} debe ser un número no negativo`);
    }
    if (campo === 'existencia' && !Number.isInteger(numero)) {
        throw new Error('La existencia debe ser un número entero');
    }
    return numero;
}

async function leerProductosExcel(buffer) {
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(buffer);
    if (!libro.worksheets.length) throw new Error('El archivo no contiene hojas de cálculo');
    if (libro.worksheets.length > 50) throw new Error('El archivo contiene demasiadas hojas');

    const productos = [];
    const errores = [];
    let erroresTotal = 0;
    let sinExistencia = 0;
    let encontroTabla = false;
    let totalFilas = 0;

    for (const hoja of libro.worksheets) {
        totalFilas += hoja.rowCount;
        if (totalFilas > MAX_FILAS_LIBRO) {
            throw new Error(`El archivo supera el límite de ${MAX_FILAS_LIBRO} filas`);
        }
        if (hoja.rowCount > MAX_FILAS_POR_HOJA) {
            throw new Error(`La hoja "${hoja.name}" supera el límite de ${MAX_FILAS_POR_HOJA} filas`);
        }

        let filaEncabezados = 0;
        let columnas = null;
        for (let fila = 1; fila <= hoja.rowCount; fila += 1) {
            columnas = detectarColumnas(hoja, fila);
            if (columnas) {
                filaEncabezados = fila;
                break;
            }
        }
        if (!columnas) continue;
        encontroTabla = true;

        for (let fila = filaEncabezados + 1; fila <= hoja.rowCount; fila += 1) {
            const nombre = String(obtenerValorCelda(hoja, fila, columnas.nombre) ?? '').trim();
            if (!nombre) continue;
            if (productos.length >= MAX_PRODUCTOS) {
                throw new Error(`El archivo supera el límite de ${MAX_PRODUCTOS} productos`);
            }

            try {
                const existencia = columnas.existencia == null
                    ? undefined
                    : convertirNumero(obtenerValorCelda(hoja, fila, columnas.existencia), 'La existencia');
                let precio = columnas.precio == null
                    ? undefined
                    : convertirNumero(
                        obtenerValorCelda(hoja, fila, columnas.precio) ??
                            obtenerValorCelda(hoja, fila, columnas.precio, true),
                        'El precio'
                    );
                if (precio == null && columnas.precioInventario != null && existencia > 0) {
                    const totalPrecioInventario = convertirNumero(
                        obtenerValorCelda(hoja, fila, columnas.precioInventario) ??
                            obtenerValorCelda(hoja, fila, columnas.precioInventario, true),
                        'El precio del inventario'
                    );
                    if (totalPrecioInventario != null) {
                        precio = Number((totalPrecioInventario / existencia).toFixed(2));
                    }
                }
                const producto = {
                    nombre,
                    codigo: columnas.codigo == null
                        ? undefined
                        : String(obtenerValorCelda(hoja, fila, columnas.codigo, true) ?? '').trim() || null,
                    categoria: columnas.categoria == null
                        ? undefined
                        : String(obtenerValorCelda(hoja, fila, columnas.categoria) ?? '').trim() || null,
                    existencia,
                    costo: columnas.costo == null
                        ? undefined
                        : convertirNumero(obtenerValorCelda(hoja, fila, columnas.costo), 'El costo'),
                    precio,
                    hoja: hoja.name,
                    fila
                };
                if (producto.nombre.length > 255) throw new Error('El nombre supera los 255 caracteres');
                if (producto.codigo?.length > 191) throw new Error('El código supera los 191 caracteres');
                if (producto.categoria?.length > 255) throw new Error('La categoría supera los 255 caracteres');
                if (producto.existencia == null || producto.existencia === 0) {
                    sinExistencia += 1;
                    continue;
                }
                productos.push(producto);
            } catch (error) {
                erroresTotal += 1;
                if (errores.length < 20) errores.push({ hoja: hoja.name, fila, error: error.message });
            }
        }
    }

    if (!encontroTabla) {
        throw new Error('No se encontró una tabla. Incluye encabezados como Nombre, Código, Categoría, Cantidad, Costo o Precio.');
    }
    return { productos, errores, erroresTotal, sinExistencia };
}

module.exports = { leerProductosExcel };

function normalizarNombre(nombre) {
  return String(nombre || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function distanciaEdicion(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let anterior = Array.from({ length: b.length + 1 }, (_valor, indice) => indice);
  for (let i = 1; i <= a.length; i += 1) {
    const actual = [i];
    for (let j = 1; j <= b.length; j += 1) {
      actual[j] = Math.min(
        actual[j - 1] + 1,
        anterior[j] + 1,
        anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    anterior = actual;
  }
  return anterior[b.length];
}

function buscarNombreParecido(nombre, productos, excluirId = null) {
  const palabrasNuevas = normalizarNombre(nombre);
  if (!palabrasNuevas.length) return null;

  for (const producto of productos) {
    if (excluirId != null && String(producto.id) === String(excluirId)) continue;
    const palabrasExistentes = normalizarNombre(producto.nombre);
    if (palabrasNuevas.length !== palabrasExistentes.length) continue;

    const restantesNuevas = [...palabrasNuevas];
    const restantesExistentes = [...palabrasExistentes];
    for (let indice = restantesNuevas.length - 1; indice >= 0; indice -= 1) {
      const coincidencia = restantesExistentes.indexOf(restantesNuevas[indice]);
      if (coincidencia === -1) continue;
      restantesNuevas.splice(indice, 1);
      restantesExistentes.splice(coincidencia, 1);
    }
    if (restantesNuevas.length !== 1 || restantesExistentes.length !== 1) continue;

    const nueva = restantesNuevas[0];
    const existente = restantesExistentes[0];
    if (Math.min(nueva.length, existente.length) < 4) continue;
    const distancia = distanciaEdicion(nueva, existente);
    if (distancia <= 2 && distancia / Math.max(nueva.length, existente.length) <= 0.35) {
      return producto;
    }
  }
  return null;
}

module.exports = { buscarNombreParecido, normalizarNombre };

// Función para calcular la distancia euclidiana entre dos vectores
// La distancia euclidiana mide cuán diferentes son dos vectores en un espacio multidimensional.
function euclideanDistance(vec1, vec2) {
    let sum = 0; // Inicializamos la suma de las diferencias al cuadrado.
    for (let i = 0; i < vec1.length; i++) { // Iteramos sobre cada componente del vector.
      sum += Math.pow(vec1[i] - vec2[i], 2); // Calculamos la diferencia al cuadrado entre los valores correspondientes.
    }
    return Math.sqrt(sum); // Retornamos la raíz cuadrada de la suma para obtener la distancia euclidiana.
  }
  
  // Función para encontrar los N vecinos más cercanos
  // Dado un usuario objetivo, buscamos los `k` usuarios más similares a este según sus vectores de habilidades.
  function findNearestNeighbors(data, targetUserIndex, k) {
    const distances = []; // Lista para almacenar las distancias entre el usuario objetivo y los demás.
  
    // Iteramos sobre todos los usuarios en los datos.
    for (let i = 0; i < data.length; i++) {
      if (i === targetUserIndex) continue; // Saltamos el usuario objetivo (no puede ser su propio vecino).
      const distance = euclideanDistance(data[targetUserIndex], data[i]); // Calculamos la distancia al usuario actual.
      distances.push({ index: i, distance }); // Almacenamos el índice y la distancia en la lista.
    }
  
    // Ordenamos las distancias en orden ascendente (usuarios más cercanos primero).
    distances.sort((a, b) => a.distance - b.distance);
  
    // Seleccionamos los `k` vecinos más cercanos (primeros `k` elementos de la lista ordenada).
    const nearestNeighbors = distances.slice(0, k);
  
    return nearestNeighbors; // Retornamos los vecinos más cercanos con sus índices y distancias.
  }
  
  // Obtener datos de Airtable
  // Conectamos a Airtable para obtener los registros de la tabla "Users".
  const validUserRecords = await base
    .getTable('Users') // Accedemos a la tabla "Users".
    .selectRecordsAsync({ fields: ['preferredName', 'isFromClient', 'skillSets'] }); // Seleccionamos los campos relevantes.
  
  // Filtrar usuarios válidos
  // Filtramos los usuarios que tienen "skillSets" y donde "isFromClient" es verdadero.
  const filteredUserRecords = [];
  for (let record of validUserRecords.records) {
    if (record.getCellValue('skillSets') !== null && record.getCellValue('isFromClient')) {
      filteredUserRecords.push({
        ...record, // Incluimos toda la información original del registro.
        name: record.getCellValue('preferredName'), // Extraemos el nombre preferido del usuario.
        skillSets: record.getCellValue('skillSets').map(r => r.name.toLowerCase()) // Convertimos las habilidades a minúsculas para uniformidad.
      });
    }
  }
  
  // Convertir skillSets a vectores numéricos (one-hot encoding)
  // Creamos una lista única de todas las habilidades presentes en los usuarios.
  const allSkills = [...new Set(filteredUserRecords.flatMap(user => user.skillSets))];
  
  // Generamos un vector para cada usuario, donde cada habilidad es representada por un 1 o un 0.
  const userVectors = filteredUserRecords.map(user => {
    const vector = new Array(allSkills.length).fill(0); // Inicializamos un vector lleno de ceros (longitud = número de habilidades únicas).
    user.skillSets.forEach(skill => {
      const index = allSkills.indexOf(skill); // Encontramos el índice de la habilidad en la lista única.
      if (index !== -1) vector[index] = 1; // Marcamos con un 1 si el usuario tiene esta habilidad.
    });
    return vector; // Retornamos el vector del usuario.
  });
  
  // Seleccionar un usuario objetivo
  // Elegimos el índice del usuario para el cual queremos encontrar vecinos más cercanos (por ejemplo, el primero).
  const targetUserIndex = 0; // Índice del usuario objetivo (puede ser cualquier usuario en los datos).
  const k = 5; // Número de vecinos más cercanos que queremos encontrar.
  
  // Encontrar los K vecinos más cercanos
  const nearestNeighbors = findNearestNeighbors(userVectors, targetUserIndex, k); // Ejecutamos la función para encontrar los vecinos.
  
  // Mostrar los resultados
  // Mostramos los vecinos más cercanos con sus nombres y distancias.
  console.log(`Vecinos más cercanos para el usuario "${filteredUserRecords[targetUserIndex].name}":`);
  nearestNeighbors.forEach(neighbor => {
    const neighborUser = filteredUserRecords[neighbor.index]; // Obtenemos la información del vecino.
    console.log(
      `- Usuario: ${neighborUser.name}, Distancia: ${neighbor.distance.toFixed(2)}` // Mostramos el nombre y la distancia.
    );
  });
  
  // (Opcional) Guardar las recomendaciones en Airtable
  // Actualizamos los registros de los vecinos más cercanos en Airtable marcándolos como recomendados.
  await base.getTable('Users').updateRecordsAsync(
    nearestNeighbors.map(neighbor => ({
      id: filteredUserRecords[neighbor.index].id, // ID del vecino que queremos actualizar.
      fields: { Recommended: true } // Marcamos este vecino como recomendado (campo booleano en Airtable).
    }))
  );
  

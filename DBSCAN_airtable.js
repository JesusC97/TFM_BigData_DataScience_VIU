// Función para calcular la distancia euclidiana entre dos vectores
// La distancia euclidiana mide la "cercanía" entre dos puntos en un espacio multidimensional.
function euclideanDistance(vec1, vec2) {
    let sum = 0; // Inicializamos la suma de las diferencias al cuadrado.
    for (let i = 0; i < vec1.length; i++) { // Iteramos por cada dimensión (componente) del vector.
        sum += Math.pow(vec1[i] - vec2[i], 2); // Calculamos la diferencia al cuadrado entre las componentes correspondientes.
    }
    return Math.sqrt(sum); // La raíz cuadrada de la suma nos da la distancia euclidiana.
}

// Implementación del algoritmo DBSCAN para clustering basado en densidad.
function dbscan(data, epsilon, minPoints) {
    const clusters = []; // Aquí almacenaremos los clusters finales.
    const visited = new Set(); // Este conjunto rastrea los puntos que ya han sido visitados.
    const noise = new Set(); // Este conjunto rastrea los puntos clasificados como ruido.

    // Iteramos sobre cada punto en los datos.
    for (let i = 0; i < data.length; i++) {
        if (visited.has(i)) continue; // Si el punto ya fue visitado, lo ignoramos.

        visited.add(i); // Marcamos el punto actual como visitado.
        const neighbors = findNeighbors(data, i, epsilon); // Encontramos los vecinos dentro del radio epsilon.

        if (neighbors.length < minPoints) { // Si no hay suficientes vecinos, el punto es ruido.
            noise.add(i);
        } else {
            const cluster = []; // Creamos un nuevo cluster.
            // Expandimos el cluster incluyendo los puntos conectados densamente.
            expandCluster(data, i, neighbors, cluster, visited, epsilon, minPoints);
            clusters.push(cluster); // Agregamos el cluster completo a la lista de clusters.
        }
    }

    // Retornamos los clusters encontrados y los puntos considerados como ruido.
    return { clusters, noise };
}

// Función para encontrar vecinos de un punto en un radio epsilon.
function findNeighbors(data, pointIndex, epsilon) {
    const neighbors = []; // Aquí almacenamos los índices de los vecinos encontrados.
    for (let i = 0; i < data.length; i++) {
        // Calculamos la distancia entre el punto actual y todos los demás.
        if (euclideanDistance(data[pointIndex], data[i]) <= epsilon) {
            neighbors.push(i); // Si la distancia es menor o igual a epsilon, es vecino.
        }
    }
    return neighbors; // Retornamos la lista de vecinos.
}

// Función para expandir un cluster
function expandCluster(data, pointIndex, neighbors, cluster, visited, epsilon, minPoints) {
    cluster.push(pointIndex); // Añadimos el punto inicial al cluster.

    // Iteramos sobre los vecinos del punto inicial.
    for (let i = 0; i < neighbors.length; i++) {
        const neighborIndex = neighbors[i]; // Índice del vecino actual.

        if (!visited.has(neighborIndex)) { // Si el vecino no ha sido visitado:
            visited.add(neighborIndex); // Lo marcamos como visitado.
            // Buscamos sus vecinos y verificamos si es un punto denso.
            const newNeighbors = findNeighbors(data, neighborIndex, epsilon);

            if (newNeighbors.length >= minPoints) {
                // Si el vecino tiene suficientes puntos cercanos, expandimos el grupo.
                neighbors = neighbors.concat(newNeighbors);
            }
        }

        // Añadimos el vecino al cluster si aún no está incluido.
        if (!cluster.includes(neighborIndex)) {
            cluster.push(neighborIndex);
        }
    }
}

// Obtener datos de Airtable.
// Aquí usamos la API de Airtable para obtener registros de la tabla "Users".
const validUserRecords = await base
    .getTable('Users') // Obtenemos la tabla llamada "Users".
    .selectRecordsAsync({ fields: ['preferredName', 'isFromClient', 'skillSets'] }); // Seleccionamos solo los campos relevantes.

// Filtrar usuarios válidos.
// Aquí nos aseguramos de incluir solo los usuarios con "skillSets" y donde "isFromClient" es verdadero.
const filteredUserRecords = [];
for (let record of validUserRecords.records) {
    if (record.getCellValue('skillSets') !== null && record.getCellValue('isFromClient')) {
        filteredUserRecords.push({
            ...record, // Incluimos toda la información original del registro.
            name: record.getCellValue('preferredName'), // Extraemos el nombre preferido.
            skillSets: record.getCellValue('skillSets').map(r => r.name.toLowerCase()) // Normalizamos las habilidades a minúsculas.
        });
    }
}

// Convertir "skillSets" a vectores numéricos (one-hot encoding).
// Aquí transformamos las habilidades en vectores para que sean procesables por DBSCAN.
const allSkills = [...new Set(filteredUserRecords.flatMap(user => user.skillSets))];
// Creamos un vector para cada usuario, donde cada habilidad es representada como 1 o 0.
const userVectors = filteredUserRecords.map(user => {
    const vector = new Array(allSkills.length).fill(0); // Inicializamos un vector de ceros.
    user.skillSets.forEach(skill => {
        const index = allSkills.indexOf(skill); // Encontramos el índice de la habilidad.
        if (index !== -1) vector[index] = 1; // Marcamos la habilidad como presente.
    });
    return vector; // Retornamos el vector del usuario.
});

// Aplicar DBSCAN al conjunto de datos.
const epsilon = 2; // Radio de búsqueda.
const minPoints = 2; // Mínimo de puntos necesarios para formar un cluster.
const { clusters, noise } = dbscan(userVectors, epsilon, minPoints); // Ejecutamos DBSCAN.

// Asignar clusters a los usuarios.
// Aquí creamos una lista con los usuarios y sus respectivos clusters.
const results = filteredUserRecords.map((user, index) => ({
    id: user.id, // ID del usuario.
    name: user.name, // Nombre del usuario.
    cluster: clusters.findIndex(cluster => cluster.includes(index)) + 1 || -1 // Número de cluster o -1 si es ruido.
}));

// Mostrar resultados.
// Mostramos en consola los clusters asignados a los usuarios.
console.log('Resultados del clustering con DBSCAN:', results);

// (Opcional) Guardar los clusters en Airtable.
// Actualizamos la tabla "Users" con los clusters asignados.
await base.getTable('Users').updateRecordsAsync(
    results.map(user => ({
        id: user.id, // ID del registro a actualizar.
        fields: { Cluster: user.cluster } // Actualizamos el campo "Cluster" con el número asignado.
    }))
);
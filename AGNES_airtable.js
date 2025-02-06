// Función para calcular la distancia euclidiana entre dos vectores
function euclideanDistance(vec1, vec2) {
    let sum = 0;
    for (let i = 0; i < vec1.length; i++) {
        sum += Math.pow(vec1[i] - vec2[i], 2);
    }
    return Math.sqrt(sum);
}

// Implementación de AGNES (Clustering Jerárquico Aglomerativo)
function agnes(data) {
    // Inicializamos los clústeres, donde cada usuario es su propio clúster individual
    let clusters = data.map((_, i) => [i]);

    // Mientras haya más de un clúster, seguimos fusionando los más cercanos
    while (clusters.length > 1) {
        let minDistance = Infinity; // Distancia mínima entre clústeres
        let mergeIndexA = -1;
        let mergeIndexB = -1;

        // Encontramos los dos clústeres más cercanos
        for (let i = 0; i < clusters.length; i++) {
            for (let j = i + 1; j < clusters.length; j++) {
                let distance = clusterDistance(data, clusters[i], clusters[j]);
                if (distance < minDistance) {
                    minDistance = distance;
                    mergeIndexA = i;
                    mergeIndexB = j;
                }
            }
        }

        // Fusionamos los dos clústeres más cercanos
        clusters[mergeIndexA] = clusters[mergeIndexA].concat(clusters[mergeIndexB]);
        clusters.splice(mergeIndexB, 1); // Eliminamos el clúster que se ha fusionado
    }

    return clusters; // Retornamos los clústeres finales
}

// Función para calcular la distancia entre dos clústeres usando el método de enlace completo (la mayor distancia entre puntos de dos clústeres)
function clusterDistance(data, clusterA, clusterB) {
    let maxDistance = 0;
    for (let i of clusterA) {
        for (let j of clusterB) {
            let distance = euclideanDistance(data[i], data[j]);
            maxDistance = Math.max(maxDistance, distance);
        }
    }
    return maxDistance;
}

// Obtener datos de Airtable
const validUserRecords = await base.getTable('Users').selectRecordsAsync({ fields: ['preferredName', 'isFromClient', 'skillSets'] });

// Filtrar usuarios válidos (que tengan habilidades registradas y sean clientes)
const filteredUserRecords = validUserRecords.records.filter(record => record.getCellValue('skillSets') !== null && record.getCellValue('isFromClient'));

// Convertimos las habilidades a una lista única para one-hot encoding
const allSkills = [...new Set(filteredUserRecords.flatMap(user => user.getCellValue('skillSets').map(skill => skill.name.toLowerCase())))];

// Creamos un vector para cada usuario con representación numérica de sus habilidades
const userVectors = filteredUserRecords.map(user => {
    let vector = new Array(allSkills.length).fill(0); // Vector de ceros
    user.getCellValue('skillSets').forEach(skill => {
        let index = allSkills.indexOf(skill.name.toLowerCase());
        if (index !== -1) vector[index] = 1; // Marcamos la habilidad como presente
    });
    return vector;
});

// Aplicar AGNES
const clusters = agnes(userVectors);

// Asignar clústeres a usuarios
const results = filteredUserRecords.map((user, index) => ({
    id: user.id,
    name: user.getCellValue('preferredName'),
    cluster: clusters.findIndex(cluster => cluster.includes(index)) + 1 || -1
}));

// Guardar los clústeres en Airtable
await base.getTable('Users').updateRecordsAsync(results.map(user => ({
    id: user.id,
    fields: { Cluster: user.cluster }
})));

console.log("Clústeres asignados por AGNES:", results);

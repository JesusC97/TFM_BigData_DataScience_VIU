// Función para calcular la distancia euclidiana entre dos vectores
function euclideanDistance(vec1, vec2) {
    let sum = 0;
    for (let i = 0; i < vec1.length; i++) {
        sum += Math.pow(vec1[i] - vec2[i], 2);
    }
    return Math.sqrt(sum);
}

// Inicializar k centroides aleatoriamente
function initializeCentroids(data, k) {
    return data.sort(() => 0.5 - Math.random()).slice(0, k);
}

// Asignar cada usuario al clúster más cercano según la distancia a los centroides
function assignClusters(data, centroids) {
    return data.map(userVector => {
        let distances = centroids.map(centroid => euclideanDistance(userVector, centroid));
        return distances.indexOf(Math.min(...distances)); // Retorna el índice del clúster más cercano
    });
}

// Calcular nuevos centroides promediando los usuarios de cada clúster
function updateCentroids(data, assignments, k) {
    let newCentroids = Array(k).fill(null).map(() => new Array(data[0].length).fill(0));
    let counts = Array(k).fill(0);

    data.forEach((userVector, i) => {
        let cluster = assignments[i];
        counts[cluster]++;
        userVector.forEach((val, j) => newCentroids[cluster][j] += val);
    });

    return newCentroids.map((sum, i) => sum.map(val => (counts[i] ? val / counts[i] : val)));
}

// Implementación de K-Means con iteraciones máximas
function kMeans(data, k, maxIterations = 100) {
    let centroids = initializeCentroids(data, k);
    let assignments = assignClusters(data, centroids);
    
    for (let i = 0; i < maxIterations; i++) {
        let newCentroids = updateCentroids(data, assignments, k);
        let newAssignments = assignClusters(data, newCentroids);

        if (JSON.stringify(assignments) === JSON.stringify(newAssignments)) break; // Si no hay cambios, detener
        centroids = newCentroids;
        assignments = newAssignments;
    }

    return assignments; // Retornamos la asignación final de cada usuario a un clúster
}

// Obtener datos de Airtable
const validUserRecords = await base.getTable('Users').selectRecordsAsync({ fields: ['preferredName', 'isFromClient', 'skillSets'] });

// Filtrar usuarios válidos (con habilidades y que sean clientes)
const filteredUserRecords = validUserRecords.records.filter(record => record.getCellValue('skillSets') !== null && record.getCellValue('isFromClient'));

// Creamos una lista de habilidades únicas
const allSkills = [...new Set(filteredUserRecords.flatMap(user => user.getCellValue('skillSets').map(skill => skill.name.toLowerCase())))];

// Convertimos cada usuario en un vector numérico con representación one-hot
const userVectors = filteredUserRecords.map(user => {
    let vector = new Array(allSkills.length).fill(0);
    user.getCellValue('skillSets').forEach(skill => {
        let index = allSkills.indexOf(skill.name.toLowerCase());
        if (index !== -1) vector[index] = 1;
    });
    return vector;
});

// Aplicar K-Means con k=3
const k = 3;
const assignments = kMeans(userVectors, k);

// Asignar clústeres a usuarios
const results = filteredUserRecords.map((user, index) => ({
    id: user.id,
    name: user.getCellValue('preferredName'),
    cluster: assignments[index] + 1
}));

// Guardar clústeres en Airtable
await base.getTable('Users').updateRecordsAsync(results.map(user => ({
    id: user.id,
    fields: { Cluster: user.cluster }
})));

console.log("Clústeres asignados por K-Means:", results);

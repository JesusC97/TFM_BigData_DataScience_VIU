const fs = require('fs'); // Importar el módulo 'fs' para trabajar con el sistema de archivos
const xlsx = require('xlsx'); // Importar el módulo 'xlsx' para leer archivos de Excel

// Función para leer el archivo Excel
function loadExcelData(filePath) {
    const workbook = xlsx.readFile(filePath); // Leer el archivo Excel y cargarlo en un objeto 'workbook'
    const sheetName = workbook.SheetNames[0]; // Obtener el nombre de la primera hoja del archivo
    const sheet = workbook.Sheets[sheetName]; // Obtener los datos de la hoja específica
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 }); // Convertir la hoja en un array de objetos JSON, con encabezados como parte de los datos

    return data.slice(1).map(row => ({ // Eliminar la primera fila (encabezados) y mapear cada fila a un objeto
        id: row[0], // El primer elemento de la fila es el ID del freelancer
        responses: row[1].split(',').map(Number) // El segundo elemento es una cadena de respuestas, que se convierte en un array de números
    }));
}

// Función para calcular la distancia euclidiana entre dos vectores
function euclideanDistance(a, b) {
    return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0)); // Calcular la raíz cuadrada de la suma de las diferencias al cuadrado entre los elementos de los vectores
}

// Función para inicializar los centroides de manera aleatoria
function initializeCentroids(data, k) {
    const centroids = [];
    const indices = new Set();

    // Seleccionar k puntos aleatorios como centroides iniciales
    while (indices.size < k) {
        const randomIndex = Math.floor(Math.random() * data.length);
        if (!indices.has(randomIndex)) {
            indices.add(randomIndex);
            centroids.push(data[randomIndex].responses);
        }
    }

    return centroids;
}

// Función para asignar cada punto al clúster más cercano
function assignClusters(data, centroids) {
    const clusters = new Array(centroids.length).fill().map(() => []); // Inicializar clústeres vacíos

    data.forEach((point, index) => {
        let minDistance = Infinity;
        let clusterIndex = -1;

        // Encontrar el centroide más cercano
        centroids.forEach((centroid, i) => {
            const distance = euclideanDistance(point.responses, centroid);
            if (distance < minDistance) {
                minDistance = distance;
                clusterIndex = i;
            }
        });

        clusters[clusterIndex].push(index); // Asignar el punto al clúster correspondiente
    });

    return clusters;
}

// Función para actualizar los centroides
function updateCentroids(data, clusters) {
    const centroids = [];

    clusters.forEach(cluster => {
        const centroid = new Array(data[0].responses.length).fill(0); // Inicializar el nuevo centroide

        // Calcular la media de los puntos en el clúster
        cluster.forEach(index => {
            data[index].responses.forEach((val, i) => {
                centroid[i] += val;
            });
        });

        centroid.forEach((val, i) => {
            centroid[i] = val / cluster.length; // Calcular la media
        });

        centroids.push(centroid); // Añadir el nuevo centroide
    });

    return centroids;
}

// Función para implementar el algoritmo K-Means
function kmeans(data, k, maxIterations = 1000) {
    let centroids = initializeCentroids(data, k); // Inicializar centroides
    let clusters = [];

    for (let i = 0; i < maxIterations; i++) {
        clusters = assignClusters(data, centroids); // Asignar puntos a clústeres
        const newCentroids = updateCentroids(data, clusters); // Actualizar centroides

        // Verificar convergencia (si los centroides no cambian)
        if (euclideanDistance(centroids.flat(), newCentroids.flat()) < 1e-6) {
            break;
        }

        centroids = newCentroids; // Actualizar centroides
    }

    return clusters; // Devolver los clústeres finales
}

// Función para calcular el coeficiente de silueta
function calculateSilhouetteScore(data, clusters) {
    const n = data.length; // Número total de puntos
    if (clusters.length === 0 || clusters.every(cluster => cluster.length === 0)) {
        return -1; // Si no hay clústeres válidos, devolver -1
    }

    let silhouetteSum = 0;

    // Recorrer cada punto
    data.forEach((point, i) => {
        // Encontrar el clúster al que pertenece el punto
        const clusterIndex = clusters.findIndex(cluster => cluster.includes(i));
        if (clusterIndex === -1) return; // Si el punto no está en ningún clúster, ignorarlo

        const cluster = clusters[clusterIndex]; // Obtener el clúster del punto
        const a = calculateAverageDistance(data, i, cluster); // Calcular la distancia media intra-clúster
        const b = calculateNearestClusterDistance(data, i, clusters, clusterIndex); // Calcular la distancia media al clúster más cercano
        const silhouette = (b - a) / Math.max(a, b); // Calcular el coeficiente de silueta para el punto
        silhouetteSum += silhouette; // Sumar al total
    });

    return silhouetteSum / n; // Devolver el promedio del coeficiente de silueta
}

// Función para calcular la distancia media intra-clúster
function calculateAverageDistance(data, pointIndex, cluster) {
    const point = data[pointIndex].responses; // Respuestas del punto actual
    let sum = 0;

    // Calcular la distancia euclidiana a todos los puntos del clúster
    cluster.forEach(otherIndex => {
        if (otherIndex !== pointIndex) { // Excluir el punto actual
            sum += euclideanDistance(point, data[otherIndex].responses);
        }
    });

    return sum / (cluster.length - 1); // Devolver la distancia media
}

// Función para calcular la distancia media al clúster más cercano
function calculateNearestClusterDistance(data, pointIndex, clusters, currentClusterIndex) {
    const point = data[pointIndex].responses; // Respuestas del punto actual
    let minAvgDistance = Infinity;

    // Recorrer todos los clústeres, excepto el actual
    clusters.forEach((cluster, clusterIndex) => {
        if (clusterIndex === currentClusterIndex) return; // Ignorar el clúster actual

        // Calcular la distancia media al clúster
        const avgDistance = calculateAverageDistance(data, pointIndex, cluster);
        if (avgDistance < minAvgDistance) {
            minAvgDistance = avgDistance; // Actualizar la distancia mínima
        }
    });

    return minAvgDistance; // Devolver la distancia media al clúster más cercano
}

// Función para encontrar el número óptimo de clústeres (k)
function findOptimalK(data, kValues) {
    let bestScore = -1; // Mejor coeficiente de silueta encontrado
    let bestK = kValues[0]; // Mejor valor de k

    // Probar diferentes valores de k
    kValues.forEach(k => {
        const clusters = kmeans(data, k); // Aplicar K-Means
        const score = calculateSilhouetteScore(data, clusters); // Calcular el coeficiente de silueta

        // Actualizar el mejor k si se encuentra un mejor score
        if (score > bestScore) {
            bestScore = score;
            bestK = k;
        }

        console.log(`k: ${k}, Silhouette Score: ${score.toFixed(2)}`);
    });

    return { bestK, bestScore }; // Devolver el mejor k y su score
}

// Cargar los datos de los freelancers desde el archivo Excel
const freelancers = loadExcelData('Freelancers.xlsx');

// Definir los valores de k a probar
const kValues = [2, 3, 4, 5, 6, 7, 8]; // Valores de k a probar

// Encontrar el número óptimo de clústeres
const { bestK, bestScore } = findOptimalK(freelancers, kValues);

// Mostrar los resultados
console.log('Parámetros óptimos:');
console.log(`- k: ${bestK}`);
console.log(`- Coeficiente de Silueta: ${bestScore.toFixed(2)}`);
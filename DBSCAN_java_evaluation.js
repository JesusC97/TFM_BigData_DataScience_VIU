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

// Función para leer el archivo de texto
function loadQueryData(filePath) {
    const content = fs.readFileSync(filePath, 'utf8'); // Leer el contenido del archivo de texto en formato UTF-8
    return content.trim().split(',').map(Number); // Eliminar espacios en blanco, dividir por comas y convertir cada elemento en un número
}

// Función para calcular la distancia euclidiana entre dos vectores
function euclideanDistance(a, b) {
    return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0)); // Calcular la raíz cuadrada de la suma de las diferencias al cuadrado entre los elementos de los vectores
}

// Función para implementar el algoritmo DBSCAN
function dbscan(data, eps, minPts) {
    let clusterId = 0; // Inicializar el identificador de clúster
    const clusters = []; // Array para almacenar los clústeres
    const visited = new Set(); // Conjunto para almacenar los puntos ya visitados
    const noise = new Set(); // Conjunto para almacenar los puntos considerados ruido

    // Recorrer cada punto en los datos
    data.forEach((point, index) => {
        if (visited.has(index)) return; // Si el punto ya fue visitado, continuar con el siguiente

        visited.add(index); // Marcar el punto como visitado

        // Encontrar los vecinos del punto actual dentro del radio 'eps'
        const neighbors = findNeighbors(data, index, eps);

        // Si el número de vecinos es menor que 'minPts', marcar el punto como ruido
        if (neighbors.length < minPts) {
            noise.add(index);
        } else {
            // Crear un nuevo clúster
            const cluster = [];
            clusterId++; // Incrementar el identificador de clúster
            expandCluster(data, index, neighbors, clusterId, eps, minPts, visited, clusters, cluster);
            clusters.push(cluster); // Añadir el clúster al array de clústeres
        }
    });

    return { clusters, noise }; // Devolver los clústeres y los puntos de ruido
}

// Función para encontrar los vecinos de un punto dentro del radio 'eps'
function findNeighbors(data, pointIndex, eps) {
    const neighbors = [];
    const point = data[pointIndex].responses; // Obtener las respuestas del punto actual

    // Recorrer todos los puntos para encontrar vecinos
    data.forEach((otherPoint, otherIndex) => {
        if (euclideanDistance(point, otherPoint.responses) <= eps) {
            neighbors.push(otherIndex); // Añadir el índice del vecino
        }
    });

    return neighbors;
}

// Función para expandir un clúster
function expandCluster(data, pointIndex, neighbors, clusterId, eps, minPts, visited, clusters, cluster) {
    cluster.push(pointIndex); // Añadir el punto actual al clúster

    // Recorrer todos los vecinos del punto actual
    neighbors.forEach(neighborIndex => {
        if (!visited.has(neighborIndex)) { // Si el vecino no ha sido visitado
            visited.add(neighborIndex); // Marcar el vecino como visitado

            // Encontrar los vecinos del vecino actual
            const neighborNeighbors = findNeighbors(data, neighborIndex, eps);

            // Si el vecino tiene suficientes vecinos, añadirlos al clúster
            if (neighborNeighbors.length >= minPts) {
                neighbors.push(...neighborNeighbors);
            }
        }

        // Si el vecino no pertenece a ningún clúster, añadirlo al clúster actual
        if (!clusters.some(cluster => cluster.includes(neighborIndex))) {
            cluster.push(neighborIndex);
        }
    });
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
        if (clusterIndex === -1) return; // Si el punto es ruido, ignorarlo

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

// Función para encontrar los parámetros óptimos de DBSCAN
function findOptimalParameters(data, epsValues, minPtsValues) {
    let bestScore = -1; // Mejor coeficiente de silueta encontrado
    let bestEps = epsValues[0]; // Mejor valor de eps
    let bestMinPts = minPtsValues[0]; // Mejor valor de minPts

    // Probar todas las combinaciones de eps y minPts
    epsValues.forEach(eps => {
        minPtsValues.forEach(minPts => {
            const { clusters } = dbscan(data, eps, minPts); // Aplicar DBSCAN
            const score = calculateSilhouetteScore(data, clusters); // Calcular el coeficiente de silueta

            // Actualizar los mejores parámetros si se encuentra un mejor score
            if (score > bestScore) {
                bestScore = score;
                bestEps = eps;
                bestMinPts = minPts;
            }

            console.log(`eps: ${eps}, minPts: ${minPts}, Silhouette Score: ${score.toFixed(4)}`);
        });
    });

    return { bestEps, bestMinPts, bestScore }; // Devolver los mejores parámetros
}

// Cargar los datos de los freelancers desde el archivo Excel
const freelancers = loadExcelData('Freelancers.xlsx');

// Definir los valores de eps y minPts a probar
const epsValues = [3, 4, 5, 6, 7]; // Valores de eps a probar
const minPtsValues = [2, 3, 4, 5]; // Valores de minPts a probar

// Encontrar los parámetros óptimos
const { bestEps, bestMinPts, bestScore } = findOptimalParameters(freelancers, epsValues, minPtsValues);

// Mostrar los resultados
console.log('Parámetros óptimos:');
console.log(`- eps: ${bestEps}`);
console.log(`- minPts: ${bestMinPts}`);
console.log(`- Coeficiente de Silueta: ${bestScore.toFixed(4)}`);
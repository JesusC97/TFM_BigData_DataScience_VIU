const fs = require('fs'); // Importar el módulo 'fs' para trabajar con el sistema de archivos
const xlsx = require('xlsx'); // Importar el módulo 'xlsx' para leer archivos de Excel

// Función para leer el archivo Excel
function loadExcelData(filePath) {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    return data.slice(1).map(row => ({
        id: row[0],
        responses: row[1].split(',').map(Number)
    }));
}

// Función para calcular la distancia euclidiana entre dos vectores
function euclideanDistance(a, b) {
    return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
}

// Función para calcular la matriz de distancias entre clústeres
function computeDistanceMatrix(data) {
    const n = data.length;
    const matrix = Array(n).fill().map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            matrix[i][j] = euclideanDistance(data[i].responses, data[j].responses);
            matrix[j][i] = matrix[i][j]; // La matriz es simétrica
        }
    }

    return matrix;
}

// Algoritmo AGNES (usando enlace completo: máxima distancia entre clústeres)
function agnes(data, k) {
    let clusters = data.map((_, i) => [i]); // Cada punto es un clúster inicial
    let distanceMatrix = computeDistanceMatrix(data);

    while (clusters.length > k) {
        // Encontrar los dos clústeres más cercanos
        let minDistance = Infinity;
        let clusterA = -1, clusterB = -1;

        for (let i = 0; i < clusters.length; i++) {
            for (let j = i + 1; j < clusters.length; j++) {
                // Calcular distancia máxima entre elementos de los clústeres (enlace completo)
                let maxDist = 0;
                clusters[i].forEach(a => {
                    clusters[j].forEach(b => {
                        maxDist = Math.max(maxDist, distanceMatrix[a][b]);
                    });
                });

                if (maxDist < minDistance) {
                    minDistance = maxDist;
                    clusterA = i;
                    clusterB = j;
                }
            }
        }

        // Fusionar los clústeres
        clusters[clusterA] = clusters[clusterA].concat(clusters[clusterB]);
        clusters.splice(clusterB, 1);
    }

    return clusters;
}

// Función para calcular el coeficiente de silueta (igual que en K-Means)
function calculateSilhouetteScore(data, clusters) {
    const n = data.length;
    if (clusters.length === 0 || clusters.every(cluster => cluster.length === 0)) return -1;

    let silhouetteSum = 0;
    data.forEach((point, i) => {
        const clusterIndex = clusters.findIndex(cluster => cluster.includes(i));
        if (clusterIndex === -1) return;

        const cluster = clusters[clusterIndex];
        const a = cluster.reduce((sum, idx) => sum + euclideanDistance(point.responses, data[idx].responses), 0) / (cluster.length - 1);
        let b = Infinity;

        clusters.forEach((otherCluster, otherIdx) => {
            if (otherIdx === clusterIndex) return;
            const avgDist = otherCluster.reduce((sum, idx) => sum + euclideanDistance(point.responses, data[idx].responses), 0) / otherCluster.length;
            if (avgDist < b) b = avgDist;
        });

        silhouetteSum += (b - a) / Math.max(a, b);
    });

    return silhouetteSum / n;
}

// Función para encontrar el k óptimo
function findOptimalK(data, kValues) {
    let bestScore = -1;
    let bestK = kValues[0];

    kValues.forEach(k => {
        const clusters = agnes(data, k);
        const score = calculateSilhouetteScore(data, clusters);
        console.log(`k: ${k}, Silhouette Score: ${score.toFixed(2)}`);

        if (score > bestScore) {
            bestScore = score;
            bestK = k;
        }
    });

    return { bestK, bestScore };
}

// Cargar datos y ejecutar
const freelancers = loadExcelData('Freelancers.xlsx');
const kValues = [2, 3, 4, 5];
const { bestK, bestScore } = findOptimalK(freelancers, kValues);

console.log('Parámetros óptimos:');
console.log(`- k: ${bestK}`);
console.log(`- Coeficiente de Silueta: ${bestScore.toFixed(2)}`);
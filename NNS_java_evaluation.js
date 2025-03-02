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

// Función para encontrar los k vecinos más cercanos
function findNearestNeighbors(data, query, k = 5) {
    return data.map(item => ({ // Mapear cada freelancer a un objeto con su ID y la distancia al query
        id: item.id, // ID del freelancer
        distance: euclideanDistance(item.responses, query) // Distancia euclidiana entre las respuestas del freelancer y el query
    })).sort((a, b) => a.distance - b.distance) // Ordenar los freelancers por distancia (de menor a mayor)
        .slice(0, k); // Seleccionar los primeros k freelancers (los más cercanos)
}

// Función para evaluar el modelo (precision, recall y coverage)
function evaluateModel(freelancers, queryResponse, neighbors, threshold = 10) {
    // Calcular el número de freelancers relevantes (aquellos cuya distancia es menor que el umbral)
    const relevantFreelancers = freelancers.filter(freelancer => 
        euclideanDistance(freelancer.responses, queryResponse) < threshold
    ).length;

    // Calcular el número de true positives (recomendaciones que son relevantes)
    const truePositives = neighbors.filter(neighbor => 
        neighbor.distance < threshold
    ).length;

    // Calcular la precisión: proporción de recomendaciones relevantes sobre el total de recomendaciones
    const precision = truePositives / neighbors.length;

    // Calcular el recall: proporción de freelancers relevantes que fueron recomendados
    const recall = truePositives / relevantFreelancers;

    // Calcular el coverage: proporción de freelancers únicos que fueron recomendados
    const totalFreelancers = freelancers.length; // Número total de freelancers
    const recommendedFreelancers = new Set(neighbors.map(neighbor => neighbor.id)).size; // Número de freelancers únicos recomendados
    const coverage = recommendedFreelancers / totalFreelancers; // Proporción de coverage

    return {
        precision: precision.toFixed(2), // Precisión redondeada a 2 decimales
        recall: recall.toFixed(2), // Recall redondeado a 2 decimales
        coverage: coverage.toFixed(2) // Coverage redondeado a 2 decimales
    };
}

// Cargar los datos de los freelancers desde el archivo Excel
const freelancers = loadExcelData('Freelancers_Limpieza_Sintetico_Realista.xlsx');

// Cargar las respuestas del cliente desde el archivo de texto
const queryResponse = loadQueryData('RespuestaCliente1.txt');

// Verificar que las longitudes de las respuestas de los freelancers y del cliente sean iguales
if (freelancers.length > 0 && freelancers[0].responses.length !== queryResponse.length) {
    console.error("Error: La consulta y los datos de los freelancers tienen longitudes diferentes.");
    process.exit(1); // Terminar el programa si hay un error
}

// Encontrar los 5 vecinos más cercanos
const neighbors = findNearestNeighbors(freelancers, queryResponse, 5);

// Evaluar el modelo utilizando las funciones definidas
const metrics = evaluateModel(freelancers, queryResponse, neighbors);

// Mostrar los freelancers más cercanos
console.log('Freelancers más cercanos:', neighbors);

// Mostrar las métricas del modelo
console.log('Métricas del modelo:');
console.log(`- Precision: ${metrics.precision}`); // Precisión del modelo
console.log(`- Recall: ${metrics.recall}`); // Recall del modelo
console.log(`- Coverage: ${metrics.coverage}`); // Coverage del modelo
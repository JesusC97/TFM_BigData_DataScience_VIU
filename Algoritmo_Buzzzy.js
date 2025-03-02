// Importar módulos necesarios para manejar archivos y Excel
const fs = require('fs'); // Módulo para operaciones de sistema de archivos
const xlsx = require('xlsx'); // Librería para leer/escribir archivos Excel

// ==========================================================================
// MÓDULO: Configuración global y carga de datos 
// ==========================================================================

const CONFIG = {
    excelFile: 'Freelancers.xlsx', // Ruta del archivo Excel con datos de freelancers
    textFile: 'RespuestaClienteBuzzzy4.txt', // Ruta del archivo texto con requerimientos del cliente
    sheetName: 'Sheet1', // Nombre de la hoja en el Excel
    maxNGramSize: 4 // Tamaño máximo de n-gramas a generar
};

// Función para cargar y procesar datos del Excel
function loadExcel(filePath) {
    const workbook = xlsx.readFile(filePath); // Cargar archivo Excel completo
    const sheet = workbook.Sheets[CONFIG.sheetName]; // Obtener hoja específica
    const data = xlsx.utils.sheet_to_json(sheet); // Convertir datos de la hoja a JSON
    
    if (data.length === 0) { // Validar si hay datos
        console.error('El archivo Excel está vacío o mal formateado.');
        return [];
    }

    // Depuración: mostrar encabezados para verificar estructura
    console.log('Encabezados detectados en el Excel:', Object.keys(data[0]));
    
    // Mapear datos a estructura necesaria (nombre y habilidades)
    return data.map(row => ({
        name: row.PreferedName || 'Desconocido', // Usar nombre o valor por defecto
        skillSets: row.Skills ? row.Skills.toLowerCase().split(', ') : [] // Normalizar habilidades
    }));
}


// Función para procesar el texto de requisitos del cliente
function tokenizeText(filePath) {
    // Leer archivo y convertir a minúsculas para unificación
    const text = fs.readFileSync(filePath, 'utf-8').toLowerCase();
    // Extraer palabras individuales usando expresión regular
    return text.match(/\b\w+\b/g) || [];
}

// Generar todas las combinaciones posibles de n-gramas
function generateNGrams(tokens, maxSize) {
    let ngrams = [];
    // Iterar por todos los tamaños de n-grama requeridos
    for (let size = 1; size <= maxSize; size++) {
        // Crear ventana deslizante para cada posible n-grama
        for (let i = 0; i <= tokens.length - size; i++) {
            const ngram = tokens.slice(i, i + size).join(' '); // Unir tokens en n-grama
            ngrams.push(ngram); // Agregar a lista resultante
        }
    }
    return ngrams;
}

// ==========================================================================
// MÓDULO: Búsqueda de coincidencias entre habilidades y n-gramas 
// ==========================================================================

function findMatches(ngrams, users) {
    let matches = [];
    // Evaluar cada freelancer
    users.forEach(user => {
        let matchCount = 0; // Contador de habilidades coincidentes
        let relevance = 0; // Puntaje por longitud de habilidades coincidentes
        
        user.skillSets.forEach(skill => {
            if (ngrams.includes(skill)) { // Buscar coincidencia exacta
                matchCount++;
                relevance += skill.split(' ').length; // Habilidades multi-palabra suman más puntos
            }
        });
        
        // Registrar solo freelancers con coincidencias
        if (matchCount > 0) {
            matches.push({
                name: user.name,
                count: matchCount,
                relevance
            });
        }
    });
    // Ordenar por relevancia (mayor primero)
    return matches.sort((a, b) => b.relevance - a.relevance);
}

// ==========================================================================
// MÓDULO: Ejecución principal
// ==========================================================================

const users = loadExcel(CONFIG.excelFile);
if (users.length === 0) { // Validación crítica de datos
    console.error('No se encontraron datos válidos en el Excel. Verifica los encabezados.');
    process.exit(1); // Salir con código de error
}
const tokens = tokenizeText(CONFIG.textFile); // Procesar texto de requisitos
const ngrams = generateNGrams(tokens, CONFIG.maxNGramSize); // Generar n-gramas
const results = findMatches(ngrams, users); // Obtener y ordenar coincidencias

console.log('Top matches:', results); // Mostrar resultados finales

// ==========================================================================
// MÓDULO: CÁLCULO DE MÉTRICAS DE EVALUACIÓN
// ==========================================================================

const totalUsers = users.length;
const recommendedUsers = results.length;
const relevantUsers = users.filter(user => user.skillSets.length > 0 && results.some(match => match.name === user.name)).length;
const relevantRecommendedUsers = results.length;

// Coverage
const coverage = (recommendedUsers / totalUsers) * 100;

// Precision
const precision = (relevantRecommendedUsers / recommendedUsers) * 100;

// Recall
const recall = (relevantRecommendedUsers / relevantUsers) * 100;

// F1 Score
const f1Score = (2 * precision * recall) / (precision + recall);

console.log(`\nMétricas de Evaluación:`);
console.log(`Coverage: ${coverage.toFixed(2)}%`);
console.log(`Precision: ${precision.toFixed(2)}%`);
console.log(`Recall: ${recall.toFixed(2)}%`);
console.log(`F1 Score: ${f1Score.toFixed(2)}%`);
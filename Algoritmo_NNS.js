const fs = require('fs');
const xlsx = require('xlsx');
const natural = require('natural');

// ==========================================================================
// MÓDULO: Lectura de Datos
// ==========================================================================

function cargarStopwords(rutaArchivo) {
    try {
        const contenido = fs.readFileSync(rutaArchivo, 'utf-8');
        return new Set(
            contenido
                .toLowerCase()
                .replace(/\n/g, ',')
                .split(',')
                .map(palabra => palabra.trim())
                .filter(palabra => palabra.length > 0)
        );
    } catch (error) {
        console.error("Error al leer stopwords:", error.message);
        return new Set();
    }
}

const STOPWORDS = cargarStopwords('stopwords.txt');

// Diccionario de sinónimos y variantes.
const SYNONIMOS = {
    "sociales": "social",
    "contenido": "media",
    "creador": "creative",
    "website": "web",
    "writer":"writing",
    "gráficos":"graphic",
    "animado":"animation",
    "create":"creative",
    "designer":"design",
    "posts":"blog",
    "brand":"branding",
    "develop":"development",
    "logocolors":"logo",
    "webinar":"web",
    "copywriter":"copywriting",
    "workingwriting":"writing",
    "brands":"branding"    
};

// Función para normalizar cada palabra según el diccionario anterior.
function normalizarPalabra(palabra) {
    // Devuelve la forma canónica si existe en el diccionario, o la misma palabra.
    return SYNONIMOS[palabra] || palabra;
}

function dividirPalabrasClave(palabras) {
    return palabras.flatMap(palabra => 
        palabra.includes(" ") ? palabra.split(" ") : palabra.match(/[a-zA-Z]+/g) || []
    )
    .map(p => normalizarPalabra(p.toLowerCase()))
    .filter(p => !STOPWORDS.has(p));
}


function leerPalabrasClaveDesdeExcel(rutaExcel) {
    const workbook = xlsx.readFile(rutaExcel);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const datos = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    const freelancers = {};
    datos.slice(1).forEach(fila => {
        if (fila.length >= 3) {
            const nombre = fila[0].trim();
            const palabras = fila[2] ? fila[2].split(',').map(p => p.trim()) : [];
            freelancers[nombre] = dividirPalabrasClave(palabras);
        }
    });

    return freelancers;
}

function leerVectoresDesdeExcel(rutaExcel) {
    const workbook = xlsx.readFile(rutaExcel);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const datos = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    const freelancers = {};
    datos.slice(1).forEach(fila => {
        if (fila.length >= 2) {
            const nombre = fila[0].trim();
            const vector = fila[1].split(',').map(num => parseFloat(num.trim()));
            if (vector.length === 25) {
                freelancers[nombre] = vector;
            }
        }
    });

    return freelancers;
}

function leerTextoDesdeArchivo(rutaTxt) {
    const contenido = fs.readFileSync(rutaTxt, 'utf-8');
    return contenido.toLowerCase()
        .replace(/[^a-záéíóúüñ\s]/g, '')
        .split(/\s+/)
        .map(normalizarPalabra)
        .filter(palabra => !STOPWORDS.has(palabra));
}


function leerVectorDesdeArchivo(rutaTxt) {
    const contenido = fs.readFileSync(rutaTxt, 'utf-8').split('\n')[0];
    return contenido.split(',').map(num => parseFloat(num.trim()));
}

// ==========================================================================
// MÓDULO: TF-IDF
// ==========================================================================

function calcularTF(textoCliente) {
    const totalPalabras = textoCliente.length;
    const tf = {};
    
    // Contar frecuencia absoluta
    textoCliente.forEach(palabra => {
        tf[palabra] = (tf[palabra] || 0) + 1;
    });
    
    // Convertir a frecuencias relativas
    Object.keys(tf).forEach(palabra => {
        tf[palabra] = tf[palabra] / totalPalabras;
    });
    
    return tf;
}

function calcularRelevanciaFreelancers(freelancers, tfCliente) {
    console.log("\n=== TÉRMINOS DEL CLIENTE Y SUS TF ===");
    console.table(Object.entries(tfCliente).map(([palabra, tf]) => ({Palabra: palabra, TF: tf})));

    const ranking = [];
    
    for (const [nombre, habilidades] of Object.entries(freelancers)) {
        let puntuacion = 0;
        const contribuciones = {};
        
        console.log(`\n=== PROCESANDO FREELANCER: ${nombre} ===`);
        console.log("Habilidades:", habilidades);
        
        habilidades.forEach(palabra => {
            if (tfCliente[palabra]) {
                const contribucion = tfCliente[palabra];
                contribuciones[palabra] = contribucion;
                puntuacion += contribucion;
                console.log(`✓ Coincidencia: "${palabra}" → TF: ${contribucion.toFixed(4)}`);
            } else {
                console.log(`✗ Sin coincidencia: "${palabra}"`);
            }
        });
        
        console.log(`Puntuación total: ${puntuacion.toFixed(4)}`);
        
        ranking.push({
            freelancer: nombre,
            puntuacion,
            contribuciones
        });
    }
    
    return ranking.sort((a, b) => b.puntuacion - a.puntuacion);
}


// ==========================================================================
// MÓDULO: NNS
// ==========================================================================

function similitudCoseno(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
    const magA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
    const magB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));
    return magA && magB ? dotProduct / (magA * magB) : 0;
}

function calcularRankingNNS(freelancers, vectorConsulta) {
    return Object.entries(freelancers)
        .map(([freelancer, vector]) => {
            const similitud = similitudCoseno(vector, vectorConsulta);
            
            // Calcular contribuciones por característica
            const contribuciones = vector.map((val, i) => ({
                indice: i,
                contribucion: val * vectorConsulta[i],
                valorFreelancer: val,
                valorConsulta: vectorConsulta[i]
            })).sort((a, b) => b.contribucion - a.contribucion)
              .slice(0, 3); // Top 3 características

            return {
                freelancer,
                similitud,
                contribuciones
            };
        })
        .sort((a, b) => b.similitud - a.similitud);
}

// ==========================================================================
// MÓDULO: Match
// ==========================================================================

function encontrarTopCoincidentes(rankingTFIDF, rankingNNS) {
    let topN = 10;
    let coincidencias = [];

    while (coincidencias.length < 3 && topN <= Math.min(rankingTFIDF.length, rankingNNS.length)) {
        const topTFIDF = rankingTFIDF.slice(0, topN);
        const topNNS = rankingNNS.slice(0, topN);

        const freelancersTFIDF = new Set(topTFIDF.map(f => f.freelancer));
        const freelancersNNS = new Set(topNNS.map(f => f.freelancer));

        coincidencias = [...freelancersTFIDF].filter(f => freelancersNNS.has(f));
        topN += 5;
    }

    // Recolectar datos explicativos
    return coincidencias.slice(0, 3).map(freelancer => {
        const tfidfData = rankingTFIDF.find(f => f.freelancer === freelancer);
        const nnsData = rankingNNS.find(f => f.freelancer === freelancer);
        
        // Formatear palabras clave para mostrar
        const palabrasFormateadas = Object.entries(tfidfData.contribuciones)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([palabra, score]) => ({ palabra, score }));

        return {
            nombre: freelancer,
            similitud: nnsData.similitud,
            palabrasClave: palabrasFormateadas,
            caracteristicas: nnsData.contribuciones
        };
    });
}

// ==========================================================================
// MÓDULO: Función principal
// ==========================================================================

function generarRankingsConParadaDinamica(rutaExcel, rutaTxt) {
    try {
        // 1. Leer datos
        const freelancersPalabras = leerPalabrasClaveDesdeExcel(rutaExcel);
        const freelancersVectores = leerVectoresDesdeExcel(rutaExcel);
        const textoTokens = leerTextoDesdeArchivo(rutaTxt);
        const vectorConsulta = leerVectorDesdeArchivo(rutaTxt);
        const totalUsers = Object.keys(freelancersPalabras).length;

        // 2. Calcular rankings
        const rankingTF = calcularRelevanciaFreelancers(freelancersPalabras, calcularTF(textoTokens));
        const rankingNNS = calcularRankingNNS(freelancersVectores, vectorConsulta);

        // 3. Encontrar coincidencias
        const resultados = encontrarTopCoincidentes(rankingTF, rankingNNS);

        // 4. Mostrar resultados detallados
        console.log("\n=== RESULTADOS FINALES ===");
        resultados.forEach((freelancer, index) => {
            console.log(`\n${index + 1}. ${freelancer.nombre}`);
            console.log(`   Similitud de coseno total: ${freelancer.similitud.toFixed(4)}`);
            
            // Tabla de palabras clave
            console.log("\n   Keywords más relevantes:");
            console.table(freelancer.palabrasClave.map((p, i) => ({
                Palabra: p.palabra,
                Contribución: p.score.toFixed(4)
            })));
        });

        return {resultados: resultados,
        rankingTF: rankingTF,
        totalUsers: totalUsers};
    } catch (error) {
        console.error("Error:", error.message);
        return { resultados: [], rankingTF: [], totalUsers: 0 };
    }
}

// Ejecutar con parámetros
generarRankingsConParadaDinamica('Freelancers.xlsx', 'RespuestaCliente4.txt');


// ==========================================================================
// MÓDULO: CÁLCULO DE MÉTRICAS DE EVALUACIÓN
// ==========================================================================

function calcularMetricas({resultados, rankingTF, totalUsers}) {
    if (!resultados.length || !rankingTF.length) {
        console.log("\nNo hay datos para calcular métricas");
        return;
    }

    // 1. Definir usuarios relevantes (top 10 del ranking TF-IDF)
    const relevantUsers = new Set(
        rankingTF
            .filter(f => f.puntuacion > 0)  // Filtra freelancers con puntuación > 0
            .map(f => f.freelancer)         // Obtiene los nombres de los freelancers
    );

    // 2. Contar usuarios recomendados que son relevantes
    const relevantRecommendedUsers = Math.min(
        relevantUsers.size, // Número de coincidencias
        3 // Valor máximo permitido
    );

    // 3. Calcular métricas
    const recommendedUsers = resultados.length;
    const coverage = (recommendedUsers / totalUsers) * 100;
    const precision = (relevantRecommendedUsers / recommendedUsers) * 100 || 0;
    const recall = (relevantRecommendedUsers / relevantUsers.size) || 0;
    const f1Score = (2 * precision * recall) / (precision + recall) || 0;

    // 4. Mostrar métricas con más detalle
    console.log("\n\n=== MÉTRICAS DE EVALUACIÓN ===");
    console.log(`• Total de freelancers considerados: ${totalUsers}`);
    console.log(`• Usuarios recomendados: ${recommendedUsers}`);
    console.log(`• Usuarios relevantes (TF-IDF > 0): ${relevantUsers.size}`);
    console.log(`• Usuarios recomendados que son relevantes: ${relevantRecommendedUsers}`);
    
    console.log(`\n• Cobertura: ${coverage.toFixed(4)}%`);
    console.log(`• Precisión: ${precision.toFixed(4)}%`);
    console.log(`• Exhaustividad: ${recall.toFixed(4)}%`);
    console.log(`• Puntuación F1: ${f1Score.toFixed(4)}%`);
}


// Ejecutar algoritmo y obtener datos
const datosAlgoritmo = generarRankingsConParadaDinamica('Freelancers.xlsx', 'RespuestaCliente4.txt');

// Calcular métricas con los datos obtenidos
calcularMetricas(datosAlgoritmo);
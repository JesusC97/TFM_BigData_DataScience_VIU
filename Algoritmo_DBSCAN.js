const fs = require('fs'); // Módulo para leer archivos
const xlsx = require('xlsx'); // Módulo para manipular archivos Excel
const { DBSCAN } = require('density-clustering'); // Librería para clustering DBSCAN

// ==========================================================================
// MÓDULO: Lectura de Datos
// ==========================================================================

// Función para leer las stopwords desde un archivo externo
function cargarStopwords(rutaArchivo) {
    try {
        const contenido = fs.readFileSync(rutaArchivo, 'utf-8'); // Lee el archivo de stopwords
        return new Set(
            contenido
                .toLowerCase() // Uniformiza a minúsculas
                .replace(/\n/g, ',')  // Reemplaza saltos de línea con comas
                .split(',')            // Divide las palabras por comas
                .map(palabra => palabra.trim())  // Elimina espacios extra
                .filter(palabra => palabra.length > 0)  // Elimina entradas vacías
        );
    } catch (error) {
        console.error("Error al leer stopwords:", error.message);
        return new Set();  // Devuelve un set vacío si hay error
    }
}

// Cargar stopwords desde el archivo externo
const STOPWORDS = cargarStopwords('stopwords.txt');

/* ===================== NUEVO: Diccionario de Sinónimos =====================
   Ubicación: Inmediatamente después de cargar las stopwords.
   Aquí definimos los sinónimos y variantes que usaremos para normalizar los tokens.
*/
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

/* ===================== NUEVO: Función de normalización =====================
   Ubicación: Justo después del diccionario de sinónimos.
   Esta función transforma cada palabra a su forma canónica usando el diccionario.
*/
function normalizarPalabra(palabra) {
    return SYNONIMOS[palabra] || palabra;
}

// Función para leer y procesar el archivo de texto (para TF-IDF)
function leerTextoDesdeArchivo(rutaTxt) {
    const contenido = fs.readFileSync(rutaTxt, 'utf-8');
    return contenido.toLowerCase()
        .replace(/[^a-záéíóúüñ\s]/g, '') 
        .split(/\s+/)
        .map(normalizarPalabra) // MODIFICADO: aplicar normalización a cada token
        .filter(palabra => !STOPWORDS.has(palabra));
}

// Función para dividir palabras y filtrar stopwords
function dividirPalabrasClave(palabras) {
    return palabras.flatMap(palabra =>
        palabra.includes(" ") ? palabra.split(" ") : palabra.match(/[a-zA-Z]+/g) || []
    )
    .map(p => normalizarPalabra(p.toLowerCase())) // MODIFICADO: normalización
    .filter(p => !STOPWORDS.has(p));
}

// Función para leer palabras clave desde Excel
function leerPalabrasClaveDesdeExcel(rutaExcel) {
    const workbook = xlsx.readFile(rutaExcel);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const datos = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    const freelancers = {};
    datos.slice(1).forEach(fila => {
        if (fila.length >= 3) {
            const nombre = fila[0].trim(); // Nombre del freelancer
            const palabras = fila[2] ? fila[2].split(',').map(p => p.trim()) : [];
            freelancers[nombre] = dividirPalabrasClave(palabras);
        }
    });
    return freelancers;
}

// Función para leer vectores numéricos desde Excel (DBSCAN)
function leerVectoresDesdeExcel(rutaExcel) {
    const workbook = xlsx.readFile(rutaExcel);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const datos = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    const freelancers = {};
    const vectores = [];
    const nombres = [];

    datos.slice(1).forEach(fila => {
        if (fila.length >= 2) {
            const nombre = fila[0].trim();
            const vector = fila[1].split(',').map(num => parseFloat(num.trim()));
            if (vector.length === 25) {
                freelancers[nombre] = vector;
                vectores.push(vector);
                nombres.push(nombre);
            }
        }
    });
    return { freelancers, vectores, nombres };
}

// Función para leer el vector del cliente desde el archivo de texto
function leerVectorDesdeArchivo(rutaTxt) {
    const contenido = fs.readFileSync(rutaTxt, 'utf-8').split('\n')[0];
    const vector = contenido.split(',').map(num => parseFloat(num.trim()));
    // console.log("=== Vector del Cliente ===");
    // console.log(vector);
    return vector;
}


// ==========================================================================
// MÓDULO: Algoritmo DBSCAN (Parte Social)
// ==========================================================================

// Aplicar DBSCAN a los freelancers
function clusterizarFreelancers(vectores, nombres, epsilon = 5, minPoints = 3) {
    console.log("\n=== Ejecutando DBSCAN ===");
    const dbscan = new DBSCAN();
    const clusters = dbscan.run(vectores, epsilon, minPoints);
    
    //console.log("Clusters generados (índices):", clusters);
    
    let asignaciones = {};
    clusters.forEach((cluster, index) => {
        // console.log(`Cluster ${index}:`);
        cluster.forEach(idx => {
            asignaciones[nombres[idx]] = index;
            // console.log(`   ${nombres[idx]} (índice ${idx})`);
        });
    });

    console.log("Asignaciones de freelancers a clusters:");
    console.table(asignaciones);
    
    return asignaciones;
}

// Asignar el cliente a un cluster basado en la menor distancia a los freelancers clusterizados
function asignarClienteACluster(vectorCliente, freelancers, asignaciones) {
    console.log("\n=== Asignando Cliente a Cluster ===");
    let minDist = Infinity;
    let clusterAsignado = null;

    for (let freelancer in freelancers) {
        // Calcular distancia Euclidiana
        let distancia = Math.sqrt(freelancers[freelancer].reduce((sum, val, i) =>
            sum + Math.pow(val - vectorCliente[i], 2), 0));

        console.log(`Distancia del cliente a ${freelancer}: ${distancia.toFixed(4)} (Cluster: ${asignaciones[freelancer]})`);

        if (distancia < minDist && asignaciones[freelancer] !== undefined) {
            minDist = distancia;
            clusterAsignado = asignaciones[freelancer];
        }
    }

    console.log(`Cliente asignado al cluster ${clusterAsignado} (distancia mínima: ${minDist.toFixed(4)})`);
    return clusterAsignado;
}


// ==========================================================================
// MÓDULO: TF-IDF (Parte técnica)
// ==========================================================================

// Función para calcular TF-IDF
function calcularTFIDF(freelancers, textoTokens) {
    console.log("\n=== Calculando TF-IDF ===");
    const ranking = [];
    for (const freelancer in freelancers) {
        const palabrasClave = freelancers[freelancer];
        if (palabrasClave.length === 0) continue;

        // Calcular TF para cada palabra clave
        const tf = palabrasClave.reduce((acc, palabra) => {
            const ocurrencias = textoTokens.filter(token => token === palabra).length;
            acc[palabra] = ocurrencias / textoTokens.length;
            return acc;
        }, {});

        console.log(`TF para ${freelancer}:`, tf);

        // Sumar las contribuciones para obtener un valor TF-IDF total
        let tfidfTotal = Object.values(tf).reduce((sum, value) => sum + value, 0);
        ranking.push({ freelancer, tfidf: tfidfTotal });
    }
    ranking.sort((a, b) => b.tfidf - a.tfidf);
    
    console.log("Ranking TF-IDF (ordenado):");
    console.table(ranking);
    
    return ranking;
}


// ==========================================================================
// MÓDULO: Match entre DBSCAN y TF-IDF
// ==========================================================================

// Función para hacer match de tres freelancers
function hacerMatchDeTres(clusterAsignado, asignaciones, rankingTFIDF) {
    console.log(`\n=== Haciendo Match para el Cluster ${clusterAsignado} ===`);
    // Filtrar freelancers del mismo cluster
    const freelancersEnCluster = Object.keys(asignaciones).filter(
        nombre => asignaciones[nombre] === clusterAsignado
    );
    console.log("Freelancers en el mismo cluster:", freelancersEnCluster);

    // Filtrar y ordenar el ranking TF-IDF para los freelancers en el cluster
    const rankingFiltrado = rankingTFIDF.filter(
        item => freelancersEnCluster.includes(item.freelancer)
    );
    
    console.log("Ranking TF-IDF filtrado por cluster:");
    console.table(rankingFiltrado);

    // Seleccionar los tres mejores
    return rankingFiltrado.slice(0, 3);
}

// Función principal para TF-IDF + DBSCAN + Match
function generarMatchDeTresFreelancers(rutaExcel, rutaTxt) {
    try {
        // 1. Leer datos y vectores
        const { freelancers, vectores, nombres } = leerVectoresDesdeExcel(rutaExcel);
        const vectorCliente = leerVectorDesdeArchivo(rutaTxt);
        const asignaciones = clusterizarFreelancers(vectores, nombres);

        // 2. Asignar cliente a un cluster
        const clusterAsignado = asignarClienteACluster(vectorCliente, freelancers, asignaciones);
        if (clusterAsignado === null) {
            console.log("El cliente no fue asignado a ningún cluster.");
            return { match: [], rankingTF: [], totalUsers: 0, freelancersEnCluster: [] };
        }

        // 3. Calcular ranking TF-IDF
        const freelancersPalabras = leerPalabrasClaveDesdeExcel(rutaExcel);
        const textoTokens = leerTextoDesdeArchivo(rutaTxt);
        const rankingTFIDF = calcularTFIDF(freelancersPalabras, textoTokens);

        // 4. Hacer match de tres freelancers
        const match = hacerMatchDeTres(clusterAsignado, asignaciones, rankingTFIDF);

        // 5. Mostrar resultados finales
        console.log("\n=== Freelancers seleccionados (Match de 3) ===");
        match.forEach((item, idx) => {
            console.log(`${idx + 1}. ${item.freelancer} (TF-IDF: ${item.tfidf.toFixed(4)})`);
        });

        // 6. Preparar datos para métricas
        const freelancersEnCluster = Object.keys(asignaciones).filter(
            nombre => asignaciones[nombre] === clusterAsignado
        );
        const totalUsers = Object.keys(freelancersPalabras).length;

        // 7. Devolver datos para métricas
        return {
            match,
            rankingTF: rankingTFIDF,
            totalUsers,
            freelancersEnCluster
        };
    } catch (error) {
        console.error("Error:", error.message);
        return { match: [], rankingTF: [], totalUsers: 0, freelancersEnCluster: [] };
    }
}

// Ejecutar la función principal
generarMatchDeTresFreelancers('Freelancers.xlsx', 'RespuestaCliente1.txt');


// ==========================================================================
// MÓDULO: CÁLCULO DE MÉTRICAS DE EVALUACIÓN
// ==========================================================================


function calcularMetricas({match, rankingTF, totalUsers, freelancersEnCluster}) {
    if (!match.length || !rankingTF.length) {
        console.log("\nNo hay datos para calcular métricas");
        return;
    }

    // 1. Definir usuarios relevantes (puntuación TF-IDF > 0 y mismo cluster que el cliente)
    const relevantUsers = new Set(
        rankingTF
            .filter(f => f.tfidf > 0 && freelancersEnCluster.includes(f.freelancer))  // Filtra freelancers con puntuación > 0 y en el mismo cluster
            .map(f => f.freelancer)  // Obtiene los nombres de los freelancers
    );

    // 2. Contar usuarios recomendados que son relevantes
    const relevantRecommendedUsers = match.filter(f => 
        relevantUsers.has(f.freelancer)
    ).length;

    // 3. Calcular métricas
    const recommendedUsers = match.length;
    const coverage = (recommendedUsers / totalUsers) * 100;
    const precision = (relevantRecommendedUsers / recommendedUsers) * 100 || 0;
    const recall = (relevantRecommendedUsers / relevantUsers.size) || 0;
    const f1Score = (2 * precision * recall) / (precision + recall) || 0;

    // 4. Mostrar métricas con más detalle
    console.log("\n\n=== MÉTRICAS DE EVALUACIÓN ===");
    console.log(`• Total de freelancers considerados: ${totalUsers}`);
    console.log(`• Usuarios recomendados: ${recommendedUsers}`);
    console.log(`• Usuarios relevantes (TF-IDF > 0 y mismo cluster): ${relevantUsers.size}`);
    console.log(`• Usuarios recomendados que son relevantes: ${relevantRecommendedUsers}`);
    
    console.log(`\n• Cobertura: ${coverage.toFixed(4)}%`);
    console.log(`• Precisión: ${precision.toFixed(4)}%`);
    console.log(`• Exhaustividad: ${recall.toFixed(4)}%`);
    console.log(`• Puntuación F1: ${f1Score.toFixed(4)}%`);
}


// Ejecutar algoritmo y obtener datos
const datosAlgoritmo = generarMatchDeTresFreelancers('Freelancers.xlsx', 'RespuestaCliente4.txt');

// Calcular métricas con los datos obtenidos
calcularMetricas(datosAlgoritmo);

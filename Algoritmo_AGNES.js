const fs = require('fs');
const xlsx = require('xlsx');

// ==========================================================================
// MÓDULO: Lectura de Datos
// ==========================================================================

// Función para leer las stopwords desde un archivo externo
function cargarStopwords(rutaArchivo) {
    try {
        const contenido = fs.readFileSync(rutaArchivo, 'utf-8'); // Lee el archivo de stopwords
        return new Set(
            contenido
                .toLowerCase()
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

const STOPWORDS = cargarStopwords('stopwords.txt');

// ===================== Diccionario de Sinónimos =====================

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

// Función para transformar cada palabra a su forma canónica usando el diccionario
function normalizarPalabra(palabra) {
    return SYNONIMOS[palabra] || palabra;
}

// Función para leer palabras clave desde Excel (TF-IDF)
function leerPalabrasClaveDesdeExcel(rutaExcel) {
    try {
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
    } catch (error) {
        console.error("Error al leer el archivo Excel:", error.message);
        return {};
    }
}

// Función para leer el texto del cliente y aplicar normalización
function leerTextoDesdeArchivo(rutaTxt) {
    try {
        const contenido = fs.readFileSync(rutaTxt, 'utf-8');
        const tokens = contenido.toLowerCase()
            .replace(/[^a-záéíóúüñ\s]/g, '') 
            .split(/\s+/)
            .map(normalizarPalabra) // Se aplica la normalización
            .filter(palabra => !STOPWORDS.has(palabra));
        console.log("=== Texto del Cliente (tokens) ===");
        console.log(tokens);
        return tokens;
    } catch (error) {
        console.error("Error al leer el archivo de texto:", error.message);
        return [];
    }
}

// Función para leer el vector del cliente desde archivo
function leerVectorDesdeArchivo(rutaTxt) {
    try {
        const contenido = fs.readFileSync(rutaTxt, 'utf-8').split('\n')[0];
        const vector = contenido.split(',').map(num => parseFloat(num.trim()));
        return vector;
    } catch (error) {
        console.error("Error al leer el archivo de texto:", error.message);
        return [];
    }
}

// Función para procesar palabras clave y aplicar sinónimos
function dividirPalabrasClave(palabras) {
    return palabras.flatMap(palabra =>
        palabra.includes(" ") ? palabra.split(" ") : palabra.match(/[a-zA-Z]+/g) || []
    )
    .map(p => normalizarPalabra(p.toLowerCase()))
    .filter(p => !STOPWORDS.has(p));
}

// ================== IMPLEMENTACIÓN MANUAL DE AGNES ================== //

// Función para calcular la distancia coseno entre dos vectores
function distanciaCoseno(a, b) {
    const productoPunto = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudA = Math.sqrt(a.reduce((sum, val) => sum + val ** 2, 0));
    const magnitudB = Math.sqrt(b.reduce((sum, val) => sum + val ** 2, 0));
    return 1 - (productoPunto / (magnitudA * magnitudB));  // Se convierte similitud a distancia
}

// Función para calcular la matriz de distancias (usando distancia coseno)
function calcularMatrizDistancias(vectores) {
    const n = vectores.length;
    const matriz = Array(n).fill().map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            matriz[i][j] = distanciaCoseno(vectores[i], vectores[j]);
            matriz[j][i] = matriz[i][j];  // La matriz es simétrica
        }
    }
    return matriz;
}

function imprimirEstadisticasDistancias(matriz) {
    const distancias = [];
    for (let i = 0; i < matriz.length; i++) {
        for (let j = i + 1; j < matriz.length; j++) {
            distancias.push(matriz[i][j]);
        }
    }
    console.log("Distancia mínima:", Math.min(...distancias).toFixed(4));
    console.log("Distancia máxima:", Math.max(...distancias).toFixed(4));
    const media = distancias.reduce((sum, d) => sum + d, 0) / distancias.length;
    console.log("Distancia media:", media.toFixed(4));
}

// Algoritmo AGNES con enlace promedio (implementación manual)
function agnesManual(matrizDistancias, k, linkageMethod = 'average') {
    let clusters = matrizDistancias.map((_, i) => [i]);  // Cada vector es un clúster inicial
    let iteration = 1;
    
    while (clusters.length > k) {
        let minimaDistancia = Infinity;
        let mejorClusterA = -1, mejorClusterB = -1;
        
        // Buscar los clusters más cercanos usando el método de enlace
        for (let i = 0; i < clusters.length; i++) {
            for (let j = i + 1; j < clusters.length; j++) {
                let distancia;
                if (linkageMethod === 'average') {
                    let distanciaTotal = 0;
                    let pares = 0;
                    for (const puntoA of clusters[i]) {
                        for (const puntoB of clusters[j]) {
                            distanciaTotal += matrizDistancias[puntoA][puntoB];
                            pares++;
                        }
                    }
                    distancia = distanciaTotal / pares;
                } else if (linkageMethod === 'complete') {
                    let maxDist = 0;
                    for (const puntoA of clusters[i]) {
                        for (const puntoB of clusters[j]) {
                            maxDist = Math.max(maxDist, matrizDistancias[puntoA][puntoB]);
                        }
                    }
                    distancia = maxDist;
                }
                if (distancia < minimaDistancia) {
                    minimaDistancia = distancia;
                    mejorClusterA = i;
                    mejorClusterB = j;
                }
            }
        }
        clusters[mejorClusterA] = clusters[mejorClusterA].concat(clusters[mejorClusterB]);
        clusters.splice(mejorClusterB, 1);
        iteration++;
    }
    return clusters;
}


// ================== FUNCIONES PRINCIPALES ================== //

// Función para leer vectores numéricos desde Excel
// Función para normalizar un vector (escala a unidad)
function normalizarVector(vector) {
    const norma = Math.sqrt(vector.reduce((sum, val) => sum + val ** 2, 0));
    return vector.map(val => val / norma);
}

// Función para leer vectores numéricos desde Excel (con normalización)
function leerVectoresDesdeExcel(rutaExcel) {
    try {
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
                    // Normalizar el vector
                    const vectorNormalizado = normalizarVector(vector);
                    freelancers[nombre] = vectorNormalizado;
                    vectores.push(vectorNormalizado);
                    nombres.push(nombre);
                }
            }
        });

        return { freelancers, vectores, nombres };
    } catch (error) {
        console.error("Error al leer el archivo Excel:", error.message);
        return { freelancers: {}, vectores: [], nombres: [] };
    }
}


// Función para clusterizar freelancers usando AGNES
function clusterizarFreelancers(vectores, nombres, k = 2) {
    const matrizDistancias = calcularMatrizDistancias(vectores);
    // Opcional: imprimir estadísticas de la matriz
    imprimirEstadisticasDistancias(matrizDistancias);
    
    // Prueba con enlace completo (puedes cambiar a 'average' si lo prefieres)
    const clusters = agnesManual(matrizDistancias, k, 'complete');
    
    // Mapear clusters a nombres de freelancers
    const asignaciones = {};
    clusters.forEach((indicesCluster, indiceCluster) => {
        indicesCluster.forEach(indiceVector => {
            const nombre = nombres[indiceVector];
            asignaciones[nombre] = indiceCluster;
        });
    });
    
    console.log("=== Asignaciones de freelancers a clusters (AGNES) ===");
    console.table(asignaciones);
    
    return asignaciones;
}


// Función para asignar el cliente al cluster más cercano
function asignarClienteACluster(vectorCliente, freelancers, asignaciones) {
    let minDistancia = Infinity;
    let clusterAsignado = null;
    
    for (const [nombre, vector] of Object.entries(freelancers)) {
        const distancia = Math.sqrt(vector.reduce((sum, val, i) => sum + (val - vectorCliente[i]) ** 2, 0));
        if (distancia < minDistancia && asignaciones[nombre] !== undefined) {
            minDistancia = distancia;
            clusterAsignado = asignaciones[nombre];
        }
    }
    
    console.log(`Cliente asignado al cluster ${clusterAsignado}`);
    return clusterAsignado;
}

// Función para calcular TF-IDF
function calcularTFIDF(freelancers, textoTokens) {
    console.log("=== Calculando TF-IDF ===");
    const ranking = [];
    for (const freelancer in freelancers) {
        const palabrasClave = freelancers[freelancer];
        if (palabrasClave.length === 0) continue;

        // Calcular TF para cada palabra clave
        const tf = palabrasClave.reduce((acc, palabra) => {
            acc[palabra] = textoTokens.filter(token => token === palabra).length / textoTokens.length;
            return acc;
        }, {});

        console.log(`TF para ${freelancer}:`, tf);

        const tfidfTotal = Object.values(tf).reduce((sum, value) => sum + value, 0);
        ranking.push({ freelancer, tfidf: tfidfTotal });
    }
    ranking.sort((a, b) => b.tfidf - a.tfidf);
    console.log("=== Ranking TF-IDF (ordenado) ===");
    console.table(ranking);
    return ranking;
}

// Función para hacer match de tres freelancers
function hacerMatchDeTres(clusterAsignado, asignaciones, rankingTFIDF) {
    console.log(`=== Haciendo Match para el Cluster ${clusterAsignado} ===`);
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

    // Seleccionar los tres mejores (o menos si no hay suficientes)
    return rankingFiltrado.slice(0, 3);
}

// Función principal para combinar AGNES, TF-IDF y Match
function generarMatchDeTresFreelancers(rutaExcel, rutaTxt, k = 3) {
    try {
        // Leer datos y vectores
        const { freelancers, vectores, nombres } = leerVectoresDesdeExcel(rutaExcel);
        const vectorCliente = leerVectorDesdeArchivo(rutaTxt);
        const asignaciones = clusterizarFreelancers(vectores, nombres, k);

        // Asignar al cliente un cluster
        const clusterAsignado = asignarClienteACluster(vectorCliente, freelancers, asignaciones);
        if (clusterAsignado === null) {
            console.log("El cliente no fue asignado a ningún cluster.");
            return { match: [], rankingTF: [], totalUsers: 0, freelancersEnCluster: [] };
        }
        console.log(`Cliente asignado al cluster ${clusterAsignado}`);

        // Calcular ranking TF-IDF y hacer match
        const freelancersPalabras = leerPalabrasClaveDesdeExcel(rutaExcel);
        const textoTokens = leerTextoDesdeArchivo(rutaTxt);
        const rankingTFIDF = calcularTFIDF(freelancersPalabras, textoTokens);
        const match = hacerMatchDeTres(clusterAsignado, asignaciones, rankingTFIDF);

        // Preparar datos para métricas
        const freelancersEnCluster = Object.keys(asignaciones).filter(
            nombre => asignaciones[nombre] === clusterAsignado
        );
        const totalUsers = Object.keys(freelancersPalabras).length;

        // Mostrar resultados finales
        console.log("\n=== Freelancers recomendados ===");
        console.log(`[${match.map(item => item.freelancer).join(', ')}]`);

        // Devolver datos para métricas
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
generarMatchDeTresFreelancers('Freelancers.xlsx', 'RespuestaCliente4.txt', 3);


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
const datosAlgoritmo = generarMatchDeTresFreelancers('Freelancers.xlsx', 'RespuestaCliente3.txt');

// Calcular métricas con los datos obtenidos
calcularMetricas(datosAlgoritmo);
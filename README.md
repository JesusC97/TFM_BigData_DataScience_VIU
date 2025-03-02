# TFM_BigData_DataScience_VIU
Repositorio TFM primera convocatoria Big Data &amp; Data Science

Este Trabajo de Fin de Máster en Ciencia de Datos se centra en el desarrollo e implementación de un sistema de recomendación para la asignación de tareas en recursos humanos. Su objetivo es optimizar la selección de trabajadores para tareas específicas, considerando no solo sus competencias técnicas, sino también su afinidad con los valores de la empresa solicitante.

Para ello, se emplean diferentes enfoques algorítmicos en clustering y recomendación, utilizando métodos como K-means, DBSCAN, AGNES y NNS. Estos algoritmos permiten estructurar de manera más eficiente la asignación de tareas, identificando similitudes entre los trabajadores y las solicitudes de empleo. Además, se exploran estrategias para la determinación óptima de parámetros en estos modelos, incluyendo el método del codo y el coeficiente de silueta, con el fin de mejorar la calidad del clustering.

El estudio busca superar las limitaciones del modelo actual, basado en n-gramas, un enfoque que no integra adaptabilidad ni afinidad personal en la asignación de tareas. Debido a que la base de datos disponible es reducida (menos de 300 registros), se descartan técnicas avanzadas como Deep Learning, priorizando modelos más eficientes en escenarios con datos limitados y ruido estructural.


El repositorio contiene diversos algoritmos enfocados en la mejora de un sistema de recomendación. Estos se dividen en tres categorías principales:

Algoritmo actual: Implementación en uso que se busca optimizar.
Propuestas desarrolladas: Algoritmos diseñados específicamente para mejorar el rendimiento del sistema.
Algoritmos preconfigurados: Modelos provenientes de módulos o librerías de Python. En encuentran en sus respectivos archivos Python.

Dentro de las propuestas desarrolladas, se incluyen algoritmos de clasterización. Para determinar los parámetros óptimos de configuración, se emplea un análisis del coeficiente de silueta. Cada algoritmo de clasterización cuenta con un archivo independiente encargado de evaluar dicho coeficiente, además del archivo que implementa el algoritmo con los parámetros óptimos.

Los datos utilizados para el sistema de recomendación están almacenados en archivos Excel:

Freelancers: Recopilados en un único archivo Excel.
Clientes: Aunque también se encuentran en Excel, los datos han sido extraídos desde archivos de texto utilizados como entrada para los algoritmos.

Además se encuentra la Lista de Stopwords: Archivo adicional para el análisis TF-IDF, utilizado en el procesamiento de texto.

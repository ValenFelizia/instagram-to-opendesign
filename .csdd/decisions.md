# Decisions

## DEC-007 — Mantener el importador como flujo local tras la prueba con Felisa

- Status: accepted for VAL-93
- Date: 2026-09-28
- Context: el primer hero con paquete respetó la identidad verificada pero repitió el collage y falló a 390 px. Un segundo hero de producto funcionó en móvil, pero la dueña lo rechazó por convencional. Dos Stories del mismo bolso, con prompt y assets idénticos, produjeron soluciones similares; la dueña prefirió la versión sin paquete.
- Decision: concluir que el paquete no mostró una mejora visual clara ni una reducción demostrada de esfuerzo en estos casos. Mantenerlo como herramienta local y revisable; no ampliar todavía a MCP. Entregar la Story manual preferida como archivo local tras sustituir la captura del bolso por la foto original del mismo producto.
- Rationale: el storefront ya proporciona tipografía, color y copy verificados, de modo que el paquete de Instagram aporta contexto, pero poco valor incremental para un brief tan fijado. La preferencia de la dueña y los errores visuales pesan más que una ejecución técnica exitosa.
- Consequence: la siguiente hipótesis es proponer varias rutas de composición y comprobar la calidad de los assets antes de generar. La pieza final requiere inspección en el editor de Instagram con el sticker nativo antes de publicarse; ningún asset real se incorpora al repositorio OSS.
- Evidence: protocolo y resultados en `docs/mvp-validation.md`; HTML, capturas y notas reales en `data/felisa_fr/validation/` ignorado por Git; feedback de la dueña en esta validación.

## DEC-006 — Habilitar el paquete en el catálogo local de OpenDesign

- Status: accepted for VAL-93
- Date: 2026-09-28
- Context: el paquete de Felisa se podía leer con `od design-systems show`, pero un proyecto nuevo rechazó `user:felisa-fr` con `DESIGN_SYSTEM_NOT_PUBLISHED` porque una carpeta de usuario sin `metadata.json` se trata como `draft`.
- Decision: el compilador escribe `metadata.json` con `status: published` junto al manifiesto. Ese estado habilita su selección en un proyecto local; las inferencias de identidad siguen siendo provisionales y revisables en `DESIGN.md` y las fuentes.
- Rationale: un paquete descubierto pero no seleccionable no cumple el flujo que VAL-92 prometió validar. La marca de catálogo no altera el análisis ni envía el paquete a un servicio público.
- Consequence: las instalaciones anteriores deben recompilarse y copiar el archivo nuevo al catálogo. La prueba de Felisa se realiza en una instancia aislada y los assets reales siguen fuera del repositorio.
- Evidence: OpenDesign `0.23.1` en daemon aislado; creación de proyecto fallida sin `metadata.json`, exitosa con `status: published`; proyecto nuevo creado desde el fixture público `user:example-studio`; 15 pruebas del importador.

## DEC-005 — Compilar paquete mínimo sin reimportación normalizadora

- Status: accepted for VAL-92
- Date: 2026-09-28
- Context: el análisis describe la identidad sin hexadecimales ni fuentes exactas, y OpenDesign requiere `tokens.css`. En la prueba real, `od design-systems import-local` reconstruyó `DESIGN.md` desde el directorio como proyecto crudo y perdió las advertencias de incertidumbre.
- Decision: generar colores candidatos con una llamada adicional limitada a gráficos propios revisados, completar los 56 tokens con valores funcionales provisionales y conservar la procedencia en `brand-analysis.json` y `source/`. Mantener el perfil mínimo sin `sourceFiles`. Para cargar el paquete precompilado en OpenDesign, instalar su carpeta en el catálogo de sistemas de usuario; no usar `import-local` como prueba de preservación del paquete.
- Rationale: mantiene visibles el análisis y sus límites en el `DESIGN.md` que lee el agente, sin inventar reglas verificadas ni asumir los requisitos del perfil rich.
- Consequence: los valores CSS requieren revisión de marca, la instalación local es distinta del importador de proyectos crudos y los datos reales permanecen fuera del repo público. La utilidad del paquete frente a una baseline se mide en VAL-93.
- Evidence: ejecución aislada de `od design-systems import-local` y `od design-systems show user:felisa-fr` con el paquete generado; [guía OpenDesign](https://github.com/nexu-io/open-design/blob/main/docs/design-systems.md).

## DEC-004 — Primer Brand Analyzer mediante visión con revisión posterior

- Status: accepted for VAL-91
- Date: 2026-09-28
- Context: la evidencia revisada de VAL-90 permite probar inferencias de marca para un perfil real, pero no confirma decisiones de la dueña de la marca.
- Decision: usar `gpt-6-luna` con razonamiento `high` mediante Responses API para un borrador de diez temas; enviar sólo imágenes y captions propios revisados. Validar esquema y referencias localmente, conservar incertidumbre y no producir estados `verified` automáticamente.
- Rationale: permite evaluar un analizador multimodal reproducible con costo acotado por una sola solicitud y un máximo de 24 imágenes, manteniendo el control de inferencias en el repositorio.
- Consequence: la ejecución real requiere `OPENAI_API_KEY` y puede generar costo; una persona debe revisar las propuestas antes de compilar el paquete OpenDesign. Los datos reales y el JSON generado permanecen ignorados por Git.
- Evidence: [modelo](https://developers.openai.com/api/docs/models/gpt-6-luna), [imágenes como entrada](https://developers.openai.com/api/docs/guides/images-vision) y [salida estructurada](https://developers.openai.com/api/docs/guides/structured-outputs).

## DEC-003 — Clasificación visual revisable en la primera validación

- Status: accepted for the first profile
- Date: 2026-09-26
- Context: VAL-90 necesita distinguir piezas gráficas de fotos de producto antes de inferir identidad. La primera validación usa 15–25 publicaciones y aún no requiere procesamiento masivo.
- Decision: generar un contact sheet e índice con etiquetas manuales `brand-graphic`, `product-photo` y `mixed`, además de rasgos visuales y grupos de composición revisables en `review.json`. Las imágenes sin revisión quedan fuera de señales confirmadas.
- Rationale: una revisión humana de un perfil pequeño permite auditar la distinción entre identidad y color incidental sin introducir una API de visión en esta etapa.
- Consequence: el procesador prepara y separa evidencia, pero completar la clasificación requiere revisión humana y no escala automáticamente a muchos perfiles. Una API de visión podrá sugerir etiquetas detrás de esta interfaz en una iteración posterior.


## DEC-002 — Ingesta mediante Apify detrás de una interfaz

- Status: accepted
- Date: 2026-09-26
- Context: VAL-89 pide obtener datos públicos sin construir un scraper propio y evaluar Apify primero.
- Decision: usar el Actor mantenido `apify/instagram-scraper` con dos ejecuciones (`details` y `posts`), encapsulado en `src/providers/apify.js`. El resto del pipeline consume un contrato normalizado, no el payload del Actor.
- Rationale: el Actor documenta ambos tipos de resultado y la API de Apify permite ejecutar, esperar y leer el dataset. Se evita una dependencia npm para mantener el primer CLI ejecutable con Node 20+.
- Consequence: la ingesta real requiere cuenta/token de Apify y puede incurrir en costo; el formato del Actor puede cambiar. Las pruebas sintéticas cubren el contrato local, pero se requiere una prueba real antes de declarar terminado VAL-89.
- Evidence: [Actor de Instagram](https://apify.com/apify/instagram-scraper) y [API v2 de Apify](https://docs.apify.com/api/v2).

## DEC-001 — Separar la inferencia del manifiesto de OpenDesign

- Status: accepted
- Date: 2026-09-26
- Context: VAL-88 requiere conservar evidencia y confianza por inferencia, mientras que el manifiesto v1 de OpenDesign rechaza claves desconocidas y describe metadatos de importación del paquete.
- Decision: mantener `brand-analysis.json` como artefacto propio del importador y usar el manifiesto de OpenDesign sin extensiones. El fixture mínimo conserva `source/evidence.md` sin declararlo mediante `sourceFiles`, porque esa declaración activa el guard del perfil rich y exige archivos adicionales.
- Rationale: preserva compatibilidad con el consumidor actual sin perder trazabilidad en el paquete fuente. La evidencia podrá indexarse en OpenDesign cuando se implemente el perfil rich completo.
- Consequence: OpenDesign no lee el análisis ni expone el archivo de evidencia no declarado en el primer fixture. El compilador posterior deberá trasladar sólo decisiones defendibles a `DESIGN.md` y `tokens.css`.
- Evidence: [`manifest.schema.ts`](https://github.com/nexu-io/open-design/blob/1b47e60bd46641469fcd8b69c496c4e3a548bc28/design-systems/_schema/manifest.schema.ts) y [`check-design-system-package-quality.ts`](https://github.com/nexu-io/open-design/blob/1b47e60bd46641469fcd8b69c496c4e3a548bc28/scripts/check-design-system-package-quality.ts).

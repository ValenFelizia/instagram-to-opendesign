# Decisions

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

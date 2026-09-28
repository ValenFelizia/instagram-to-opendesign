# Specifications

## Project Summary

El proyecto investiga si un perfil público de Instagram puede aportar evidencia suficiente para generar una identidad inicial trazable y útil para agentes de diseño, con OpenDesign como consumidor inicial. Fuente: proyecto «Instagram → OpenDesign Brand Importer» en Linear.

## Requirements

- El primer consumidor del paquete es OpenDesign. La validación del spike compara una pieza creada con el paquete frente a una baseline de imágenes y prompt manual. Fuente: descripción del proyecto en Linear y alcance indicado por el usuario.
- Las inferencias importantes de identidad deben conservar evidencia y nivel de confianza. Se debe distinguir la identidad de marca de la estética accidental de fotos o productos. Fuente: descripción del proyecto en Linear.
- El paquete de salida debe ajustarse al contrato vigente de OpenDesign y conservar assets y fuentes originales consultables. Fuente: descripción del proyecto en Linear.

## Constraints

- El trabajo inicial se prepara para publicarse como software de código abierto; el contenido del repositorio será público. Fuente: solicitud del usuario.
- El soporte para otros sistemas de diseño queda fuera del alcance inicial. Fuente: solicitud del usuario.
- No comenzar con scraper propio de Instagram, servidor MCP, SaaS o sincronización continua. Fuente: descripción del proyecto en Linear.

## Invariants

## Interfaces and Contracts

La etapa de ingesta produce `instagram-source.json` y assets locales dentro de un directorio ignorado por Git. El JSON conserva metadatos del perfil público, enlaces, publicaciones recientes, captions, URLs de origen, rutas de archivos, autor principal de cada publicación y procedencia del proveedor. Las colaboraciones presentes en el feed se conservan aunque el autor principal difiera del perfil solicitado. La interfaz del proveedor queda aislada de la normalización para poder cambiar el servicio de extracción. Fuente: VAL-89 / GitHub #2 y validación real con `@felisa_fr`.

El procesador de evidencia consume `instagram-source.json` y sus assets; produce un contact sheet, corpus de captions, `evidence.md` y un índice legible por máquina. El contact sheet toma muestras de todas las publicaciones antes de ampliar la selección con otras imágenes de carruseles. La clase visual de cada imagen (`brand-graphic`, `product-photo`, `mixed`) es una observación revisable: las imágenes sin clasificar no aportan evidencia de colores de marca. La autoría de publicaciones colaborativas se conserva y se señala en la evidencia para evitar atribuir los gráficos de terceros al perfil objetivo. Fuente: VAL-90 / GitHub #3 y validación real con `@felisa_fr`.

El Brand Analyzer consume sólo las imágenes seleccionadas, revisadas y propias del perfil (máximo 24), sus captions propios y los metadatos del perfil. Produce `brand-analysis.json` local conforme al schema v1, con diez temas fijos, confianza cualitativa, IDs de evidencia verificables y estado `inferred` o `needs-review`. Una llamada de modelo no puede establecer `verified`; color o tipografía basados sólo en fotos de producto no son inferencias aceptables. Un fallo de API o validación preserva el análisis anterior. Fuente: VAL-91 / GitHub #4 y decisión DEC-004.

El paquete nuevo para OpenDesign usa `design-systems/<slug>/manifest.json`, `DESIGN.md` y `tokens.css`. El manifiesto v1 exige `schemaVersion: od-design-system-project/v1`, un `id` igual al slug, nombre, categoría, `source` y rutas fijas a los dos archivos canónicos. El CSS final declara los 56 tokens compartidos de `TOKEN_SCHEMA`. Fuente: [`nexu-io/open-design` a `1b47e60`](https://github.com/nexu-io/open-design/tree/1b47e60bd46641469fcd8b69c496c4e3a548bc28), esquema de manifiesto, esquema de tokens y guía de authoring. El detalle operativo y sus límites están en `docs/output-contract.md`.

`brand-analysis.json` es un contrato de este importador, no un campo del manifiesto de OpenDesign. Su esquema inicial está en `schemas/brand-analysis.schema.json` y conserva valor candidato, confianza, evidencia, justificación breve y estado de revisión por inferencia. Fuente: VAL-88 y decisión técnica DEC-001.

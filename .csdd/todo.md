# TODO

## In Progress


## Ready to Land

- [ ] GitHub #13 — Informe HTML de identidad para revisar el perfil analizado.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Branch: `codex/brand-report`
  - PR: https://github.com/ValenFelizia/instagram-to-opendesign/pull/14
  - Scope: generador local reutilizable, revisión visual con Felisa y documentación pública sin datos reales.
  - Verification: 18 pruebas, HTML real local para `@felisa_fr` con 18 imágenes propias revisadas y 12 captions; render de 1440 px y 390 px sin desborde y con todas las imágenes cargadas.

- [ ] GitHub #5 / VAL-92 — Compilar paquete OpenDesign y CLI de punta a punta.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Branch: `codex/val-92-package`
  - PR: https://github.com/ValenFelizia/instagram-to-opendesign/pull/11
  - Scope: orquestador reanudable, propuestas de tokens, compilador OpenDesign, validación real y documentación.
  - Verification: 15 pruebas; paquete real de `@felisa_fr` cargado por el catálogo de OpenDesign `0.23.1` en daemon aislado, con incertidumbre conservada; segunda ejecución reutilizó etapas pagas. Datos reales y credenciales ignorados por Git.

## Blocked

## Pending

## Deferred

## Recently Completed

Retention: 5

- [x] GitHub #4 / VAL-91 — Brand Analyzer multimodal con confianza y evidencia.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Scope: released
  - Landed: `main` @ `90f453f` (PR #10)
  - Verification: 11 pruebas y ejecución real con `@felisa_fr`: 10 inferencias trazables, color y tipografía respaldados por el avatar, UI `needs-review`; datos reales locales e ignorados por Git.

- [x] GitHub #3 / VAL-90 — Evidence Processor y contact sheet visual.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Scope: released
  - Landed: `main` @ `3f538ba` (PR #8)
  - Verification: bundle real para `@felisa_fr` con 93 imágenes indexadas, 24 representantes revisados de 15 posts y 15 captions; 69 imágenes quedan sin revisión. La evidencia local está en `data/<username>/evidence/`; el paquete de #5 la ubicará en `source/`. Pasan 5 pruebas locales.

- [x] GitHub #2 / VAL-89 — Ingesta de perfil público con Apify y fuente normalizada reproducible.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Scope: released
  - Landed: `main` @ `55447f5` (PR #7)
  - Verification: Apify devolvió 15 posts públicos de `@felisa_fr` (3 con otro autor principal), 93 imágenes y 10 videos descargados; esquema `instagram-source/v1` válido. Los datos reales quedan sólo en `data/` ignorado por Git.

- [x] VAL-88 — Contrato de salida y paquete estático sintético para OpenDesign.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Scope: released
  - Landed: `main` @ `6129683`
  - Verification: parser de manifiesto de OpenDesign `1b47e60`, 56/56 tokens, schema de análisis, referencias de evidencia y archivos remotos comprobados. La prueba en una instancia de OpenDesign queda para una validación de integración posterior.

- [x] Inicializar y publicar el repositorio OSS.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Scope: released
  - Landed: `main` @ `6129683`
  - Verification: repositorio público y contenido remoto comprobados en `ValenFelizia/instagram-to-opendesign`.

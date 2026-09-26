# Decisions

## DEC-001 — Separar la inferencia del manifiesto de OpenDesign

- Status: accepted
- Date: 2026-09-26
- Context: VAL-88 requiere conservar evidencia y confianza por inferencia, mientras que el manifiesto v1 de OpenDesign rechaza claves desconocidas y describe metadatos de importación del paquete.
- Decision: mantener `brand-analysis.json` como artefacto propio del importador y usar el manifiesto de OpenDesign sin extensiones. El fixture mínimo conserva `source/evidence.md` sin declararlo mediante `sourceFiles`, porque esa declaración activa el guard del perfil rich y exige archivos adicionales.
- Rationale: preserva compatibilidad con el consumidor actual sin perder trazabilidad en el paquete fuente. La evidencia podrá indexarse en OpenDesign cuando se implemente el perfil rich completo.
- Consequence: OpenDesign no lee el análisis ni expone el archivo de evidencia no declarado en el primer fixture. El compilador posterior deberá trasladar sólo decisiones defendibles a `DESIGN.md` y `tokens.css`.
- Evidence: [`manifest.schema.ts`](https://github.com/nexu-io/open-design/blob/1b47e60bd46641469fcd8b69c496c4e3a548bc28/design-systems/_schema/manifest.schema.ts) y [`check-design-system-package-quality.ts`](https://github.com/nexu-io/open-design/blob/1b47e60bd46641469fcd8b69c496c4e3a548bc28/scripts/check-design-system-package-quality.ts).

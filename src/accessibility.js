import Ajv2020 from 'ajv/dist/2020.js';

export const accessibilityPlanSchema = {
  type: 'object', additionalProperties: false, required: ['pairs', 'motion'], properties: {
    motion: { type: 'boolean' }, pairs: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['id', 'usage', 'foreground', 'background'], properties: {
        id: { type: 'string', pattern: '^[A-Za-z0-9-]+$' }, usage: { enum: ['normal-text', 'large-text', 'control'] },
        foreground: { type: 'string', minLength: 1 }, background: { type: 'string', minLength: 1 },
      },
    } },
  },
};
const ajv = new Ajv2020();
const validate = ajv.compile(accessibilityPlanSchema);
export function validateAccessibilityPlan(plan) {
  if (!validate(plan)) throw new Error(`Invalid accessibility plan: ${ajv.errorsText(validate.errors)}`);
  if (new Set(plan.pairs.map((pair) => pair.id)).size !== plan.pairs.length) throw new Error('Duplicate contrast pair ID.');
}
export function tokenMap(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return Object.fromEntries([...clean.matchAll(/--([a-z0-9-]+)\s*:\s*([^;{}]+);/g)].map((match) => [match[1], match[2].trim()]));
}
export function resolveColor(value, tokens, seen = new Set()) {
  if (/^#[a-f0-9]{6}$/i.test(value ?? '')) return value.toLowerCase();
  const alias = /^var\(--([a-z0-9-]+)\)$/.exec(value ?? '');
  if (!alias || seen.has(alias[1])) return null;
  return resolveColor(tokens[alias[1]], tokens, new Set([...seen, alias[1]]));
}
export function contrastRatio(a, b) {
  const luminance = (hex) => hex.slice(1).match(/../g).map((part) => parseInt(part, 16) / 255)
    .map((n) => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4)
    .reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + .05) / (lo + .05);
}

// A token preflight is not a rendered WCAG audit. Undeclared usage stays unknown.
export function accessibilityPreflight({ tokens = {}, plan, request, assets = [] } = {}) {
  if (plan) validateAccessibilityPlan(plan);
  const checks = [];
  const add = (id, status, instruction, extra = {}) => checks.push({ id, status, instruction, ...extra });
  if (!plan?.pairs.length) add('color-usage', 'manual-review', 'Declare actual foreground/background usage; a palette alone cannot establish contrast.');
  for (const pair of plan?.pairs ?? []) {
    const foreground = resolveColor(pair.foreground, tokens), background = resolveColor(pair.background, tokens);
    const threshold = pair.usage === 'normal-text' ? 4.5 : 3;
    if (!foreground || !background) {
      add(pair.id, 'manual-review', 'Resolve the actual rendered colors; photographs, gradients, missing tokens and circular aliases cannot pass.', { usage: pair.usage, threshold });
      continue;
    }
    const ratio = contrastRatio(foreground, background), pass = ratio >= threshold;
    const alternatives = ['#171717', '#ffffff'].filter((color) => contrastRatio(color, background) >= threshold);
    add(pair.id, pass ? 'pass' : 'fail', pass ? 'Declared solid-color pair meets its threshold; verify the declared use in the render.'
      : 'Review an accessible foreground or separate text surface. Preserve confirmed identity colors until a person approves a usage change.',
    { usage: pair.usage, foreground, background, ratio, threshold, alternatives: pass ? [] : alternatives });
  }
  for (const asset of assets) {
    const alt = asset.use?.alt ?? asset.alt;
    const fail = alt?.usage === 'informative' && !alt.text?.trim() || alt?.usage === 'decorative' && !!alt.text;
    add(`alt-${asset.id}`, fail ? 'fail' : 'manual-review', 'Check the image purpose in this composition; informative images need useful alternatives, decorative images empty alternatives. A filename or catalog description is not a contextual review.');
  }
  const web = !request || ['web-hero', 'website-change'].includes(request.kind);
  const tasks = web ? {
    keyboard: 'Tab through every control; activate links and buttons with the keyboard, including any dialogs.',
    focus: 'Verify visible focus remains unobscured, including beneath sticky headers and overlays.',
    semantics: 'Review heading hierarchy, landmarks, accessible names and screen-reader reading order.',
    resize: 'Check text at 200% and reflow at 320 CSS px; verify mobile reading order and no clipping or overlap.',
  } : {
    description: 'Supply an equivalent text description/transcript with the exported artwork; review reading order and small-screen legibility.',
  };
  for (const [id, instruction] of Object.entries(tasks)) add(id, 'manual-review', instruction);
  if (request?.kind === 'instagram-story') add('sticker', 'manual-review', 'Check the reserved sticker space, destination and copy in Instagram composer before publishing.');
  if (plan?.motion) add('motion', 'manual-review', 'Review reduced-motion behavior, pausing and flashing in the rendered design.');
  return { schemaVersion: 'accessibility-preflight/v1', status: checks.some((check) => check.status === 'fail') ? 'fail'
    : checks.some((check) => check.status === 'manual-review') ? 'manual-review' : 'pass',
    scope: 'Declared color usage and input checks; no certification of the rendered design.', checks };
}
export function accessibilityMarkdown(report, { lang = 'es' } = {}) {
  if (!['es', 'en'].includes(lang)) throw new Error('Accessibility report language must be es or en.');
  const es = lang === 'es';
  const translated = (check) => {
    if (!es) return check.instruction;
    if (check.usage) return check.status === 'manual-review' ? 'Revisar los colores reales: fotos, degradados y tokens sin resolver requieren comprobación en el diseño.'
      : check.status === 'pass' ? 'El par sólido declarado alcanza el umbral. Verificar su uso y tamaño en el diseño.'
      : 'Revisar un primer plano accesible o una superficie separada para el texto. Mantener los colores confirmados hasta que una persona apruebe el cambio de uso.';
    if (check.id.startsWith('alt-')) return 'Revisar la función de la imagen: las informativas necesitan una alternativa útil y las decorativas una alternativa vacía. La descripción del catálogo no confirma el uso en esta composición.';
    return {
      'color-usage': 'Declarar las combinaciones reales de texto, controles y fondos; una paleta sola no demuestra contraste.',
      keyboard: 'Recorrer y activar todos los controles con teclado, incluidos los diálogos.',
      focus: 'Comprobar que el foco sea visible y no quede oculto por cabeceras fijas u otras capas.',
      semantics: 'Revisar títulos, regiones, nombres accesibles y orden de lectura con lector de pantalla.',
      resize: 'Revisar el texto al 200% y la redistribución a 320 px CSS, sin recortes ni superposiciones.',
      description: 'Acompañar el arte exportado con una descripción o transcripción equivalente; revisar lectura y legibilidad en pantallas pequeñas.',
      sticker: 'Revisar espacio reservado, destino y texto del sticker en el editor de Instagram antes de publicar.',
      motion: 'Revisar movimiento reducido, pausas y destellos en el diseño renderizado.',
    }[check.id] ?? 'Revisión manual pendiente.';
  };
  const labels = es ? { pass: 'Pasa', fail: 'Falla', 'manual-review': 'Revisión manual' } : { pass: 'Pass', fail: 'Fail', 'manual-review': 'Manual review' };
  return `# ${es ? 'Control previo de accesibilidad' : 'Accessibility preflight'}\n\n${labels[report.status]}\n\n` +
    `${es ? 'Se evaluaron los usos declarados. La accesibilidad del diseño renderizado sigue pendiente.' : report.scope}\n\n` +
    report.checks.map((check) => `- **${check.id}: ${labels[check.status]}**${check.ratio ? ` — ${check.ratio.toFixed(2)}:1 / ${check.threshold}:1` : ''}. ${translated(check)}${check.alternatives?.length ? ` ${es ? 'Alternativas para revisar' : 'Alternatives to review'}: ${check.alternatives.join(', ')}.` : ''}`).join('\n') + '\n';
}

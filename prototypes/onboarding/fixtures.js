/* Entirely authored example: not extracted from a real account or business. */
globalThis.OnboardingFixture = Object.freeze({
  name: 'Taller Nube', handle: '@example_studio', category: 'Cerámica de autor',
  biography: 'Objetos cotidianos, hechos despacio. Cerámica en pequeñas series.',
  assets: [
    { id: 'E-MARK-DEMO', title: 'La marca', file: 'assets/mark.svg', alt: 'Marca ficticia Taller Nube con una nube sobre fondo verde.', caption: 'El nombre y el símbolo se repiten en la muestra.', kind: 'brand-graphic' },
    { id: 'E-CUP-DEMO', title: 'La taza de todos los días', file: 'assets/cup.svg', alt: 'Ilustración ficticia de una taza verde sobre una mesa clara.', caption: 'Una forma simple, esmalte verde y una escena cotidiana.', kind: 'product-photo' },
    { id: 'E-VASE-DEMO', title: 'Piezas en proceso', file: 'assets/vase.svg', alt: 'Ilustración ficticia de un jarrón de arcilla y una rama.', caption: 'La muestra deja ver el material y el proceso.', kind: 'product-photo' },
  ],
  signals: [
    { title: 'Hecho en pequeñas series', status: 'En la muestra', text: 'El proceso manual y los objetos cotidianos aparecen como parte del relato.', source: '«Objetos cotidianos, hechos despacio. Cerámica en pequeñas series.»', sourceLabel: 'Biografía ficticia', id: 'I-VOICE-DEMO' },
    { title: 'Una voz tranquila y cercana', status: 'Inferencia', text: 'Frases breves, foco en el uso diario y una forma de contar sin apuro.', source: '«Una taza para ese primer rato del día.»', sourceLabel: 'Texto ficticio de una publicación', id: 'I-TONE-DEMO' },
    { title: 'El objeto, con espacio alrededor', status: 'Propuesta', text: 'Una composición editorial podría trasladar esa calma a una landing o una pieza promocional.', source: 'Las dos ilustraciones de producto de esta demostración.', sourceLabel: 'Referencia visual ficticia', id: 'I-COMPOSITION-DEMO' },
  ],
  tasks: [
    { id: 'instagram-story', number: '01', name: 'Historia de producto', description: 'Una idea clara para una pieza vertical.', label: 'Instagram Story', objective: 'Presentar una pieza de cerámica y abrir una conversación.' },
    { id: 'promotional-image', number: '02', name: 'Imagen promocional', description: 'Un producto, un mensaje y una intención.', label: 'Imagen promocional', objective: 'Explorar una imagen promocional para una pequeña colección.' },
    { id: 'conceptual-landing', number: '03', name: 'Primera landing', description: 'Imaginar cómo podría verse su sitio.', label: 'Landing conceptual', objective: 'Explorar una primera landing para el estudio ficticio.' },
    { id: 'website-change', number: '04', name: 'Mejorar un sitio', description: 'Trabajar con su diseño y código actuales.', label: 'Cambio de sitio', objective: 'Explorar una mejora visual manteniendo el contexto del sitio existente.' },
  ],
});

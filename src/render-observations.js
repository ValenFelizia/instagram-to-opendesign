// Read-only collector for the rendered document. Run at every recorded viewport.
// Keep collection separate from evaluation: screenshots alone do not provide DOM facts.
export function collectRenderObservations() {
  const rect = (element) => {
    const box = element.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  };
  const visible = (element) => {
    if (!element.getBoundingClientRect().width || !element.getBoundingClientRect().height) return false;
    for (let node = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    }
    return true;
  };
  const hex = (color) => {
    const rgb = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(color);
    return rgb ? '#' + rgb.slice(1).map((n) => Number(n).toString(16).padStart(2, '0')).join('') : null;
  };
  const background = (element) => {
    let result = null;
    for (let node = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.backgroundImage !== 'none') return null;
      if (!result && style.backgroundColor !== 'rgba(0, 0, 0, 0)') {
        result = hex(style.backgroundColor); if (!result) return null;
      }
    }
    return result; // Default canvas color, images and compositing remain unknown.
  };
  const copy = [...document.querySelectorAll('[data-copy-id]')].map((node) => {
    const style = getComputedStyle(node);
    return { id: node.getAttribute('data-copy-id'), text: node.innerText, visible: visible(node), rect: rect(node),
      foreground: hex(style.color), background: background(node), fontSize: parseFloat(style.fontSize), fontWeight: parseInt(style.fontWeight) || 400 };
  });
  const assets = [...document.querySelectorAll('img[data-asset-id]')].map((node) => ({
    id: node.getAttribute('data-asset-id'), src: node.getAttribute('src'), visible: visible(node), rect: rect(node),
    fit: getComputedStyle(node).objectFit, alt: node.getAttribute('alt'),
  }));
  const actionNode = document.querySelector('[data-action]');
  let occluded = null;
  if (actionNode) {
    const box = actionNode.getBoundingClientRect(), x = box.x + box.width / 2, y = box.y + box.height / 2;
    if (x >= 0 && x < window.innerWidth && y >= 0 && y < window.innerHeight) occluded = !actionNode.contains(document.elementFromPoint(x, y));
  }
  const action = actionNode ? { tag: actionNode.tagName.toLowerCase(), label: actionNode.innerText,
    href: actionNode.getAttribute('href'), visible: visible(actionNode), occluded, rect: rect(actionNode) } : null;
  return { schemaVersion: 'render-observations/v1', viewport: { width: window.innerWidth, height: window.innerHeight },
    visibleText: document.body.innerText, overflow: document.documentElement.scrollWidth > window.innerWidth,
    copy, assets, action };
}

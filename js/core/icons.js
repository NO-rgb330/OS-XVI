export function iconHTML(id, size = 16) {
  return `<svg class="icon" style="width:${size}px;height:${size}px" aria-hidden="true"><use href="#i-${id}"/></svg>`;
}

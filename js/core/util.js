/* Small pure helpers shared across the shell and apps. */

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape text for safe use in innerHTML (text and quoted attributes). */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const joinPath = (dir, name) => (dir === '/' ? '' : dir) + '/' + name;

export function parentPath(p) {
  const i = p.lastIndexOf('/');
  return i <= 0 ? '/' : p.slice(0, i);
}

export const baseName = (p) => p.slice(p.lastIndexOf('/') + 1);

export function extOf(name) {
  const i = name.lastIndexOf('.');
  return i <= 0 ? '' : name.slice(i + 1).toLowerCase();
}

export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return parseFloat((bytes / 1024 ** i).toFixed(1)) + ' ' + units[i];
}

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' });
export const formatDate = (ts) => (ts ? dateFmt.format(ts) : '');

/** Returns an error message if `name` is not a valid file/folder name, else null. */
export function nameError(name) {
  if (!name) return 'Name cannot be empty.';
  if (name.includes('/')) return 'Name cannot contain "/".';
  if (name === '.' || name === '..') return `"${name}" is not a valid name.`;
  if (name.length > 255) return 'Name is too long.';
  return null;
}

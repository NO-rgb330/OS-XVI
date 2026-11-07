async function loadDoc(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load');
    return await res.text();
  } catch (e) {
    console.error(e);
    return '# Error\nCould not load the cheat sheet.';
  }
}

let pyDoc = null;
let webDoc = null;

export async function getPythonDoc() {
  if (!pyDoc) pyDoc = await loadDoc('js/python_cheat_sheet.txt');
  return pyDoc;
}

export async function getWebDoc() {
  if (!webDoc) webDoc = await loadDoc('js/web_cheat_sheet.txt');
  return webDoc;
}

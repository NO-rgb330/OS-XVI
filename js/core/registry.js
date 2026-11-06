const apps = new Map();

export function register(app) { apps.set(app.id, app); }
export function get(id) { return apps.get(id); }
export function list() { return [...apps.values()]; }

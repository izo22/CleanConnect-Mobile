// Copies the SVG icons next to the compiled files, where n8n looks for them.
import { cpSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
for (const root of ["credentials", "nodes"]) for (const f of walk(root)) if (f.endsWith(".svg")) cpSync(f, join("dist", f));

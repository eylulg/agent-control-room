// Fails when the chunk every visitor loads grows past its budget, so an editor or a library import cannot slip into it unnoticed.
import { readFileSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";

const BUDGET_KB = 160;

const html = readFileSync("dist/index.html", "utf8");
const entry = /src="[^"]*\/assets\/(index-[^"]+\.js)"/.exec(html)?.[1];
if (!entry) {
    console.error("Could not find the entry script in dist/index.html.");
    process.exit(1);
}
const preloaded = [...html.matchAll(/rel="modulepreload"[^>]*href="[^"]*\/assets\/([^"]+\.js)"/g)].map((match) => match[1]);
const files = [entry, ...preloaded].filter((file) => readdirSync("dist/assets").includes(file));
const kb = files.reduce((sum, file) => sum + gzipSync(readFileSync(`dist/assets/${file}`)).length, 0) / 1000;

console.log(`First load JavaScript: ${kb.toFixed(1)} kB gzip in ${files.length} file(s), budget ${BUDGET_KB} kB.`);
if (kb > BUDGET_KB) {
    console.error("Over budget. Check what the entry chunk now imports.");
    process.exit(1);
}

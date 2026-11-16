// Turns the demo build (dist-demo/demo.html + assets) into ONE self-contained HTML file.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist-demo');
const html = fs.readFileSync(path.join(dist, 'demo.html'), 'utf8');

const jsFile = html.match(/<script[^>]+src="([^"]+\.js)"[^>]*><\/script>/);
const cssFile = html.match(/<link[^>]+href="([^"]+\.css)"[^>]*>/);
if (!jsFile || !cssFile) throw new Error('Could not find the built JS/CSS in dist-demo/demo.html');

const read = (rel) => fs.readFileSync(path.join(dist, rel), 'utf8');
// A closing script tag or an HTML comment opener inside inline JS would end the script early
const js = read(jsFile[1]).replaceAll('</script', '<\\/script').replaceAll('<!--', '<\\!--');
const css = read(cssFile[1]);

const page = html
  .replace(cssFile[0], () => `<style>${css}</style>`)
  .replace(jsFile[0], '')
  .replace('</body>', () => `<script type="module">${js}</script>\n  </body>`);

const out = path.join(dist, 'cineverse-3d-demo.html');
fs.writeFileSync(out, page);
console.log(`Standalone demo written to ${path.relative(process.cwd(), out)} (${(page.length / 1024).toFixed(0)} KB)`);

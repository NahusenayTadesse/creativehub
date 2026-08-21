/**
 * Fails if `build/` is not self-contained.
 *
 * The deploy copies `build/` to the server and nothing else — there are no
 * `node_modules` there. So a dependency Vite leaves as a bare import is not a
 * warning, it is a 500 on every route that reaches it, and only on those
 * routes. `@internationalized/date` sat in the bundle that way for weeks:
 * public pages were fine, and every signed-in form page was failing, because
 * the date pickers inside `InputComp` pulled it in.
 *
 * Nothing in `npm run build` catches that, and nothing in a smoke test of the
 * homepage catches it either. This does, before the build is shipped.
 *
 *   npm run verify:build
 */
import fs from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';

const SERVER_DIR = 'build/server';

/**
 * Left alone deliberately.
 *
 * Optional peer dependencies that the driver stack requires *dynamically* and
 * catches when absent — importing them is a probe, not a need.
 */
const ALLOWED = new Set(['@opentelemetry/api', 'bluebird']);

const BUILTINS = new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`)]);

if (!fs.existsSync(SERVER_DIR)) {
	console.error(`✗ ${SERVER_DIR} does not exist — run \`npm run build\` first.`);
	process.exit(1);
}

/** `import 'x'`, `import { a } from 'x'`, `import * as a from 'x'`, `export … from 'x'`. */
const IMPORT = /(?:^|\n)\s*(?:import|export)\s*(?:[\w*{}\s,$]*?\s*from\s*)?['"]([^'"]+)['"]/g;

/** `@scope/name/deep` → `@scope/name`; `name/deep` → `name`. */
const packageOf = (specifier: string) =>
	specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];

const walk = function* (dir: string): Generator<string> {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) yield* walk(full);
		else if (entry.isFile() && full.endsWith('.js')) yield full;
	}
};

const offenders = new Map<string, Set<string>>();

for (const file of walk(SERVER_DIR)) {
	const source = fs.readFileSync(file, 'utf8');
	for (const match of source.matchAll(IMPORT)) {
		const specifier = match[1];
		if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('#')) {
			continue;
		}
		if (BUILTINS.has(specifier)) continue;

		const pkg = packageOf(specifier);
		if (ALLOWED.has(pkg)) continue;

		if (!offenders.has(pkg)) offenders.set(pkg, new Set());
		offenders.get(pkg)!.add(path.relative(SERVER_DIR, file));
	}
}

if (offenders.size === 0) {
	console.log('✓ build/server is self-contained — no bare imports outside Node builtins.');
	process.exit(0);
}

console.error('\n✗ build/server imports packages that will not exist on the server:\n');
for (const [pkg, files] of [...offenders].sort()) {
	const shown = [...files].sort().slice(0, 4);
	console.error(`  ${pkg}  (${files.size} file${files.size === 1 ? '' : 's'})`);
	for (const file of shown) console.error(`      ${file}`);
	if (files.size > shown.length) console.error(`      … and ${files.size - shown.length} more`);
}
console.error(
	'\nAdd them to `ssr.noExternal` in vite.config.ts so they are bundled, or to' +
		'\n`ALLOWED` in this script if the import is a dynamic probe that is caught.\n'
);
process.exit(1);

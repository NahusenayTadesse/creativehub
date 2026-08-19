/**
 * Production entry point.
 *
 * `build/index.js` (adapter-node's own server) would normally be enough, but
 * OpenLiteSpeed's reverse proxy forwards the client's `Origin` header *and*
 * appends a second copy of its own:
 *
 *     origin: https://srv1912542.hstgr.cloud      <- sent by the browser
 *     Origin: https://srv1912542.hstgr.cloud      <- added by LiteSpeed
 *
 * Node collapses duplicate headers into one comma-joined value, so SvelteKit's
 * CSRF guard compares "https://site, https://site" against url.origin, never
 * matches, and rejects every form POST with 403 "Cross-site POST form
 * submissions are forbidden".
 *
 * We keep the FIRST value, which is the one the browser actually sent, so a
 * genuine cross-site submission is still rejected. Dropping the check
 * altogether (csrf.checkOrigin: false) would have hidden the bug instead.
 */
import http from 'node:http';
import { handler } from './build/handler.js';

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';

/** @param {import('node:http').IncomingMessage} req */
function undouble_origin(req) {
	const origin = req.headers.origin;
	if (typeof origin === 'string' && origin.includes(',')) {
		req.headers.origin = origin.split(',')[0].trim();
	}
}

const server = http.createServer((req, res) => {
	undouble_origin(req);
	handler(req, res, () => {
		res.statusCode = 404;
		res.end('Not Found');
	});
});

server.listen(port, host, () => {
	console.log(`Listening on http://${host}:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.on(signal, () => server.close(() => process.exit(0)));
}

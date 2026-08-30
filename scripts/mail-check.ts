/**
 * Answers "is the mail configuration right?" without waiting for a real message
 * to fail quietly.
 *
 * Two steps, and they fail differently. `verify()` opens the connection and
 * authenticates, which is where a wrong host, a blocked port, a certificate
 * that does not match the hostname, or a mistyped mailbox shows up. Sending is
 * the second question — a server can accept your password and still refuse the
 * From address you asked to send as.
 *
 *   npm run mail:check                 # connect and authenticate only
 *   npm run mail:check -- you@host.tld # and send one message there
 *
 * This deliberately builds its own transport from `process.env` rather than
 * importing `$lib/server/mail`, which is a SvelteKit module and cannot be
 * loaded outside the app. Keep the two in step: the options below are the ones
 * that matter for reaching the server at all.
 */
import 'dotenv/config';
import nodemailer from 'nodemailer';

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, SMTP_TLS_SERVERNAME } =
	process.env;

const missing = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD'].filter((k) => !process.env[k]);
if (missing.length) throw new Error(`Not set: ${missing.join(', ')}`);

const port = Number(SMTP_PORT || 465);

console.log(`→ ${SMTP_USER} at ${SMTP_HOST}:${port}${port === 465 ? ' (implicit TLS)' : ''}`);
if (SMTP_TLS_SERVERNAME) console.log(`  certificate checked against ${SMTP_TLS_SERVERNAME}`);

const transport = nodemailer.createTransport({
	host: SMTP_HOST,
	port,
	secure: port === 465,
	requireTLS: port !== 465,
	auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
	tls: SMTP_TLS_SERVERNAME ? { servername: SMTP_TLS_SERVERNAME } : undefined,
	connectionTimeout: 15_000,
	greetingTimeout: 15_000
});

try {
	await transport.verify();
	console.log('✓ connected and authenticated');
} catch (err) {
	const e = err as { code?: string; response?: string; message: string };
	console.error(`✗ ${e.code ?? 'ERROR'}: ${e.response ?? e.message}`);
	/* The two that are almost always a typo rather than an outage. */
	if (e.code === 'EAUTH') console.error('  Check SMTP_USER and SMTP_PASSWORD.');
	if (e.message?.includes("cert's altnames")) {
		console.error('  Set SMTP_TLS_SERVERNAME to a name the certificate covers.');
	}
	process.exit(1);
}

const to = process.argv[2];
if (!to) {
	console.log('  (pass an address to send a test message: npm run mail:check -- you@host.tld)');
	transport.close();
	process.exit(0);
}

try {
	const info = await transport.sendMail({
		from: SMTP_FROM || SMTP_USER,
		to,
		subject: 'Mail check',
		text: 'If you are reading this, outgoing mail works.'
	});
	console.log(`✓ accepted for ${info.accepted.join(', ') || to} — ${info.response}`);
} catch (err) {
	const e = err as { code?: string; response?: string; message: string };
	console.error(`✗ send refused — ${e.response ?? e.message}`);
	console.error('  A server that accepts the password can still refuse the From address.');
	process.exit(1);
}

transport.close();

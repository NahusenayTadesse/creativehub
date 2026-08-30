import { env } from '$env/dynamic/private';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * Getting a message out of the building.
 *
 * Everything above this file decides *whether* to write to somebody —
 * `domain/notify.ts` holds that policy — and hands the finished words down.
 * This one owns the connection, the envelope and the wrapper the words are
 * rendered into, and it is the only place that knows mail can fail.
 *
 * Nothing here throws. A send is a side effect of an action the reader already
 * completed: the booking moved, the password was reset, the row is written. A
 * mail server that is down is our problem, not theirs, and turning it into a
 * failed form submission would lose work that had already succeeded.
 */

/**
 * Whether there is anywhere to send.
 *
 * Read once, at start-up, and all four parts are required: a transport built
 * from half a configuration does not fail at `createTransport`, it fails on the
 * first send, one message at a time, in a log nobody is reading. An environment
 * without the set simply has no mail, and `sendMail` says so once instead.
 */
const host = env.SMTP_HOST;
const port = Number(env.SMTP_PORT || 465);
const user = env.SMTP_USER;
const pass = env.SMTP_PASSWORD;

export const mailEnabled = Boolean(host && user && pass && Number.isFinite(port));

/** The From line. Falls back to the authenticating mailbox, which every server accepts. */
const from = env.SMTP_FROM || user || '';

let transport: Transporter | null = null;
let warned = false;

/**
 * The connection, built on first use and kept.
 *
 * `pool` because these arrive in bursts — one action can notify both sides of a
 * booking — and a fresh TLS handshake per message is the slow part. Building it
 * lazily rather than at import keeps `vite build` and every unit test that
 * touches this module from opening a socket.
 */
function getTransport(): Transporter | null {
	if (!mailEnabled) return null;
	if (transport) return transport;

	transport = nodemailer.createTransport({
		host,
		port,
		/* 465 is implicit TLS; anything else starts in the clear and upgrades. */
		secure: port === 465,
		requireTLS: port !== 465,
		auth: { user, pass },
		/*
		 * The name the certificate is verified against, when it differs from the
		 * name we connect to.
		 *
		 * Shared hosting routinely points `mail.<domain>` at a box holding a
		 * certificate for the hosting provider's own domain, so strict
		 * verification fails on the altnames before authentication is attempted.
		 * Overriding the servername keeps verification switched fully on and
		 * merely checks it against a name the certificate actually carries;
		 * `rejectUnauthorized: false`, the usual advice, would instead accept
		 * any certificate from anyone sitting in the path.
		 */
		tls: env.SMTP_TLS_SERVERNAME ? { servername: env.SMTP_TLS_SERVERNAME } : undefined,
		pool: true,
		maxConnections: 2,
		connectionTimeout: 15_000,
		greetingTimeout: 15_000
	});

	return transport;
}

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ */

/**
 * A message, described rather than marked up.
 *
 * Call sites pass words and at most one thing to click. They do not pass HTML:
 * the wrapper is the same for every message the site sends, and a caller that
 * could style its own would eventually be the one that renders an unescaped
 * campaign title into somebody's inbox.
 */
export type MailContent = {
	/** The subject line, reused as the heading unless `heading` overrides it. */
	subject: string;
	heading?: string;
	/** One paragraph per entry, plain text. Escaped on the way into the HTML. */
	body: string[];
	/** The single call to action, if the message has one. */
	action?: { label: string; url: string };
	/** Small print under the button — why this arrived, what to do if it wasn't you. */
	footnote?: string;
};

const escape = (value: string) =>
	value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Turns a site-relative path into something clickable from an inbox.
 *
 * Every link we send has to be absolute, and `ORIGIN` is the value the rest of
 * the app already trusts for this — better-auth signs cookies against it and
 * adapter-node checks form posts against it, so a wrong one is visible long
 * before it reaches a mail template.
 */
export function absoluteUrl(path: string): string {
	if (/^https?:\/\//i.test(path)) return path;
	const origin = (env.ORIGIN || '').replace(/\/$/, '');
	return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * The wrapper.
 *
 * Deliberately plain: a table, inline styles, no external stylesheet and no
 * image. Mail clients strip most of what a browser would honour, and a message
 * that arrives as unstyled text still reads correctly, which is the property
 * worth protecting. The palette is hard-coded rather than read from the theme
 * because there is no `:root` in an inbox to read it from.
 */
function render(content: MailContent, siteName: string) {
	const heading = content.heading ?? content.subject;
	const paragraphs = content.body.filter(Boolean);

	const text = [
		heading,
		'',
		...paragraphs,
		...(content.action ? ['', `${content.action.label}: ${content.action.url}`] : []),
		...(content.footnote ? ['', content.footnote] : []),
		'',
		'—',
		siteName
	].join('\n');

	const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f4f2;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border:2px solid #111111;border-radius:16px;">
<tr><td style="padding:28px 28px 8px;">
<p style="margin:0 0 18px;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#666666;">${escape(siteName)}</p>
<h1 style="margin:0 0 16px;font-size:20px;font-weight:800;color:#111111;">${escape(heading)}</h1>
${paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#333333;">${escape(p)}</p>`).join('\n')}
${
	content.action
		? `<p style="margin:24px 0 8px;"><a href="${escape(content.action.url)}" style="display:inline-block;padding:12px 20px;background:#111111;color:#ffffff;text-decoration:none;border-radius:12px;font-size:13px;font-weight:800;">${escape(content.action.label)}</a></p>
<p style="margin:0 0 8px;font-size:11px;line-height:1.5;color:#888888;word-break:break-all;">${escape(content.action.url)}</p>`
		: ''
}
${content.footnote ? `<p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#777777;">${escape(content.footnote)}</p>` : ''}
</td></tr>
<tr><td style="padding:16px 28px 24px;border-top:1px solid #eeeeee;">
<p style="margin:0;font-size:11px;color:#999999;">${escape(siteName)}</p>
</td></tr>
</table>
</body></html>`;

	return { text, html };
}

/* ------------------------------------------------------------------ *
 * Sending
 * ------------------------------------------------------------------ */

/**
 * Sends, and resolves either way.
 *
 * The promise is the *attempt*, not the delivery — it settles once the server
 * has taken the message, and it settles to `false` rather than rejecting when
 * anything goes wrong. Callers are expected to ignore the result; it is
 * returned for the two places that genuinely want to know (a test, and the
 * admin mail check).
 */
export async function sendMail(
	to: string | null | undefined,
	content: MailContent,
	siteName = 'Creator Network'
): Promise<boolean> {
	if (!to) return false;

	const mailer = getTransport();
	if (!mailer) {
		/* Once per process. This is a deployment fact, not an event, and one
		   line per attempted message would bury everything else in the log. */
		if (!warned) {
			warned = true;
			console.warn('[mail] SMTP is not configured — no mail will be sent.');
		}
		return false;
	}

	const { text, html } = render(content, siteName);

	try {
		await mailer.sendMail({ from, to, subject: content.subject, text, html });
		return true;
	} catch (err) {
		/* The recipient address is logged; the body is not. Whatever went wrong
		   with the connection is not worth a copy of somebody's message. */
		console.error(`[mail] send to ${to} failed:`, err instanceof Error ? err.message : err);
		return false;
	}
}

/**
 * Opens a connection and authenticates, without sending anything.
 *
 * For the admin diagnostics page and for `npm run mail:check` — the two moments
 * where "is the configuration right?" is the actual question, and waiting for a
 * real message to fail silently is a poor way to answer it.
 */
export async function verifyMail(): Promise<{ ok: boolean; error?: string }> {
	const mailer = getTransport();
	if (!mailer) return { ok: false, error: 'SMTP is not configured.' };

	try {
		await mailer.verify();
		return { ok: true };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : String(err) };
	}
}

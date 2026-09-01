import * as m from '$lib/paraglide/messages';
import { fail } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import * as t from '$lib/server/db/schema';
import { requireRole, recordAudit } from '$lib/server/guards';
import {
	trendingConfigSchema,
	trendingOverrideSchema,
	trendingOverrideRemove,
	trendingRunSchema
} from '$lib/schemas';
import {
	TRENDING_DEFAULTS,
	buildBoard,
	ensureTrendingConfig,
	getTrendingConfigValues,
	laneBoardOf,
	listPublishedLanes,
	listTrendingBoard,
	listTrendingCooldowns,
	listTrendingOverrides,
	listTrendingRuns,
	loadCooldowns,
	runTrending,
	type TrendingConfigValues
} from '$lib/server/trending-service';

/**
 * The trending control room.
 *
 * Two things this page is careful about. The preview runs the real ranking
 * function against the *unsaved* form values and writes nothing, so an
 * operator can see what a weight change would do before the homepage does.
 * And saving republishes immediately unless the board is frozen — settings
 * that are saved but not applied are the surest way to make an algorithm
 * screen untrustworthy.
 */

/** The picker on the overrides form: every profile that can be on the board. */
const listPickableCreators = () =>
	db
		.select({
			id: t.creators.id,
			username: t.creators.username,
			fullName: t.creators.fullName,
			isPublished: t.creators.isPublished
		})
		.from(t.creators)
		.where(and(eq(t.creators.isActive, true), isNull(t.creators.deletedAt)))
		.orderBy(asc(t.creators.fullName));

export const load: PageServerLoad = async () => {
	const config = await getTrendingConfigValues();
	const [form, overrideForm, runForm, board, lanes, overrides, runs, cooldowns, creators] =
		await Promise.all([
			superValidate(config, zod4(trendingConfigSchema)),
			superValidate(zod4(trendingOverrideSchema)),
			superValidate(zod4(trendingRunSchema)),
			listTrendingBoard(),
			/* Published in the run order, not the reader's: this screen is where
			   an operator checks what was built, and a board that reordered
			   itself around whoever opened it could not be checked at all. */
			listPublishedLanes(),
			listTrendingOverrides(),
			listTrendingRuns(),
			listTrendingCooldowns(),
			listPickableCreators()
		]);

	return {
		form,
		overrideForm,
		runForm,
		config,
		board,
		lanes,
		overrides,
		runs,
		cooldowns,
		creators,
		defaults: TRENDING_DEFAULTS
	};
};

/** The submitted knobs, complete enough for the ranking to run on. */
const valuesOf = (data: Record<string, unknown>): TrendingConfigValues =>
	({ ...TRENDING_DEFAULTS, ...data }) as TrendingConfigValues;

/** A ranked row, trimmed to what the table renders. */
export type PreviewRow = ReturnType<typeof toPreviewRow>;

function toPreviewRow(entry: Awaited<ReturnType<typeof buildBoard>>['ranked'][number]) {
	return {
		creatorId: entry.creatorId,
		rank: entry.rank,
		username: entry.candidate.username,
		fullName: entry.candidate.fullName,
		avatar: entry.candidate.avatar,
		countryName: entry.candidate.countryName,
		city: entry.candidate.city,
		verificationLevel: entry.candidate.verificationLevel,
		followers: entry.candidate.followers,
		source: entry.source,
		score: entry.score,
		baseScore: entry.baseScore,
		multiplier: entry.multiplier,
		note: entry.note,
		components: entry.scored?.components ?? [],
		values: entry.candidate.values
	};
}

/** What `?/preview` hands back — a dry run, written nowhere. */
export type TrendingPreview = {
	stats: Awaited<ReturnType<typeof buildBoard>>['stats'];
	rows: PreviewRow[];
	/** The lanes these settings would publish, in the order they would sit in. */
	lanes: { kind: string; label: string; size: number }[];
	entering: string[];
	leaving: string[];
};

/** Blank means "no expiry"; a date means the end of that day. */
const parseExpiry = (value: string): Date | null => {
	if (!value) return null;
	const parsed = new Date(`${value}T23:59:59`);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const actions: Actions = {
	/* Save the knobs, then republish so the site matches what was just saved. */
	save: async (event) => {
		const user = requireRole(event, 'admin');
		const form = await superValidate(event.request, zod4(trendingConfigSchema));
		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_check_form() }, { status: 400 });
		}

		const { id: _ignored, ...values } = form.data;
		const existing = await ensureTrendingConfig(user.id);
		await db
			.update(t.trendingConfig)
			.set({
				...values,
				/* The select posts 0 for "every market"; the column is a foreign
				   key, where that has to be null. */
				countryId: values.countryId || null,
				updatedBy: user.id
			})
			.where(eq(t.trendingConfig.id, existing.id));

		await recordAudit({
			actorId: user.id,
			actorLabel: user.name,
			entity: 'trending_config',
			entityId: existing.id,
			action: 'updated',
			fromState: existing.mode,
			toState: values.mode,
			reason: `slots ${values.slots}, window ${values.windowDays}d, half-life ${values.halfLifeDays}d`
		});

		if (values.isFrozen) {
			return message(form, { type: 'success', text: m.at_saved_frozen() });
		}

		const result = await runTrending({
			actorId: user.id,
			actorLabel: user.name,
			trigger: 'settings',
			note: m.at_run_note_settings()
		});

		return message(form, {
			type: 'success',
			text: m.at_saved_published({ count: result.entryCount })
		});
	},

	/* A dry run of the submitted values. Writes nothing, on purpose. */
	preview: async (event) => {
		requireRole(event, 'admin');
		const form = await superValidate(event.request, zod4(trendingConfigSchema));
		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_check_form() }, { status: 400 });
		}

		const now = new Date();
		const [overrides, resting, current] = await Promise.all([
			db.select().from(t.trendingOverrides).where(isNull(t.trendingOverrides.deletedAt)),
			loadCooldowns(now),
			db.select({ creatorId: t.trendingEntries.creatorId }).from(t.trendingEntries)
		]);

		const values = valuesOf(form.data);
		const board = await buildBoard({ config: values, overrides, now, restingIds: resting });

		const liveIds = new Set(current.map((row) => row.creatorId));
		const nextIds = new Set(board.entries.map((entry) => entry.creatorId));
		const leavingIds = current.map((row) => row.creatorId).filter((id) => !nextIds.has(id));
		/* Named, not numbered: a creator dropping off the homepage is the part of
		   a preview an operator most needs to recognise at a glance. */
		const leaving = leavingIds.length
			? await db
					.select({ fullName: t.creators.fullName })
					.from(t.creators)
					.where(inArray(t.creators.id, leavingIds))
			: [];

		form.message = { type: 'success', text: m.at_preview_ready() };
		return {
			form,
			preview: {
				stats: board.stats,
				/* The bench is worth showing: "who just missed out" is the question an
				   operator asks straight after "who made it". */
				rows: board.ranked.slice(0, 40).map(toPreviewRow),
				/* Cut from the same board object the table above renders, so the
				   lanes shown are the lanes those rows would produce. */
				lanes: laneBoardOf(values, board).map((lane) => ({
					kind: lane.kind,
					label: lane.label,
					size: lane.entries.length
				})),
				entering: board.entries
					.filter((entry) => !liveIds.has(entry.creatorId))
					.map((entry) => entry.candidate.fullName),
				leaving: leaving.map((row) => row.fullName)
			}
		};
	},

	/* Recompute and publish with the settings as they are saved. */
	run: async (event) => {
		const user = requireRole(event, 'admin');
		const form = await superValidate(event.request, zod4(trendingRunSchema));
		if (!form.valid) return fail(400, { message: m.srv_invalid_request() });

		const result = await runTrending({
			actorId: user.id,
			actorLabel: user.name,
			trigger: 'manual',
			note: form.data.note || null
		});

		if (result.skipped === 'frozen') return fail(409, { message: m.at_error_frozen() });

		await recordAudit({
			actorId: user.id,
			actorLabel: user.name,
			entity: 'trending_board',
			entityId: result.runId,
			action: 'recomputed',
			reason: `${result.entryCount} slots, ${result.laneCount} lanes, ${result.changedCount} changed`
		});

		return { ran: result.entryCount, changed: result.changedCount };
	},

	/* The emergency stop: hold the board exactly as it is. */
	freeze: async (event) => {
		const user = requireRole(event, 'admin');
		const config = await ensureTrendingConfig(user.id);
		const isFrozen = !config.isFrozen;

		await db
			.update(t.trendingConfig)
			.set({ isFrozen, updatedBy: user.id })
			.where(eq(t.trendingConfig.id, config.id));

		await recordAudit({
			actorId: user.id,
			actorLabel: user.name,
			entity: 'trending_board',
			entityId: config.id,
			action: isFrozen ? 'frozen' : 'unfrozen'
		});

		return { frozen: isFrozen };
	},

	/* Pin, boost or block one creator. One standing instruction each. */
	addOverride: async (event) => {
		const user = requireRole(event, 'admin');
		const form = await superValidate(event.request, zod4(trendingOverrideSchema));
		if (!form.valid) {
			return message(form, { type: 'error', text: m.srv_check_form() }, { status: 400 });
		}

		const creator = (
			await db
				.select({ id: t.creators.id, fullName: t.creators.fullName })
				.from(t.creators)
				.where(eq(t.creators.id, form.data.creatorId))
				.limit(1)
		).at(0);
		if (!creator)
			return message(form, { type: 'error', text: m.at_error_no_creator() }, { status: 404 });

		const values = {
			creatorId: form.data.creatorId,
			kind: form.data.kind,
			position: form.data.kind === 'pin' ? form.data.position : 0,
			multiplier: form.data.kind === 'boost' ? form.data.multiplier : 1,
			note: form.data.note || null,
			expiresAt: parseExpiry(form.data.expiresAt)
		};

		await db
			.insert(t.trendingOverrides)
			.values({ ...values, createdBy: user.id, updatedBy: user.id })
			/* Replacing rather than refusing: an operator changing a pin into a
			   block is stating a new intent, not making a mistake. */
			.onDuplicateKeyUpdate({ set: { ...values, updatedBy: user.id, deletedAt: null } });

		await recordAudit({
			actorId: user.id,
			actorLabel: user.name,
			entity: 'trending_override',
			entityId: creator.id,
			action: form.data.kind,
			reason: form.data.note || null
		});

		return message(form, { type: 'success', text: m.at_override_saved() });
	},

	removeOverride: async (event) => {
		const user = requireRole(event, 'admin');
		const form = await superValidate(event.request, zod4(trendingOverrideRemove));
		if (!form.valid) return fail(400, { message: m.srv_invalid_request() });

		/* A hard delete: the unique index is per creator, and a soft-deleted row
		   would block the same creator from ever being pinned again. */
		await db.delete(t.trendingOverrides).where(eq(t.trendingOverrides.id, form.data.id));

		await recordAudit({
			actorId: user.id,
			actorLabel: user.name,
			entity: 'trending_override',
			entityId: form.data.id,
			action: 'removed'
		});

		return { removed: true };
	},

	/* Let a rested creator back into the running before their rest is up. */
	clearCooldown: async (event) => {
		const user = requireRole(event, 'admin');
		const form = await superValidate(event.request, zod4(trendingOverrideRemove));
		if (!form.valid) return fail(400, { message: m.srv_invalid_request() });

		await db.delete(t.trendingCooldowns).where(eq(t.trendingCooldowns.creatorId, form.data.id));

		await recordAudit({
			actorId: user.id,
			actorLabel: user.name,
			entity: 'trending_cooldown',
			entityId: form.data.id,
			action: 'cleared'
		});

		return { cleared: true };
	}
};

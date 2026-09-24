/**
 * What every scheduled job returns.
 *
 * Deliberately small and the same shape for all of them: it is written to
 * `job_runs`, printed by the command-line wrappers and returned as JSON to
 * cron, so a new job that wants to report something unusual says it in `note`
 * rather than growing this type.
 */
export type JobResult = {
	/** Rows or files the job looked at. */
	examined: number;
	/** Of those, how many it actually changed — wrote, or deleted. */
	changed: number;
	/**
	 * Whether the job stopped because it ran out of time rather than work.
	 *
	 * A job is expected to say so instead of running to completion: cron calls
	 * it again, and the queue is read from the database each time, so an
	 * interrupted sweep resumes where it left off.
	 */
	stoppedEarly: boolean;
	/** One line for a person reading the run log. */
	note: string;
};

/** What a job is allowed to spend, and whether it may write. */
export type JobOptions = {
	/**
	 * Stop starting new work after this many milliseconds. Work already begun
	 * is allowed to finish, so a run overshoots by at most one item.
	 */
	budgetMs?: number;
	/** Hard cap on items, whatever the budget allows. 0 means no cap. */
	limit?: number;
	/**
	 * Whether the job may change anything. False is a rehearsal that reports
	 * what it would have done — which is what the command-line wrappers default
	 * to, and what cron never does.
	 */
	write?: boolean;
	/** Called once per item, for the command-line wrappers' running commentary. */
	onProgress?: (line: string) => void;
};

/** Whether a budget that started at `startedAt` has been spent. */
export const outOfTime = (startedAt: number, budgetMs: number | undefined): boolean =>
	budgetMs !== undefined && budgetMs > 0 && Date.now() - startedAt >= budgetMs;

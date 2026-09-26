import { describe, expect, it } from 'vitest';
import { checkpointIsOpen, dueCheckpoints, postedAtProblem } from './proof';

const posted = new Date('2026-09-01T12:00:00Z');
const at = (iso: string) => new Date(iso);

describe('checkpoints', () => {
	it('opens each one at its moment, never early', () => {
		expect(checkpointIsOpen(posted, '24h', at('2026-09-02T11:59:00Z'))).toBe(false);
		expect(checkpointIsOpen(posted, '24h', at('2026-09-02T12:00:00Z'))).toBe(true);
		expect(checkpointIsOpen(posted, '7d', at('2026-09-08T12:00:00Z'))).toBe(true);
		expect(checkpointIsOpen(posted, '30d', at('2026-09-30T12:00:00Z'))).toBe(false);
	});

	it('lists what is open and not yet recorded', () => {
		expect(dueCheckpoints(posted, [], at('2026-09-09T00:00:00Z'))).toEqual(['24h', '7d']);
		expect(dueCheckpoints(posted, ['24h'], at('2026-09-09T00:00:00Z'))).toEqual(['7d']);
		expect(dueCheckpoints(posted, ['24h', '7d', '30d'], at('2026-12-01T00:00:00Z'))).toEqual([]);
	});

	it('refuses a posting time in the future or before the deal', () => {
		const now = at('2026-09-05T00:00:00Z');
		expect(postedAtProblem(at('2026-09-06T00:00:00Z'), posted, now)).toBe('future');
		expect(postedAtProblem(at('2026-08-01T00:00:00Z'), posted, now)).toBe('before_deal');
		expect(postedAtProblem(at('2026-09-02T00:00:00Z'), posted, now)).toBeNull();
	});
});

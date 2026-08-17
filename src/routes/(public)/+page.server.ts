import type { PageServerLoad } from './$types';
import { listCreators, getPlatformStats } from '$lib/server/queries';

export const load: PageServerLoad = async () => {
	const [featured, trending, stats] = await Promise.all([
		listCreators({ featured: true }),
		listCreators({ trending: true }),
		getPlatformStats()
	]);

	return { featured, trending, stats };
};

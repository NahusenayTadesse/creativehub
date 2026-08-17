export function pluralize(word: string): string {
	if (!word) return word;
	const irregulars: Record<string, string> = {
		person: 'people',
		man: 'men',
		woman: 'women',
		child: 'children',
		tooth: 'teeth',
		foot: 'feet',
		mouse: 'mice',
		goose: 'geese',
		ox: 'oxen',
		leaf: 'leaves',
		knife: 'knives',
		life: 'lives',
		wife: 'wives',
		wolf: 'wolves',
		shelf: 'shelves',
		elf: 'elves',
		half: 'halves',
		calf: 'calves',
		loaf: 'loaves',
		scarf: 'scarves',
		status: 'statuses',
		campus: 'campuses',
		focus: 'focuses',
		category: 'categories',
		city: 'cities',
		country: 'countries'
	};
	const lower = word.toLowerCase();
	if (irregulars[lower]) {
		return word[0] === word[0].toUpperCase()
			? irregulars[lower][0].toUpperCase() + irregulars[lower].slice(1)
			: irregulars[lower];
	}
	if (/(?:s|sh|ch|x|z)$/i.test(word)) return word + 'es';
	if (/[^aeiou]y$/i.test(word)) return word.slice(0, -1) + 'ies';
	if (/(?:f|fe)$/i.test(word)) return word.replace(/(?:f|fe)$/, 'ves');
	return word + 's';
}

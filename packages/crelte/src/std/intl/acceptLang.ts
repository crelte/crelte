/**
 * `parseAcceptLang('fr-CH, en;q=0.7, fr;q=0.8')` will return `[['fr-CH', 1], ['fr', 0.8], ['en', 0.7]]`
 */
export function parseAcceptLanguage(acceptLang: string): [string, number][] {
	return acceptLang
		.split(',')
		.map(d => {
			// eslint-disable-next-line prefer-const
			let [lang, pq] = d.split(';');
			lang = lang.trim();
			if (!lang) return null;

			let quality = 1;
			if (pq?.startsWith('q=')) {
				const q = parseFloat(pq.substring(2));
				if (!isNaN(q)) quality = q;
			}

			return [lang, quality] as [string, number];
		})
		.filter(d => !!d)
		.sort((a, b) => b[1] - a[1]);
}

export function matchLanguages(
	available: string[],
	preferred: string[],
): string | null {
	const fullMap = new Map();
	const baseMap = new Map();

	for (const lang of available) {
		const lower = lang.toLowerCase();
		const [base, p2] = lower.split('-');

		if (p2) fullMap.set(lower, lang);
		// only set if not already present, so en-US won't override en
		if (!baseMap.has(base)) baseMap.set(base, lang);
	}

	for (const prefLang of preferred) {
		const lowerPrefLang = prefLang.toLowerCase();

		const exactMatch = fullMap.get(lowerPrefLang);
		if (exactMatch) return exactMatch;

		const baseMatch = baseMap.get(lowerPrefLang.split('-')[0]);
		if (baseMatch) return baseMatch;
	}

	return null;
}

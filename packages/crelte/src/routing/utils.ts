export function trimSlashEnd(str: string) {
	return str.endsWith('/') ? str.substring(0, str.length - 1) : str;
}

/**
 * `parseAcceptLang('fr-CH, en;q=0.7, fr;q=0.8')` will return `[['fr-CH', 1], ['fr', 0.8], ['en', 0.7]]`
 */
function parseAcceptLang(acceptLang: string): [string, number][] {
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

/**
 * if no match was found null is returned
 * `matchAcceptLang('fr-CH, en;q=0.7, fr;q=0.8', ['en-GB'])` will return `en-GB`
 */
export function matchAcceptLang(
	acceptLang: string,
	langs: string[],
): string | null {
	const qualities = new Map(
		parseAcceptLang(acceptLang).map(([l, q]) => [l.toLowerCase(), q]),
	);

	return langs.reduce<{ lang: string | null; q: number }>(
		(best, lang) => {
			const lowerLang = lang.toLowerCase();
			// this might splitting to much
			const [p1, p2] = lowerLang.split('-');

			const q1 = qualities.get(lowerLang) ?? 0;
			const q2 = p2 ? (qualities.get(p1) ?? 0) : 0;

			const q = Math.max(q1, q2);

			return best.q < q ? { lang, q } : best;
		},
		{ lang: null, q: 0 },
	).lang;
}

// same as ?? but only for undefined
export function orDef<T>(a: T | undefined, def: T): T {
	return a === undefined ? def : a;
}

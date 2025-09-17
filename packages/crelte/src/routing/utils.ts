import { matchLanguages } from '../std/intl/index.js';
import Site from './Site.js';

export function trimSlashEnd(str: string) {
	return str.endsWith('/') ? str.substring(0, str.length - 1) : str;
}

// same as ?? but only for undefined
export function orDef<T>(a: T | undefined, def: T): T {
	return a === undefined ? def : a;
}

export function preferredSite(sites: Site[], languages: string[]): Site | null {
	const map = new Map(sites.map(s => [s.language, s]));

	const lang = matchLanguages(Array.from(map.keys()), languages);
	return lang ? map.get(lang)! : null;
}

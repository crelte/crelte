import { Translations } from '../translationsPlugin.js';
import { Crelte, CrelteRequest } from '../../crelte.js';
import { LoaderCreator, TranslationsLoader } from '../index.js';

export default class GlobalLoader implements TranslationsLoader {
	private handle: string;

	constructor(_crelte: Crelte, opts: { handle?: string }) {
		this.handle = opts.handle ?? 'translations';
	}

	async load(cr: CrelteRequest, namespace: string): Promise<Translations> {
		const globalSet = await cr.globals.getAsync(this.handle);
		if (!globalSet || typeof globalSet !== 'object')
			throw new Error(`missing globals \`${this.handle}\``);

		const data = globalSet[namespace];
		if (!data)
			throw new Error(
				`could not find \`${namespace}\` in globals \`${this.handle}\``,
			);

		if (typeof data !== 'string') return data;

		try {
			return JSON.parse(data);
		} catch (e) {
			throw new Error(
				`could not parse \`${this.handle}.${namespace}\` as json \n\n` +
					(e instanceof Error ? e.message : ''),
			);
		}
	}
}

/**
 * Creates a loader that loads translations from a global set.
 *
 * ```ts
 * import { createTranslations, createGlobalLoader } from 'crelte/translations';
 *
 * createTranslations({ loader: createGlobalLoader() });
 * ```
 *
 * Then in you're global export a `translations` globalSet with namespaces
 * as fields, at least `common`.
 *
 * ```graphql
 * translations: globalSet(handle: "translations", siteId: $siteId) {
 *   ... on translations_GlobalSet {
 *     common
 *   }
 * }
 */
export function createGlobalLoader(
	opts: {
		/** the handle for the global set containing the namespaces (default = translations) */
		handle?: string;
	} = {},
): LoaderCreator {
	return crelte => new GlobalLoader(crelte, opts);
}

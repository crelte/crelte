import { CrelteRequest } from '../../../crelte.js';
import SsrCache from '../../../ssr/SsrCache.js';
import { Translations } from '../../translationsPlugin.js';
import { TranslationsLoader } from '../index.js';
import { SSR_RUN_NUMBER_KEY, translationFilePath } from './fileLoader.js';

export default class ClientFileLoader implements TranslationsLoader {
	private readonly runNumber: string;

	constructor(cache: SsrCache) {
		this.runNumber = cache.get(SSR_RUN_NUMBER_KEY) ?? '';
	}

	async load(cr: CrelteRequest, namespace: string): Promise<Translations> {
		const lang = cr.site.language;

		try {
			const resp = await fetch(
				`${translationFilePath(lang, namespace)}?run=${this.runNumber}`,
			);

			if (!resp.ok) {
				throw new Error(
					`Failed to fetch translations file for ${lang}/${namespace}`,
				);
			}

			// todo: validate data
			const data: Translations = await resp.json();

			return data;
		} catch (e: unknown) {
			console.error(e);
			throw new Error(
				'There is something wrong with your translations file. \n\n' +
					(e instanceof Error ? e.message : ''),
			);
		}
	}
}

import fs from 'node:fs/promises';
import { SSR_RUN_NUMBER_KEY, translationFilePath } from './fileLoader.js';
import { randomToken } from '../../utils.js';
import { Translations } from '../../translationsPlugin.js';
import SsrCache from '../../../ssr/SsrCache.js';
import { CrelteRequest } from '../../../crelte.js';
import { TranslationsLoader } from '../index.js';

export default class NodeFileLoader implements TranslationsLoader {
	constructor(cache: SsrCache) {
		// store RUN_NUMBER in ssr store
		cache.set(SSR_RUN_NUMBER_KEY, randomToken());
	}

	async load(cr: CrelteRequest, namespace: string): Promise<Translations> {
		const lang = cr.site.language;

		try {
			const fileString = await fs.readFile(
				`./public${translationFilePath(lang, namespace)}`,
				'utf-8',
			);
			// todo: validate data
			return JSON.parse(fileString) as Translations;
		} catch (e: unknown) {
			throw new Error(
				'There is something wrong with your translations file. \n\n' +
					(e instanceof Error ? e.message : ''),
			);
		}
	}
}

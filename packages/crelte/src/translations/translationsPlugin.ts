import { derived } from 'svelte/store';
import { LoaderCreator, TranslationsLoader } from './loader/index.js';
import { Plugin, PluginCreator } from '../plugins/Plugins.js';
import { Crelte, CrelteRequest } from '../crelte.js';
import Readable from '../std/stores/Readable.js';
import { getCrelte } from '../index.js';

export type TranslateFunction = (
	key: string,
	// replacements?: Record<string, string>,
) => string;
export type TranslateStore = Readable<TranslateFunction>;
export type Translations = Record<string, string>;
export type TranslationsPluginOptions = {
	/** use either `createFileLoader()` or `createGlobalLoader()` */
	loader: LoaderCreator;
	/** The common namespace is always loaded  */
	loadNamespaces?: string[];
};

const SSR_KEY = '_translations';

export class TranslationsPlugin implements Plugin {
	private crelte: Crelte;
	/// Map<`lang-namespace`, Translations>
	private translations: Map<string, Translations>;
	private loader: TranslationsLoader;
	/// When the derived of site is used in the first loadData site is not defined
	/// so we need to store the first language here
	private firstLang: string | null;

	get name(): string {
		return 'translations';
	}

	constructor(crelte: Crelte, opts: TranslationsPluginOptions) {
		this.crelte = crelte;
		this.translations = new Map(crelte.ssrCache.get(SSR_KEY));
		this.firstLang = null;

		if (import.meta.env.DEV && typeof opts?.loader !== 'function') {
			throw new Error(
				'TranslationsPlugin requires a loader, use `createFileLoader()` or ' +
					'`createGlobalLoader()`',
			);
		}

		this.loader = opts.loader(crelte);
		const loadNamespaces = opts.loadNamespaces ?? [];

		// preload default translations
		crelte.events.on('loadGlobalData', async (cr: CrelteRequest) => {
			this.firstLang = cr.site.language;
			await Promise.all([
				this.load(cr, 'common'),
				...loadNamespaces.map(ns => this.load(cr, ns)),
			]);
		});
	}

	/**
	 * load needs to take a CrelteRequest to be able to get the correct site
	 * and globals
	 *
	 * in crelte 0.5 this should also be possible without a CrelteRequest
	 * but with multiple plugin instances / Request State plugins
	 */
	async load(cr: CrelteRequest, namespace: string): Promise<Translations> {
		const lang = cr.site.language;
		const key = `${lang}-${namespace}`;
		const tData = this.translations.get(key);
		if (tData) return tData;

		const data = await this.loader.load(cr, namespace);
		this.translations.set(key, data);
		if (import.meta.env.SSR) {
			// only store the translations in the ssrCache during ssr
			// since after that we wont read it again
			cr.ssrCache.set(SSR_KEY, Array.from(this.translations.entries()));
		}

		return data;
	}

	get(lang: string, namespace: string): Translations | null {
		return this.translations.get(`${lang}-${namespace}`) ?? null;
	}

	/** @hidden */
	z_createTranslateStore(namespace: string): TranslateStore {
		const store = derived(this.crelte.router.site, site => {
			return (key: string) => {
				const lang = site?.language ?? this.firstLang;
				if (!lang) throw new Error('no lang');

				const data = this.get(lang, namespace);
				if (!data) console.error(`namespace '${namespace}' not loaded`);
				return data?.[key] || key;
			};
		});

		return new Readable(store);
	}
}

/**
 * Create the TranslationsPlugin
 *
 * #### Setup file loader
 *
 * ```ts
 * import { createTranslations, createFileLoader } from 'crelte/translations';
 *
 * createTranslations({ loader: createFileLoader() });
 * ```
 *
 * #### Setup global loader
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
 * ```
 */
export function createTranslations(
	opts: TranslationsPluginOptions,
): PluginCreator {
	return crelte => new TranslationsPlugin(crelte, opts);
}

export function getTranslationsPlugin(
	crelte: Crelte = getCrelte(),
): TranslationsPlugin {
	return crelte.getPlugin('translations') as TranslationsPlugin;
}

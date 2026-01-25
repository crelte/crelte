/**
 * @packageDocumentation
 *
 * ## Unstable
 * The translations module is not yet stable. APIs may change without a major version bump.
 */

import { createFileLoader } from './loader/fileLoader/fileLoader.js';
import { createGlobalLoader } from './loader/GlobalLoader.js';
import { type TranslationsLoader, type LoaderCreator } from './loader/index.js';
import loadTranslations from './loadTranslations.js';
import {
	createTranslations,
	getTranslationsPlugin,
	type TranslateFunction,
	type TranslateStore,
	type Translations,
	TranslationsPlugin,
	type TranslationsPluginOptions,
} from './translationsPlugin.js';

/**
 * Creates a translate store for the given namespace.
 *
 * #### Example
 * ```svelte
 * <script>
 * 	import { getTranslations } from 'crelte/translations';
 *
 * 	const t = getTranslations();
 * </script>
 *
 * <h1>{$t('welcome_message')}</h1>
 * ```
 */
function getTranslations(namespace: string = 'common'): TranslateStore {
	const plugin = getTranslationsPlugin();
	return plugin.z_createTranslateStore(namespace);
}

export {
	createTranslations,
	TranslationsPluginOptions,
	loadTranslations,
	getTranslations,
	getTranslationsPlugin,
	Translations,
	TranslationsPlugin,
	TranslationsLoader,
	LoaderCreator,
	TranslateStore,
	TranslateFunction,
	// loaders
	createFileLoader,
	createGlobalLoader,
};

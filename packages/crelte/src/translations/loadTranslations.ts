import { CrelteRequest } from '../crelte.js';
import { getTranslationsPlugin, TranslateStore } from './translationsPlugin.js';

/**
 * Creates a translate store and loads the specified namespace.
 *
 * #### Example
 * ```svelte
 * <script module>
 * 	import { loadTranslations } from 'crelte/translations';
 * 	export const loadData = {
 * 		t: cr => loadTranslations(cr, 'customNamespace')
 * 	};
 * </script>
 *
 * <script>
 * 	let { t } = $props();
 * </script>
 *
 * <h1>{$t('welcome_message')}</h1>
 * ```
 */
export default async function loadTranslations(
	cr: CrelteRequest,
	namespace: string,
): Promise<TranslateStore> {
	const plugin = getTranslationsPlugin(cr);

	// we don't need the return value here as it's cached
	await plugin.load(cr, namespace);

	return plugin.z_createTranslateStore(namespace);
}

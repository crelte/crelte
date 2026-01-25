import { LoaderCreator } from '../index.js';
import ClientFileLoader from './ClientFileLoader.js';
import NodeFileLoader from './NodeFileLoader.js';

export const SSR_RUN_NUMBER_KEY = 'st-run-number';

/// Returns a path to the translations file for the given language and namespace.
/// Always prefixed with a slash.
export function translationFilePath(lang: string, namespace: string): string {
	return `/translations/${lang}/${namespace}.json`;
}

export function createFileLoader(): LoaderCreator {
	if (import.meta.env.SSR) {
		return crelte => new NodeFileLoader(crelte.ssrCache);
	} else {
		return crelte => new ClientFileLoader(crelte.ssrCache);
	}
}

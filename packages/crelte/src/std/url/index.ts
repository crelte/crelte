import { BaseRoute } from '../../routing/index.js';
import { deleteSearchParam } from './utils.js';

/**
 * Sets the search params of a URL based on the provided options.
 *
 * If a value is `null`, `undefined`, or an empty string, the corresponding
 * search param will be deleted.
 *
 * #### Example
 * ```js
 * urlWithSearch(entry.url, { p: 1 });
 * // or remove a value
 * urlWithSearch(entry.url, { p: null });
 * ```
 */
export function urlWithSearch(
	url: BaseRoute | URL | string | null | undefined,
	opts: Record<string, string | number | null | undefined>,
): string | null {
	if (!url) return null;

	if (typeof url === 'string') {
		url = new URL(url);
	} else if (url instanceof BaseRoute) {
		url = new URL(url.url);
	}

	for (const [k, v] of Object.entries(opts)) {
		if (!deleteSearchParam(v)) {
			url.searchParams.set(k, v as string);
		} else {
			url.searchParams.delete(k);
		}
	}

	return url.href;
}

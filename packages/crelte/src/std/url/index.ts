import { BaseRoute } from '../../routing/index.js';
import { deleteSearchParam, pathnameEq, searchEq, toUrl } from './utils.js';

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

	url = toUrl(url);

	for (const [k, v] of Object.entries(opts)) {
		if (!deleteSearchParam(v)) {
			url.searchParams.set(k, v as string);
		} else {
			url.searchParams.delete(k);
		}
	}

	return url.href;
}

/**
 * Compares two URLs for equality.
 * Normally search and hash are ignored.
 *
 * If either or both url is `null` or `undefined`, the function will return
 * `false`.
 *
 * #### Example
 * ```svelte
 * <script>
 *     import { getRoute } from 'crelte';
 *
 *     const route = getRoute();
 * </script>
 *
 * <a href={item.url} class:active={urlEq($route, item.url)}>
 *     {item.title}
 * </a>
 * ```
 */
export function urlEq(
	a: BaseRoute | URL | string | null | undefined,
	b: BaseRoute | URL | string | null | undefined,
	opts?: { search?: boolean; hash?: boolean },
): boolean {
	if (!a || !b) return false;

	a = toUrl(a);
	b = toUrl(b);

	// check origin and pathname
	const baseMatches =
		a.origin === b.origin && pathnameEq(a.pathname, b.pathname);
	if (!baseMatches) return false;

	// check search
	if (opts?.search && !searchEq(a.searchParams, b.searchParams)) return false;

	// check hash
	if (opts?.hash && a.hash !== b.hash) return false;

	return true;
}

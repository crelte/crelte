import { BaseRoute } from '../../routing/index.js';

/**
 * Checks if a search param should be removed.
 * This is the case if the value is `null`, `undefined`, or an empty string.
 */
export function deleteSearchParam(value: string | number | null | undefined) {
	return (
		typeof value === 'undefined' ||
		value === null ||
		(typeof value === 'string' && value === '')
	);
}

/**
 * Converts a `BaseRoute`, `URL`, or string to a `URL` object.
 */
export function toUrl(url: BaseRoute | URL | string): URL {
	if (typeof url === 'string') return new URL(url);

	if (url instanceof BaseRoute) return new URL(url.url);

	return url;
}

/**
 * Compares two `URLSearchParams` objects for equality.
 */
export function searchEq(a: URLSearchParams, b: URLSearchParams): boolean {
	if (a.size !== b.size) return false;

	// Clone to avoid mutating the original objects
	const cloneA = new URLSearchParams(a);
	const cloneB = new URLSearchParams(b);

	cloneA.sort();
	cloneB.sort();

	return cloneA.toString() === cloneB.toString();
}

/**
 * Compares two pathnames for equality, ignoring trailing slashes.
 */
export function pathnameEq(a: string, b: string): boolean {
	// check for trailing slashes
	return a === b || a === b + '/' || a + '/' === b;
}

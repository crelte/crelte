// This are internal utils. Consider adding them to crelte-std instead

// this tries to do a structuredClone and else just uses JSON
export function objClone(obj: any): any {
	if (typeof structuredClone === 'function') {
		return structuredClone(obj);
	}

	return JSON.parse(JSON.stringify(obj));
}

export function isPromise<T>(p: Promise<T> | T): p is Promise<T> {
	return typeof (p as any)?.then === 'function';
}

/**
 * A helper to chain promises without needing a microtask if its not a promise
 * Equivalent to:
 * ```
 * const val = await p;
 * then(val);
 * ```
 */
export function promiseThen<T, R = void>(
	p: Promise<T> | T,
	then: (val: T) => R,
): Promise<R> | R {
	return isPromise(p) ? p.then(then) : then(p);
}

// the pathname is always replaced
export function urlWithPath(url: string, path?: string): URL {
	const u = new URL(url);
	u.pathname = path ?? '';
	return u;
}

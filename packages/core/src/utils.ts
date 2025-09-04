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

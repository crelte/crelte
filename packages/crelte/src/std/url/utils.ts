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

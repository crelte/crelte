/**
 * Delays for a specified amount of time.
 *
 * @param ms - The number of milliseconds to delay for.
 * @returns A promise that resolves after the delay.
 */
export function timeout(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export interface Cloneable {
	clone(): this;
}

export type CloneableOrPrimitive =
	| Cloneable
	| string
	| number
	| boolean
	| null
	| undefined;

/**
 * Creates a clone of the provided value. The values need to be either
 * a primitive or implement the Cloneable interface.
 */
export function clone<T extends CloneableOrPrimitive>(value: T): T {
	if (typeof value !== 'object' || value === null) return value;

	return (value as Cloneable).clone() as T;
}

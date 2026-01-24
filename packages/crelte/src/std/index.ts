/**
 * @packageDocumentation
 *
 * Crelte Standard library
 *
 * Provides standard utility functions and types for Crelte applications.
 *
 * ### Modules:
 * - {@link std/intl}
 * - {@link std/stores}
 * - {@link std/sync}
 */

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

/**
 * A type that represents a value that can be cloned.
 */
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

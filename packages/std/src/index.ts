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

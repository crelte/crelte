import { Crelte } from '../../crelte.js';
import { getCrelte } from '../../index.js';

/**
 * Returns a random number between 0 (inclusive) and 1 (exclusive).
 *
 * In SSR mode, the same key will always return the same random number.
 * In client mode, the first call will return the number generated during SSR.
 */
export function random(key: string, crelte: Crelte = getCrelte()): number {
	return crelte.ssrCache.takeOnce('_rand_' + key, () => Math.random());
}

/**
 * Create a deterministic random number generator.
 *
 * Intended use: create this once during component initialization when a sequence
 * of random values must be consistent between server-side rendering and client
 * hydration.
 *
 * The generator is seeded during SSR using the provided key. During hydration,
 * the same seed is reused so that the client produces the same sequence of random
 * numbers as the server for the initial render.
 *
 * After hydration, the generator continues independently on the client.
 *
 * @returns A function that returns a pseudo-random number in the range
 *          [0, 1).
 *
 * #### Example
 * ```ts
 * const rng = createRng('lucky-number');
 *
 * const val1 = rng(); // same on server and client
 * const val2 = rng(); // same on server and client
 * ```
 */
export function createRng(
	key: string,
	crelte: Crelte = getCrelte(),
): () => number {
	const seed = crelte.ssrCache.takeOnce('_rng_' + key, () => Math.random());

	// park miller algorithm

	const MOD = 2147483647;
	const MUL = 16807;

	let state = Math.floor(seed * (MOD - 1)) + 1;

	return () => {
		state = (state * MUL) % MOD;
		return (state - 1) / (MOD - 1);
	};
}

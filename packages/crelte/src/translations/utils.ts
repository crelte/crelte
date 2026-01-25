const ALPHABET: string =
	'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const ALPHABET_LENGTH = ALPHABET.length;

/**
 * Generates a random token of a specified length.
 *
 * @param length - The desired length of the token.
 * @returns A random token.
 */
export function randomToken(length: number = 8): string {
	let s = '';
	for (let i = 0; i < length; i++) {
		s += ALPHABET[Math.floor(Math.random() * ALPHABET_LENGTH)];
	}
	return s;
}

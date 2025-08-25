export type SetOptions = {
	maxAge?: number;
	path?: string;
	domain?: string;
	secure?: boolean;
	httpOnly?: boolean;
};

export interface Cookies {
	/**
	 * returns the value of the cookie
	 */
	get(name: string): string | null;

	/**
	 * sets the value of the cookie
	 *
	 * ## Note
	 * in most cases you probably wan't to set the path to '/'
	 */
	set(name: string, value: string, opts?: SetOptions): void;

	/**
	 * removes the cookie
	 */
	remove(name: string): void;
}

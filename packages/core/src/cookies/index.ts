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
	 */
	set(name: string, value: string, opts?: SetOptions): void;

	remove(name: string): void;

	// doc hidden
	_init(cookies: string): void;
}

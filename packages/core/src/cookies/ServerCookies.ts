import { Cookies, RemoveOptions, SetOptions } from './index.js';
import { parseCookies, type SetCookie, setCookieToString } from './utils.js';

/**
 * ## Warning
 * This is not stable and should only be used internally by crelte
 */
export default class ServerCookies implements Cookies {
	requestCookies: Map<string, string>;
	setCookies: Map<string, SetCookie>;

	constructor(cookies: string) {
		this.requestCookies = parseCookies(cookies);
		this.setCookies = new Map();
	}

	/// Rethrns the value of the cookie with the given name, or null if it doesn't exist.
	get(name: string): string | null {
		const setCookie = this.setCookies.get(name);
		// js allows undefined > 0
		if (setCookie && setCookie.maxAge! > 0) {
			return setCookie.value;
		}

		return this.requestCookies.get(name) ?? null;
	}

	set(name: string, value: string, opts?: SetOptions): void {
		this.setCookies.set(name, { name, value, ...opts });
	}

	remove(name: string, opts?: RemoveOptions): void {
		this.set(name, '', { ...opts, maxAge: 0 });
	}

	_getSetCookiesHeaders(): string[] {
		return Array.from(this.setCookies.values()).map(setCookie =>
			setCookieToString(setCookie),
		);
	}
}

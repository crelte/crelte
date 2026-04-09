import { PlatformCookies, RemoveOptions, SetOptions } from './Cookies.js';
import { parseCookies, type SetCookie, setCookieToString } from './utils.js';

/**
 * #### Warning
 * This is not stable and should only be used internally by crelte
 */
export default class ServerCookies implements PlatformCookies {
	requestCookies: Map<string, string>;
	setCookies: Map<string, SetCookie>;

	constructor(headers: Headers) {
		this.requestCookies = parseCookies(headers.get('Cookie') ?? '');
		this.setCookies = new Map();
	}

	/// Returns the value of the cookie with the given name, or null if it doesn't exist.
	get(name: string): string | null {
		const setCookie = this.setCookies.get(name);
		if (setCookie) {
			return (setCookie.maxAge ?? 1) > 0 ? setCookie.value : null;
		}

		return this.requestCookies.get(name) ?? null;
	}

	set(name: string, value: string, opts?: SetOptions): void {
		this.setCookies.set(name, { name, value, path: '/', ...opts });
	}

	remove(name: string, opts?: RemoveOptions): void {
		this.set(name, '', { ...opts, maxAge: 0 });
	}

	toRequest(): ServerCookies {
		return this;
	}

	_populateHeaders(headers: Headers) {
		for (const setCookie of this.setCookies.values()) {
			headers.append('Set-Cookie', setCookieToString(setCookie));
		}
	}
}

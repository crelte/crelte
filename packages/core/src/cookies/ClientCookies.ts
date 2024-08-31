import { Cookies, SetOptions } from './index.js';
import { parseCookies, setCookieToString } from './utils.js';

// the philosophy here is that document.cookie is the source of truth
// so we don't cache cookies here
// if this changes, modify init/client.ts
export default class ClientCookies implements Cookies {
	constructor() {}

	_init(_cookies: string): void {}

	get(name: string): string | null {
		const cookies = getCookies();
		return cookies.get(name) ?? null;
	}

	set(name: string, value: string, opts?: SetOptions): void {
		const setCookie = { name, value, ...opts };

		document.cookie = setCookieToString(setCookie);
	}

	remove(name: string): void {
		this.set(name, '', { maxAge: 0 });
	}
}

function getCookies(): Map<string, string> {
	return parseCookies(document.cookie);
}

import { PlatformCookies, RemoveOptions, SetOptions } from './Cookies.js';
import { parseCookies, SetCookie, setCookieToString } from './utils.js';

export default class ClientCookies implements PlatformCookies {
	private inner: Map<string, string> | null;
	private setCookies: Map<string, SetCookie> | null;

	constructor(
		inner?: Map<string, string>,
		setCookies?: Map<string, SetCookie>,
	) {
		this.inner = inner ?? null;
		this.setCookies = setCookies ?? null;
	}

	get(name: string): string | null {
		if (!this.inner || !this.setCookies) {
			const cookies = getCookies();
			return cookies.get(name) ?? null;
		}

		const setCookie = this.setCookies.get(name);
		if (setCookie) {
			return (setCookie.maxAge ?? 1) > 0 ? setCookie.value : null;
		}

		return this.inner.get(name) ?? null;
	}

	set(name: string, value: string, opts?: SetOptions): void {
		const setCookie = { name, value, path: '/', ...opts };

		if (this.setCookies) this.setCookies.set(name, setCookie);
		else document.cookie = setCookieToString(setCookie);
	}

	remove(name: string, opts?: RemoveOptions): void {
		this.set(name, '', { ...opts, maxAge: 0 });
	}

	toRequest(): ClientCookies {
		return new ClientCookies(getCookies(), new Map());
	}

	render(): void {
		if (!this.setCookies) throw new Error('call toRequest first');

		for (const setCookie of this.setCookies.values()) {
			document.cookie = setCookieToString(setCookie);
		}

		this.inner = null;
		this.setCookies = null;
	}
}

function getCookies(): Map<string, string> {
	return parseCookies(document.cookie);
}

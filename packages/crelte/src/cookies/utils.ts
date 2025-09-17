export function parseCookies(cookies: string): Map<string, string> {
	return new Map(
		cookies.split(';').map(cookie => {
			let [name, value] = cookie.split('=');
			/// this is the behaviour of chrome
			if (typeof value === 'undefined') {
				value = name;
				name = '';
			}

			name = name.trim();
			value = decodeURIComponent(value.trim());

			return [name, value];
		}),
	);
}

export type SetCookie = {
	name: string;
	value: string;
	maxAge?: number;
	path?: string;
	domain?: string;
	secure?: boolean;
	httpOnly?: boolean;
};

export function setCookieToString(cookie: SetCookie): string {
	let s = `${cookie.name}=${encodeURIComponent(cookie.value)}`;

	if (typeof cookie.maxAge === 'number') {
		s += `; Max-Age=${cookie.maxAge}`;
	}

	if (cookie.path) {
		s += `; Path=${cookie.path}`;
	}

	if (cookie.domain) {
		s += `; Domain=${cookie.domain}`;
	}

	if (cookie.secure) {
		s += `; Secure`;
	}

	if (cookie.httpOnly) {
		s += `; HttpOnly`;
	}

	return s;
}

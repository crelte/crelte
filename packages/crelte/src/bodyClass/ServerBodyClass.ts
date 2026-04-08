import { PlatformBodyClass } from './BodyClass.js';

export default class ServerBodyClass implements PlatformBodyClass {
	private inner: Set<string>;

	constructor() {
		this.inner = new Set();
	}

	contains(cls: string): boolean {
		return this.inner.has(cls);
	}

	add(...classes: string[]): void {
		validate(classes);
		classes.forEach(cls => this.inner.add(cls));
	}

	toggle(cls: string, force?: boolean): void {
		validate([cls]);

		if (import.meta.env.DEV && typeof force !== 'boolean') {
			console.warn(
				'Using toggle without force on the server can lead ' +
					'to unexpected results. Because in a loadData the server will add it ' +
					'and the client will afterwards remove it.',
			);
		}

		const add = typeof force === 'boolean' ? force : !this.inner.has(cls);

		if (add) this.inner.add(cls);
		else this.inner.delete(cls);
	}

	remove(...classes: string[]): void {
		validate(classes);
		classes.forEach(cls => this.inner.delete(cls));
	}

	toRequest(): ServerBodyClass {
		return this;
	}

	z_processHtmlTemplate(html: string): string {
		const SEARCH_STR = '<!--body-class-->';
		if (this.inner.size && !html.includes(SEARCH_STR)) {
			throw new Error(
				'index.html needs to contain `class="<!--body-class-->"`',
			);
		}

		return html.replace(SEARCH_STR, Array.from(this.inner).join(' '));
	}
}

function validate(classes: string[]) {
	for (const cls of classes) {
		if (cls.includes(' ')) {
			throw new Error(
				`Invalid class name "${cls}". Class names must not contain spaces.`,
			);
		}
	}
}

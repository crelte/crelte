import SsrCache from '../ssr/SsrCache.js';
import { PlatformBodyClass } from './BodyClass.js';
import { ClassSet, variantsToSsrCache } from './utils.js';

export default class ServerBodyClass implements PlatformBodyClass {
	private inner: ClassSet;

	constructor() {
		this.inner = new ClassSet();
	}

	contains(cls: string): boolean {
		return this.inner.has(cls);
	}

	add(...classes: string[]): void {
		validate(classes);
		classes.forEach(cls => this.inner.add(cls));
	}

	toggle(cls: string, force?: boolean): boolean {
		validate([cls]);

		if (import.meta.env.DEV && typeof force !== 'boolean') {
			console.warn(
				'Using toggle without force on the server can lead ' +
					'to unexpected results. Because in a loadData the server will add it ' +
					'and the client will afterwards remove it.',
			);
		}

		const exists = this.inner.has(cls);
		const shouldExist = typeof force === 'boolean' ? force : !exists;
		const changed = shouldExist !== exists;

		if (shouldExist) this.inner.add(cls);
		else this.inner.delete(cls);

		return changed;
	}

	remove(...classes: string[]): void {
		validate(classes);
		classes.forEach(cls => this.inner.delete(cls));
	}

	/**
	 * @returns Returns true if the value was changed
	 */
	setVariant(variant: string, cls: string | null): boolean {
		return this.inner.setVariant(variant, cls);
	}

	toRequest(): ServerBodyClass {
		// no second request should ever start on the server
		return this;
	}

	z_populateSsrCache(ssrCache: SsrCache): void {
		variantsToSsrCache(this.inner.z_variants, ssrCache);
	}

	z_processHtmlTemplate(html: string): string {
		const SEARCH_STR = '<!--body-class-->';
		if (this.inner.length && !html.includes(SEARCH_STR)) {
			throw new Error(
				'index.html needs to contain `class="<!--body-class-->"`',
			);
		}

		return html.replace(
			SEARCH_STR,
			Array.from(this.inner.classes()).join(' '),
		);
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

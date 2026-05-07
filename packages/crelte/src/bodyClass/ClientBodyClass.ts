import SsrCache from '../ssr/SsrCache.js';
import { PlatformBodyClass } from './BodyClass.js';
import { ClassSet, ssrCacheToVariants, Variants } from './utils.js';

export default class ClientBodyClass implements PlatformBodyClass {
	private variants: Variants;
	// during the request store the classes here
	private inner: ClassSet | null;

	constructor(variants: Variants, inner?: ClassSet) {
		this.variants = variants;
		this.inner = inner ?? null;
	}

	static fromSsrCache(ssrCache: SsrCache): ClientBodyClass {
		const variants = ssrCacheToVariants(ssrCache);
		return new ClientBodyClass(variants);
	}

	contains(cls: string): boolean {
		if (this.inner) return this.inner.has(cls);
		return cl().contains(cls);
	}

	add(...classes: string[]): void {
		if (this.inner) classes.forEach(cls => this.inner!.add(cls));
		else cl().add(...classes);
	}

	// returns true if the value was changed
	toggle(cls: string, force?: boolean): boolean {
		const exists = this.contains(cls);
		const shouldExist = typeof force === 'boolean' ? force : !exists;
		const changed = shouldExist !== exists;

		if (this.inner) {
			if (shouldExist) this.inner.add(cls);
			else this.inner.delete(cls);
		} else {
			cl().toggle(cls, force);
		}

		return changed;
	}

	remove(...classes: string[]): void {
		if (this.inner) classes.forEach(cls => this.inner!.delete(cls));
		else cl().remove(...classes);
	}

	setVariant(variant: string, cls: string | null): boolean {
		if (this.inner) return this.inner.setVariant(variant, cls);

		const { remove, add } = this.variants.set(variant, cls);

		if (remove) cl().remove(remove);
		if (add) cl().add(add);

		return !!remove || !!add;
	}

	toRequest(): ClientBodyClass {
		const inner = new ClassSet(cl(), this.variants.entries(), true);
		return new ClientBodyClass(this.variants, inner);
	}

	render(): void {
		if (!this.inner) throw new Error('call toRequest first');

		const inner = this.inner;
		this.inner = null;

		inner.applyHistory(this);
	}
}

function cl(): DOMTokenList {
	return document.body.classList;
}

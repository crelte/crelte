import { PlatformBodyClass } from './BodyClass.js';

export default class ClientBodyClass implements PlatformBodyClass {
	private inner: Set<string> | null;

	constructor(inner?: Set<string>) {
		this.inner = inner ?? null;
	}

	contains(cls: string): boolean {
		if (this.inner) return this.inner.has(cls);
		return cl().contains(cls);
	}

	add(...classes: string[]): void {
		if (this.inner) classes.forEach(cls => this.inner!.add(cls));
		else cl().add(...classes);
	}

	toggle(cls: string, force?: boolean): void {
		if (this.inner) {
			const add =
				typeof force === 'boolean' ? force : !this.inner.has(cls);

			if (add) this.inner.add(cls);
			else this.inner.delete(cls);
		} else {
			cl().toggle(cls, force);
		}
	}

	remove(...classes: string[]): void {
		if (this.inner) classes.forEach(cls => this.inner!.delete(cls));
		else cl().remove(...classes);
	}

	toRequest(): ClientBodyClass {
		const inner = new Set(cl());
		return new ClientBodyClass(inner);
	}
}

function cl(): DOMTokenList {
	return document.body.classList;
}

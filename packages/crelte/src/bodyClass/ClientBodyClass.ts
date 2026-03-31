import { PlatformBodyClass } from './BodyClass.js';

export default class ClientBodyClass implements PlatformBodyClass {
	contains(cls: string): boolean {
		return cl().contains(cls);
	}

	add(...classes: string[]): void {
		cl().add(...classes);
	}

	toggle(cls: string, force?: boolean): void {
		cl().toggle(cls, force);
	}

	remove(...classes: string[]): void {
		cl().remove(...classes);
	}
}

function cl(): DOMTokenList {
	return document.body.classList;
}

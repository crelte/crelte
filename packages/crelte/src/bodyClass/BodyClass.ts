import StagedWritable from '../std/stores/StagedWritable.js';

export default class BodyClass {
	private inner: PlatformBodyClass;
	private store: StagedWritable<void>;

	constructor(inner: PlatformBodyClass, store?: StagedWritable<void>) {
		this.inner = inner;
		this.store = store ?? new StagedWritable(void 0);
	}

	subscribe(
		fn: (val: BodyClass) => void,
		invalidate?: () => void,
	): () => void {
		return this.store.subscribe(() => fn(this), invalidate);
	}

	/**
	 * Checks if the body contains the given class
	 */
	contains(cls: string): boolean {
		return this.inner.contains(cls);
	}

	/**
	 * Adds the given classes to the body
	 */
	add(...classes: string[]): void {
		this.inner.add(...classes);
		this.store.set();
	}

	/**
	 * Toggles the given class on the body
	 *
	 * ## Warning
	 * toggle without `force` should almost never be used
	 * on the server. If you call this for example in loadData
	 * the server will add the class and the client will the remove
	 * it.
	 */
	toggle(cls: string, force?: boolean): void {
		this.inner.toggle(cls, force);
		this.store.set();
	}

	remove(...classes: string[]): void {
		this.inner.remove(...classes);
		this.store.set();
	}

	/** @hidden */
	z_toRequest(): BodyClass {
		return new BodyClass(this.inner.toRequest(), this.store.stage());
	}

	/** @hidden */
	z_render(): void {
		this.inner.render?.();
		this.store.commit();
	}
}

export interface PlatformBodyClass {
	contains(cls: string): boolean;
	add(...classes: string[]): void;
	toggle(cls: string, force?: boolean): void;
	remove(...classes: string[]): void;
	toRequest(): PlatformBodyClass;
	render?: () => void;
}

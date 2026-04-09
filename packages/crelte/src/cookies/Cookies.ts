import StagedWritable from '../std/stores/StagedWritable.js';

export type SetOptions = {
	maxAge?: number;
	path?: string;
	domain?: string;
	secure?: boolean;
	httpOnly?: boolean;
};

export type RemoveOptions = Omit<SetOptions, 'maxAge'>;

export default class Cookies {
	private inner: PlatformCookies;
	private store: StagedWritable<void>;

	constructor(inner: PlatformCookies, store?: StagedWritable<void>) {
		this.inner = inner;
		this.store = store ?? new StagedWritable(void 0);
	}

	subscribe(fn: (val: Cookies) => void, invalidate?: () => void): () => void {
		return this.store.subscribe(() => fn(this), invalidate);
	}

	/**
	 * returns the value of the cookie
	 */
	get(name: string): string | null {
		return this.inner.get(name);
	}

	/**
	 * sets the value of the cookie
	 *
	 * #### Note
	 * path defaults to '/'
	 */
	set(name: string, value: string, opts?: SetOptions): void {
		this.inner.set(name, value, opts);
		this.store.set();
	}

	/**
	 * removes the cookie
	 */
	remove(name: string, opts?: RemoveOptions): void {
		this.inner.remove(name, opts);
		this.store.set();
	}

	/** @hidden */
	z_toRequest(): Cookies {
		return new Cookies(this.inner.toRequest(), this.store.stage());
	}

	/** @hidden */
	z_render(): void {
		this.inner.render?.();
		this.store.commit();
	}
}

export interface PlatformCookies {
	get(name: string): string | null;
	set(name: string, value: string, opts?: SetOptions): void;
	remove(name: string, opts?: RemoveOptions): void;
	toRequest(): PlatformCookies;
	render?: () => void;
}

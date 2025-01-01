import Listeners from 'chuchi-utils/sync/Listeners';
import Writable from './Writable.js';
import Readable from './Readable.js';

export default class Flag {
	private inner: Writable<boolean>;

	constructor(flag = false) {
		this.inner = new Writable(flag);
	}

	subscribe(fn: (flag: boolean) => void) {
		return this.inner.subscribe(fn);
	}

	set(flag: boolean) {
		this.inner.set(flag);
	}

	get(): boolean {
		return this.inner.get();
	}

	readonly(): Readable<boolean> {
		return new Readable(this.inner);
	}
}

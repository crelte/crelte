import Listeners from 'chuchi-utils/sync/Listeners';

export default class Flag {
	private flag: boolean;
	private listeners: Listeners<[boolean]>;

	constructor(flag = false) {
		this.flag = flag;
		this.listeners = new Listeners();
	}

	subscribe(fn: (flag: boolean) => void) {
		fn(this.flag);

		return this.listeners.add(fn);
	}

	set(flag: boolean) {
		this.flag = flag;
		this.listeners.trigger(this.flag);
	}

	get() {
		return this.flag;
	}
}

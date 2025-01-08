export type BarrierAction<T> = {
	// notify the barrier that you are ready
	ready: (val: T) => Promise<T>;
	// remove yourself from the barrier
	remove: () => void;
};

type Listener<T> = {
	ready: boolean;
	resolve: (val: T) => void;
};

/**
 * A class to help make async code execute at the same time.
 *
 * Making sure all participants are ready before continuing.
 */
export default class Barrier<T> {
	private listeners: Array<Listener<T> | null>;
	private lastValue: T | null;
	private open: boolean;

	constructor() {
		this.listeners = [];
		this.lastValue = null;
		this.open = false;
	}

	/**
	 * Returns true if the barrier is already opened meaning the add
	 * function would panic
	 */
	isOpen(): boolean {
		return this.open;
	}

	/**
	 * Add yourself to the barrier
	 *
	 * Only if all participants call ready the barrier is opened.
	 *
	 * @throws if the barrier is already open
	 */
	add(): BarrierAction<T> {
		if (this.open) throw new Error('Barrier is already open');

		const id = this.listeners.length;

		const obj: Listener<T> = {
			ready: false,
			resolve: () => {},
		};

		const readyPromise = new Promise<T>(resolve => {
			obj.resolve = resolve;
		});

		this.listeners[id] = obj;

		return {
			ready: async val => {
				if (this.open) throw new Error('Barrier is already open');

				this.lastValue = val;
				obj.ready = true;

				this._maybeTrigger();

				return await readyPromise;
			},
			remove: () => {
				if (this.open) throw new Error('Barrier is already open');

				// remove myself from the barrier
				this.listeners[id] = null;

				this._maybeTrigger();
			},
		};
	}

	private _maybeTrigger() {
		const ready = this.listeners.every(v => v === null || v.ready);
		// if all are ready
		if (!ready) return;

		// send the last value to all of them

		// the last value with always be T since either somebody called
		// ready so the value is set or everbody called remove which
		// means the value will never be read
		this.listeners.forEach(v => v?.resolve(this.lastValue as T));
		this.listeners = [];
		this.open = true;
	}
}

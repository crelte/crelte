import { type CrelteRequest } from '../index.js';

export type LoadRunnerOptions = {
	debugTiming: boolean;
};

export type LoadFn = (
	cr: CrelteRequest,
	opts: LoadOptions,
) => Promise<void> | void;

export type LoadOptions = {
	setProgress: (num: number) => void;
	isCanceled: () => boolean;
};

/**
 * The PageLoader which is responsible for loading page Data
 */
export default class LoadRunner {
	private debugTiming: boolean;
	private preloadedUrls: Set<string>;

	private loadingVersion: number;

	onProgress: (loading: boolean, progress?: number) => void;
	loadFn: LoadFn;

	/**
	 * Creates a new PageLoader
	 *
	 * @param {Object} options `{debugTiming}`
	 */
	constructor(options: LoadRunnerOptions) {
		this.debugTiming = options.debugTiming;
		this.preloadedUrls = new Set();

		this.loadingVersion = 0;

		this.onProgress = () => null!;
		this.loadFn = () => null!;
	}

	/**
	 * Discard the current page load if one is happening
	 */
	discard() {
		this.loadingVersion++;
		this.onProgress(false);
	}

	/**
	 * @returns true if the load was completed
	 *
	 * ## Throws
	 * if there was an error but not if the request
	 * was cancelled before
	 */
	async load(req: CrelteRequest): Promise<boolean> {
		this.onProgress(true);

		const version = ++this.loadingVersion;
		const startTime = this.debugTiming ? Date.now() : null;

		const isCanceled = () => this.loadingVersion !== version;

		const setProgress = (num: number) => {
			if (isCanceled()) return;

			this.onProgress(true, num);
		};

		// a function which should return the response
		let resp: () => void;
		try {
			const data = await this.loadFn(req, { isCanceled, setProgress });
			resp = () => data;
		} catch (e) {
			resp = () => {
				throw e;
			};
		}

		if (isCanceled()) {
			console.log('route changed quickly, ignoring response');
			return false;
		}

		this.onProgress(false);

		if (startTime)
			console.log('page load took ' + (Date.now() - startTime) + 'ms');

		return (resp(), true);
	}

	// you don't need to wait on this call
	async preload(cr: CrelteRequest) {
		const url = cr.req.url.origin + cr.req.url.pathname;
		if (this.preloadedUrls.has(url)) return;

		this.preloadedUrls.add(url);

		try {
			await this.loadFn(cr, {
				isCanceled: () => false,
				setProgress: () => null,
			});
		} catch (e) {
			console.log('preload failed', e);
			// retry at another time
			this.preloadedUrls.delete(url);
		}
	}
}

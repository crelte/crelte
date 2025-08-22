import { b } from 'vitest/dist/chunks/mocker.d.BE_2ls6u.js';
import Request from './Request.js';

export type PageLoaderOptions = {
	debugTiming: boolean;
};

export type LoadResponse =
	| {
			success: true;
			data: void;
	  }
	| {
			success: false;
			data: any;
	  };

export type LoadFn = (req: Request, opts: LoadOptions) => Promise<void> | void;

export type LoadOptions = {
	setProgress: (num: number) => void;
	isCanceled: () => boolean;
};

/**
 * The PageLoader which is responsible for loading page Data
 */
export default class LoadRunner<More> {
	private debugTiming: boolean;
	private preloadedUrls: Set<string>;

	private loadingVersion: number;

	onLoaded: (resp: LoadResponse, req: Request, more: More) => void;
	onProgress: (loading: boolean, progress?: number) => void;
	loadFn: LoadFn;

	/**
	 * Creates a new PageLoader
	 *
	 * @param {Object} options `{debugTiming}`
	 */
	constructor(options: PageLoaderOptions) {
		this.debugTiming = options.debugTiming;
		this.preloadedUrls = new Set();

		this.loadingVersion = 0;

		this.onLoaded = () => null!;
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

	async load(req: Request, more: More) {
		this.onProgress(true);

		const version = ++this.loadingVersion;
		const startTime = this.debugTiming ? Date.now() : null;

		const isCanceled = () => this.loadingVersion !== version;

		const setProgress = (num: number) => {
			if (this.loadingVersion !== version) return;

			this.onProgress(true, num);
		};

		let resp: LoadResponse;
		try {
			resp = {
				success: true,
				data: await this.loadFn(req, { isCanceled, setProgress }),
			};
		} catch (e) {
			resp = {
				success: false,
				data: e,
			};
		}

		if (startTime)
			console.log('page load took ' + (Date.now() - startTime) + 'ms');

		// if were the last that called loading, trigger the loaded event
		if (isCanceled())
			return console.log('route changed quickly, ignoring response');

		this.onProgress(false);
		this.onLoaded(resp, req, more);

		return resp;
	}

	// you don't need to wait on this call
	async preload(req: Request) {
		const url = req.url.origin + req.url.pathname;
		if (this.preloadedUrls.has(url)) return;

		this.preloadedUrls.add(url);

		try {
			await this.loadFn(req, { setProgress: () => null });
		} catch (_e) {
			console.log('preload failed');
			// retry at another time
			this.preloadedUrls.delete(url);
		}
	}
}

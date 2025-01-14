import Route from './Route.js';
import Site from './Site.js';

export type PageLoaderOptions = {
	debugTiming: boolean;
};

export type LoadResponse = {
	success: boolean;
	data: any;
};

export type LoadFn = (
	route: Route,
	site: Site,
	opts: LoadOptions,
) => Promise<any> | any;

export type LoadOptions = {
	setProgress: (num: number) => void;
};

/**
 * The PageLoader which is responsible for loading page Data
 */
export default class PageLoader<More> {
	private debugTiming: boolean;
	private preloadedUrls: Set<string>;

	private loadingVersion: number;

	onLoaded: (
		resp: LoadResponse,
		route: Route,
		site: Site,
		more: More,
	) => void;
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

	async load(route: Route, site: Site, more: More) {
		this.onProgress(true);

		const version = ++this.loadingVersion;
		const startTime = this.debugTiming ? Date.now() : null;

		const setProgress = (num: number) => {
			if (this.loadingVersion !== version) return;

			this.onProgress(true, num);
		};

		const resp: LoadResponse = { success: false, data: null };
		try {
			resp.data = await this.loadFn(route, site, { setProgress });
			resp.success = true;
		} catch (e) {
			resp.success = false;
			resp.data = e;
		}

		if (startTime)
			console.log('page load took ' + (Date.now() - startTime) + 'ms');

		// if were the last that called loading, trigger the loaded event
		if (this.loadingVersion !== version)
			return console.log('route changed quickly, ignoring response');

		this.onProgress(false);
		this.onLoaded(resp, route, site, more);
	}

	// you don't need to wait on this call
	async preload(route: Route, site: Site) {
		const url = route.url.origin + route.url.pathname;
		if (this.preloadedUrls.has(url)) return;

		this.preloadedUrls.add(url);

		try {
			await this.loadFn(route, site, { setProgress: () => null });
		} catch (_e) {
			console.log('preload failed');
			// retry at another time
			this.preloadedUrls.delete(url);
		}
	}
}

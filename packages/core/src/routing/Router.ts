import Route from './Route.js';
import Site, { SiteFromGraphQl } from './Site.js';
import InnerRouter from './InnerRouter.js';
import PageLoader, { LoadFn, LoadResponse } from './PageLoader.js';
import { ServerHistory } from './History.js';
import { Readable, Writable } from 'crelte-std/stores';
import { Listeners } from 'crelte-std/sync';
import Request, { RequestOptions } from './Request.js';

export type RouterOptions = {
	preloadOnMouseOver?: boolean;
	debugTiming?: boolean;
};

const defaultRouterOpts = {
	preloadOnMouseOver: false,
	debugTiming: false,
};

type LoadedMore = {
	changeHistory: () => void;
};

/**
 * internal only
 */
type Internal = {
	onLoaded: (
		success: boolean,
		req: Request,
		// call ready once your ready to update the dom
		// this makes sure we trigger a route and site update
		// almost at the same moment and probably the same tick
		// to make sure we don't have any flickering
		ready: () => any,
	) => void;

	// onNothingLoaded get's called if the request did not load new Data
	// since maybe a push or replace was called
	onNothingLoaded: (
		req: Request,
		// call ready once your ready to update the dom
		// this makes sure we trigger a route and site update
		// almost at the same moment and probably the same tick
		// to make sure we don't have any flickering
		ready: () => void,
	) => void;

	onLoad: LoadFn;

	domReady: (req: Request) => void;

	initClient: () => void;

	initServer: (url: string, acceptLang?: string) => Promise<ServerInited>;
};

type ServerInited = {
	success: boolean;
	// redirect to the route url
	redirect: boolean;
	req: Request;
	props: any;
};

// Make sure route and nextRoute are not the same object as _inner.route
export default class Router {
	/**
	 * The current route
	 */
	private _route: Writable<Route>;

	/**
	 * The current site
	 */
	private _site: Writable<Site>;

	// the next request, just here to destroy it
	private _request: Request | null;

	/**
	 * The loading flag, specifies if a page is currently
	 * getting loaded
	 */
	private _loading: Writable<boolean>;

	/**
	 * The loading progress, the value is between 0 and 1
	 */
	private _loadingProgress: Writable<number>;

	private _onRequest: Listeners<[Request]>;

	/** @hidden */
	_internal: Internal;

	private inner: InnerRouter;
	private pageLoader: PageLoader<LoadedMore>;

	constructor(sites: SiteFromGraphQl[], opts: RouterOptions = {}) {
		opts = { ...defaultRouterOpts, ...opts };

		this.inner = new InnerRouter(sites, {
			preloadOnMouseOver: opts.preloadOnMouseOver!,
		});
		this.pageLoader = new PageLoader({
			debugTiming: opts.debugTiming!,
		});

		// in the first onRoute call we will update this value
		this._route = new Writable(null!);
		this._site = new Writable(null!);
		this._request = null;
		this._loading = new Writable(false);
		this._loadingProgress = new Writable(0);

		this._onRequest = new Listeners();

		this._internal = {
			onLoaded: () => {},
			onNothingLoaded: () => {},
			onLoad: () => {},
			domReady: req => this.inner.domReady(req),
			initClient: () => this._initClient(),
			initServer: (url, acceptLang) => this._initServer(url, acceptLang),
		};

		this.inner.onRoute = (route, changeHistory) =>
			this._onRoute(route, changeHistory);
		this.inner.onPreload = route => this._onPreload(route);

		this.pageLoader.onLoaded = (resp, req, more) =>
			this._onLoaded(resp, req, more);
		this.pageLoader.loadFn = (req, opts) =>
			this._internal.onLoad(req, opts);
		this.pageLoader.onProgress = (loading, progress) =>
			this._onProgress(loading, progress);
	}

	/**
	 * returns a store with the current route
	 */
	get route(): Readable<Route> {
		return this._route.readclone();
	}

	/**
	 * returns a store with the current site
	 */
	get site(): Readable<Site> {
		return this._site.readonly();
	}

	/**
	 * The sites which are available
	 */
	get sites(): Site[] {
		return this.inner.sites;
	}

	/**
	 * returns a store which indicates if the a page is loading
	 */
	get loading(): Readable<boolean> {
		return this._loading.readonly();
	}

	/**
	 * returns a store which indicates the loading progress between 0 and 1
	 */
	get loadingProgress(): Readable<number> {
		return this._loadingProgress.readonly();
	}

	/**
	 * Open a new route
	 *
	 * @param target the target to open can be an url, a route or a request
	 * the url needs to start with http or with a / which will be considered as
	 * the site baseUrl
	 *
	 * ## Note
	 * The origin will always be set to 'manual'
	 *
	 * ## Example
	 * ```
	 * import { getRouter } from 'crelte';
	 *
	 * const router = getRouter();
	 * console.log(router.site.get().url.href); // 'https://example.com/de';
	 *
	 * router.open('/foo/bar');
	 * // the following page will be opened https://example.com/de/foo/bar
	 * ```
	 */
	open(target: string | URL | Route | Request, opts: RequestOptions = {}) {
		const req = this.inner.targetToRequest(target, {
			...opts,
			origin: 'manual',
		});
		this.inner.open(req);
	}

	/**
	 * This pushes the new route without triggering a new pageload
	 *
	 * You can use this when using pagination for example change the route object
	 * (search argument) and then call pushState
	 *
	 * ## Note
	 * This will always set the origin to 'push'
	 * And will clear the scrollY value if you not provide a new one via the `opts`
	 * This will disableLoadData by default if you not provide an override via the `opts`
	 *
	 * ## Example
	 * ```
	 * import { getRouter } from 'crelte';
	 *
	 * const router = getRouter();
	 *
	 * const page = 1;
	 * const route = router.route.get();
	 * route.setSearchParam('page', page > 0 ? page : null);
	 * router.pushState(route);
	 * ```
	 */
	push(route: Route | Request, opts: RequestOptions = {}) {
		// cancel previous request
		this.pageLoader.discard();
		const req = this.inner.targetToRequest(route, {
			...opts,
			origin: 'push',
			scrollY: opts.scrollY ?? undefined,
			disableLoadData: opts.disableLoadData ?? true,
		});
		this.inner.push(req);
		this.destroyRequest();
		this.setNewRoute(route);
	}

	/**
	 * @deprecated use push instead
	 */
	pushState(route: Route | Request) {
		this.push(route);
	}

	/**
	 * This replaces the state of the route without triggering an event
	 *
	 * You can use this when using some filters for example a search filter
	 *
	 * ## Note
	 * This will always set the origin to 'replace'
	 * And will clear the scrollY value if you not provide a new one via the `opts`
	 * This will disableLoadData by default if you not provide an override via the `opts`
	 *
	 * ## Example
	 * ```
	 * import { getRouter } from 'crelte';
	 *
	 * const router = getRouter();
	 *
	 * const search = 'foo';
	 * const route = router.route.get();
	 * route.setSearchParam('search', search ? search : null);
	 * router.replaceState(route);
	 * ```
	 */
	replace(route: Route | Request, opts: RequestOptions = {}) {
		// cancel previous request
		this.pageLoader.discard();
		const req = this.inner.targetToRequest(route, {
			origin: 'replace',
			scrollY: opts.scrollY ?? undefined,
			disableLoadData: opts.disableLoadData ?? true,
		});
		this.inner.replace(req);
		this.destroyRequest();
		this.setNewRoute(req);
	}

	/**
	 * @deprecated use replace instead
	 */
	replaceState(route: Route | Request) {
		this.replace(route);
	}

	/**
	 * Checks if there are previous routes which would allow it to go back
	 */
	canGoBack(): boolean {
		return this.inner.route?.canGoBack() ?? false;
	}

	/**
	 * Go back in the history
	 */
	back() {
		this.inner.history.back();
	}

	/**
	 * Preload a url
	 */
	preload(target: string | URL | Route) {
		this.inner.preload(target);
	}

	/**
	 * Add a listener for the onRoute event
	 *
	 * This will trigger every time a new route is set
	 * and is equivalent to router.route.subscribe(fn)
	 *
	 * @returns a function to remove the listener
	 */
	onRoute(fn: (route: Route) => void): () => void {
		return this.route.subscribe(fn);
	}

	/**
	 * Add a listener for the onRequest event
	 *
	 * This will trigger every time a new route is requested
	 *
	 * @returns a function to remove the listener
	 */
	onRequest(fn: (req: Request) => void): () => void {
		return this._onRequest.add(fn);
	}

	private setNewRoute(route: Route) {
		this._route.setSilent(route);
		const siteChanged = this.site.get()?.id !== route.site.id;
		this._site.setSilent(route.site);
		this._route.notify();
		if (siteChanged) this._site.notify();
	}

	private async _initClient() {
		this.inner.initClient();
	}

	private async _initServer(
		url: string,
		acceptLang?: string,
	): Promise<ServerInited> {
		this.inner.initServer();

		this._internal.onNothingLoaded = (_req, ready) => {
			ready();
		};

		const prom: Promise<ServerInited> = new Promise(resolve => {
			this._internal.onLoaded = (success, req, ready) => {
				const props = ready();
				this._internal.onLoaded = () => {};

				resolve({
					success,
					redirect: false,
					req,
					props,
				});
			};
		});

		const route = this.inner.targetToRequest(url);
		route.origin = 'init';

		// let's see if the url matches any route and site
		// if not let's redirect to the site which matches the acceptLang
		if (!route.siteMatches()) {
			const site = this.inner.siteByAcceptLang(acceptLang);

			return {
				success: true,
				redirect: true,
				req: new Request(site.url, site),
				props: {},
			};
		}

		this.inner.setRoute(route);

		const resp = await prom;

		const hist = this.inner.history as ServerHistory;
		if (hist.url || hist.req) {
			const nReq = this.inner.targetToRequest(hist.req ?? hist.url!);
			if (!route.eq(nReq)) {
				return {
					success: true,
					redirect: true,
					req: nReq,
					props: {},
				};
			}
		}

		return resp;
	}

	private _onRoute(req: Request, changeHistory: () => void) {
		this.destroyRequest();

		this._request = req;

		const barrier = req._renderBarrier;
		if (barrier.isOpen()) {
			throw new Error('render barrier is already open');
		}

		this._onRequest.trigger(req);

		// route prepared
		if (!req.disableLoadData) {
			this.pageLoader.load(req, { changeHistory });
		} else {
			this._onNothingLoaded(req, { changeHistory });
		}
	}

	private destroyRequest() {
		if (!this._request) return;

		this._request._renderBarrier.cancel();
		this._request = null;
	}

	private _onPreload(req: Request) {
		this.pageLoader.preload(req);
	}

	private async _onLoaded(
		resp: LoadResponse,
		req: Request,
		more: LoadedMore,
	) {
		// check if the render was cancelled
		if (await req._renderBarrier.ready()) return;

		// when the data is loaded let's update the route of the inner
		// this is will only happen if no other route has been requested
		// in the meantime
		more.changeHistory();

		const route = req.toRoute();

		// call the client or server saying we are ready for a new render
		this._internal.onLoaded(resp.success, req, () => {
			this.setNewRoute(route);
			return resp.data;
		});
	}

	private async _onNothingLoaded(req: Request, more: LoadedMore) {
		// check if the render was cancelled
		if (await req._renderBarrier.ready()) return;

		// when the data is loaded let's update the route of the inner
		// this is will only happen if no other route has been requested
		// in the meantime
		more.changeHistory();

		const route = req.toRoute();

		// call the client or server saying there was an update in the route
		// but no new data was loaded so no render should happen
		this._internal.onNothingLoaded(req, () => {
			this.setNewRoute(route);
		});
	}

	private _onProgress(loading: boolean, progress?: number): void {
		if (this._loading.get() !== loading) this._loading.set(loading);

		if (typeof progress === 'number') this._loadingProgress.set(progress);
	}
}

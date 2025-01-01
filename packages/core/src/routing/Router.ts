import Writable from '../stores/Writable.js';
import Route from './Route.js';
import Site, { SiteFromGraphQl } from './Site.js';
import InnerRouter from './InnerRouter.js';
import PageLoader, { LoadFn, LoadResponse } from './PageLoader.js';
import { Flag, Readable } from '../stores/index.js';

export type RouterOpts = {
	preloadOnMouseOver?: boolean;
	debugTiming?: boolean;
};

const defaultRouterOpts = {
	preloadOnMouseOver: false,
	deubgTiming: false,
};

/**
 * internal only
 */
type Internal = {
	onLoaded: (
		success: boolean,
		route: Route,
		site: Site,
		// call ready once your ready to update the dom
		// this makes sure we trigger a route and site update
		// almost at the same moment and probably the same tick
		// to make sure we don't have any flickering
		ready: () => any,
	) => void;

	onLoad: LoadFn;

	domReady: (route: Route) => void;

	initClient: () => void;

	initServer: (url: string, acceptLang?: string) => Promise<ServerInited>;
};

type ServerInited = {
	success: boolean;
	// redirect to the route url
	redirect: boolean;
	route: Route;
	site: Site;
	props: any;
};

export function trimSlashEnd(str: string) {
	return str.endsWith('/') ? str.substring(0, str.length - 1) : str;
}

export default class Router {
	/**
	 * The current route
	 *
	 * this is a svelte store
	 */
	private _route: Writable<Route>;

	/**
	 * The current site
	 */
	private _site: Writable<Site>;

	/**
	 * The next route which is currently being loaded
	 */
	private _nextRoute: Writable<Route>;

	/**
	 * The next site which is currently being loaded
	 */
	private _nextSite: Writable<Site>;

	/**
	 * The loading flag, specifies if a page is currently
	 * getting loaded
	 */
	private _loading: Flag;

	/**
	 * The loading progress, the value is between 0 and 1
	 */
	private _loadingProgress: Writable<number>;

	// doc hidden
	_internal: Internal;

	private inner: InnerRouter;
	private pageLoader: PageLoader;

	constructor(sites: SiteFromGraphQl[], opts: RouterOpts = {}) {
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
		this._nextRoute = new Writable(null!);
		this._nextSite = new Writable(null!);
		this._loading = new Flag();
		this._loadingProgress = new Writable(0);

		this._internal = {
			onLoaded: () => {},
			onLoad: () => {},
			domReady: route => this.inner.domReady(route),
			initClient: () => this.inner.initClient(),
			initServer: (url, acceptLang) => this._initServer(url, acceptLang),
		};

		this.inner.onRoute = (route, site) => this._onRoute(route, site);
		this.inner.onPreload = (route, site) => this._onPreload(route, site);

		this.pageLoader.onLoaded = (resp, route, site) =>
			this._onLoaded(resp, route, site);
		this.pageLoader.loadFn = (route, site, opts) =>
			this._internal.onLoad(route, site, opts);
		this.pageLoader.onProgress = (loading, progress) =>
			this._onProgress(loading, progress);
	}

	/**
	 * The current route
	 *
	 * this is a svelte store
	 */
	get route(): Readable<Route> {
		return this._route.readonly();
	}

	/**
	 * The current site
	 */
	get site(): Readable<Site> {
		return this._site.readonly();
	}

	/**
	 * The next route which is currently being loaded
	 */
	get nextRoute(): Readable<Route> {
		return this._nextRoute.readonly();
	}

	/**
	 * The next site which is currently being loaded
	 */
	get nextSite(): Readable<Site> {
		return this._nextSite.readonly();
	}

	/**
	 * The loading flag, specifies if a page is currently
	 * getting loaded
	 */
	get loading(): Readable<boolean> {
		return this._loading.readonly();
	}

	/**
	 * The loading progress, the value is between 0 and 1
	 */
	get loadingProgress(): Readable<number> {
		return this._loadingProgress.readonly();
	}

	/**
	 * Open a new route
	 *
	 * @param target the target to open can be an url or a route
	 * the url needs to start with http or with a / which will be considered as
	 * the site baseUrl
	 */
	open(target: string | URL | Route) {
		this.inner.open(target);
	}

	/**
	 * This pushes the state of the route without triggering an event
	 *
	 * You can use this when using pagination for example change the route object
	 * (search argument) and then call pushState
	 *
	 * @param route
	 */
	pushState(route: Route) {
		this.pageLoader.discard();
		this.inner.pushState(route);
		this.setNewRoute(route);
	}

	/**
	 * This replaces the state of the route without triggering an event
	 *
	 * @param route
	 */
	replaceState(route: Route) {
		this.pageLoader.discard();
		this.inner.replaceState(route);
		this.setNewRoute(route);
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
		window.history.back();
	}

	/**
	 * Preload a url
	 */
	preload(target: string | URL | Route) {
		this.inner.preload(target);
	}

	private setNewRoute(route: Route) {
		this._route.setSilent(route);
		this._nextRoute.setSilent(route);

		if (route.site) {
			this._site.setSilent(route.site);
			this._nextSite.setSilent(route.site);
		}
	}

	private async _initServer(
		url: string,
		acceptLang?: string,
	): Promise<ServerInited> {
		const prom: Promise<ServerInited> = new Promise(resolve => {
			this._internal.onLoaded = (success, route, site, ready) => {
				const props = ready();
				this._internal.onLoaded = () => {};

				resolve({
					success,
					redirect: false,
					route,
					site,
					props,
				});
			};
		});

		const route = this.inner.targetToRoute(url);

		// let's see if the url matches any route and site
		// if not let's redirect to the site which matches the acceptLang
		if (!route.site) {
			const site = this.inner.siteByAcceptLang(acceptLang);

			return {
				success: true,
				redirect: true,
				route: new Route(site.url, site),
				site,
				props: {},
			};
		}

		this.inner.setRoute(route);

		return await prom;
	}

	private _onRoute(route: Route, site: Site) {
		this._nextRoute.setSilent(route);
		const siteChanged = this.nextSite.get()?.id !== site.id;
		this._nextSite.setSilent(site);
		this._nextRoute.notify();
		if (siteChanged) this._nextSite.notify();

		// route prepared
		this.pageLoader.load(route, site);
	}

	private _onPreload(route: Route, site: Site) {
		this.pageLoader.preload(route, site);
	}

	private _onLoaded(resp: LoadResponse, route: Route, site: Site) {
		const updateRoute = () => {
			this._route.setSilent(route);
			const siteChanged = this.site.get()?.id !== site.id;
			this._site.setSilent(site);
			this._route.notify();
			if (siteChanged) this._site.notify();
		};

		this._internal.onLoaded(resp.success, route, site, () => {
			updateRoute();
			return resp.data;
		});
	}

	private _onProgress(loading: boolean, progress?: number): void {
		if (this._loading.get() !== loading) this._loading.set(loading);

		if (typeof progress === 'number') this._loadingProgress.set(progress);
	}
}

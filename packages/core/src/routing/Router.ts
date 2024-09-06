import Writable from '../stores/Writable.js';
import Route from './Route.js';
import Site, { SiteFromGraphQl } from './Site.js';
import InnerRouter from './InnerRouter.js';
import PageLoader, { LoadFn, LoadResponse } from './PageLoader.js';
import { Flag } from '../stores/index.js';

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
	route: Writable<Route>;

	/**
	 * The current site
	 */
	site: Writable<Site>;

	/**
	 * The next route which is currently being loaded
	 */
	nextRoute: Writable<Route>;

	/**
	 * The next site which is currently being loaded
	 */
	nextSite: Writable<Site>;

	/**
	 * The loading flag, specifies if a page is currently
	 * getting loaded
	 */
	loading: Flag;

	/**
	 * The loading progress, the value is between 0 and 1
	 */
	loadingProgress: Writable<number>;

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
		this.route = new Writable(null!);
		this.site = new Writable(null!);
		this.nextRoute = new Writable(null!);
		this.nextSite = new Writable(null!);
		this.loading = new Flag();
		this.loadingProgress = new Writable(0);

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
	 * Open a new route
	 *
	 * @param target the target to open can be an url or a route
	 * the url needs to start with http or with a / which will be considered as
	 * the site baseUrl
	 */
	open(target: string | URL | Route) {
		if (typeof target === 'string') {
			if (target.startsWith('/')) {
				const site = this.inner.site;
				target = new URL(site.uri + target, site.url);
			} else {
				target = new URL(target);
			}
		}

		if (target instanceof URL) {
			target = this.inner.routeFromUrl(target);
		}

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
	preload(url: string) {
		this.inner.preloadUrl(url);
	}

	private setNewRoute(route: Route) {
		this.route.setSilent(route);
		this.nextRoute.setSilent(route);

		if (route.site) {
			this.site.setSilent(route.site);
			this.nextSite.setSilent(route.site);
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

		const route = this.inner.routeFromUrl(url);

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
		this.nextRoute.setSilent(route);
		const siteChanged = this.nextSite.get()?.id !== site.id;
		this.nextSite.setSilent(site);
		this.nextRoute.notify();
		if (siteChanged) this.nextSite.notify();

		// route prepared
		this.pageLoader.load(route, site);
	}

	private _onPreload(route: Route, site: Site) {
		this.pageLoader.preload(route, site);
	}

	private _onLoaded(resp: LoadResponse, route: Route, site: Site) {
		const updateRoute = () => {
			this.route.setSilent(route);
			const siteChanged = this.site.get()?.id !== site.id;
			this.site.setSilent(site);
			this.route.notify();
			if (siteChanged) this.site.notify();
		};

		this._internal.onLoaded(resp.success, route, site, () => {
			updateRoute();
			return resp.data;
		});
	}

	private _onProgress(loading: boolean, progress?: number): void {
		if (this.loading.get() !== loading) this.loading.set(loading);

		if (typeof progress === 'number') this.loadingProgress.set(progress);
	}
}

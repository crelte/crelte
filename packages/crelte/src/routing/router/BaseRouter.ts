/**
 * This is the Router which we internally extend from
 * it does not directly get exposed
 */

import Request, { isRequest, RequestOptions } from '../route/Request.js';
import Route from '../route/Route.js';
import Site, { SiteFromGraphQl, siteFromUrl } from '../Site.js';
import LoadRunner, { LoadRunnerOptions } from '../LoadRunner.js';
import { type CrelteRequest } from '../../index.js';
import { isPromise } from '../../utils.js';
import { Listeners } from '../../std/sync/index.js';
import { Writable } from '../../std/stores/index.js';
import { Entry } from '../../loadData/index.js';
import { preferredSite } from '../utils.js';

export type BaseRouterOptions = {} & LoadRunnerOptions;

const INF_LOOP_CHECK = '__REQ_FROM_REQ_START__';

export default class BaseRouter {
	sites: Site[];
	languages: string[];

	/**
	 * The current route
	 *
	 * ## Note
	 * Will always contain a route except in the first loadData call
	 */
	route: Writable<Route | null>;

	// todo should probably be a derived
	/**
	 * The current site
	 *
	 * ## Note
	 * Will always contain a site except in the first loadData call
	 */
	site: Writable<Site | null>;

	// todo should probably be a derived
	/**
	 * The current entry
	 *
	 *  ## Note
	 * Will always contain an entry except in the first loadData call
	 */
	entry: Writable<Entry | null>;

	// the next request if it is not only a preload request
	request: Request | null;

	/**
	 * The loading flag, specifies if a page is currently
	 * getting loaded
	 */
	loading: Writable<boolean>;

	/**
	 * The loading progress, the value is between 0 and 1
	 */
	loadingProgress: Writable<number>;

	onNewCrelteRequest: (req: Request) => CrelteRequest;

	/**
	 * Not sure the naming here is great but
	 */
	onBeforeRequest: (cr: CrelteRequest) => Promise<void> | void;

	onRequestListeners: Listeners<[CrelteRequest]>;

	loadRunner: LoadRunner;

	onRouteListeners: Listeners<[Route]>;

	/// should return once the render is done
	onRender: (
		cr: CrelteRequest,
		/**
		 * ## Throws
		 * if the route is missing entry, template or loadedData
		 */
		readyForRoute: () => Route,
		domUpdated: (cr: CrelteRequest, route: Route) => void,
	) => Promise<Route> | Route;

	constructor(
		sites: SiteFromGraphQl[],
		languages: string[],
		opts: BaseRouterOptions,
	) {
		this.sites = sites.map(s => new Site(s));
		this.languages = languages;
		this.route = new Writable(null);
		this.site = new Writable(null);
		this.entry = new Writable(null);
		this.request = null;
		this.loading = new Writable(false);
		this.loadingProgress = new Writable(0);
		this.onNewCrelteRequest = () => null!;
		this.onBeforeRequest = () => {};
		this.onRequestListeners = new Listeners();
		this.loadRunner = new LoadRunner(opts);
		this.onRouteListeners = new Listeners();
		this.onRender = async () => null!;

		// todo move this to the client?
		this.loadRunner.onProgress = (loading, progress) => {
			if (this.loading.get() !== loading) this.loading.set(loading);

			if (typeof progress === 'number')
				this.loadingProgress.set(progress);
		};
	}

	/**
	 * Get the primary site
	 */
	primarySite(): Site {
		return this.sites.find(s => s.primary) ?? this.sites[0];
	}

	/**
	 * todo check that the router uses the correct sites for each function
	 */
	defaultSite(): Site {
		return this.preferredSite() ?? this.primarySite();
	}

	preferredSite(): Site | null {
		return preferredSite(this.sites, this.languages);
	}

	/**
	 * Tries to get a site by it's id
	 */
	siteById(id: number): Site | null {
		return this.sites.find(s => s.id === id) ?? null;
	}

	// keep this doc in sync with Router.targetToRequest
	/**
	 * Resolve a url or Route and convert it to a Request
	 *
	 * @param target
	 * @param opts, any option present will override the value in target
	 * @return Returns null if the url does not match our host (the protocol get's ignored)
	 */
	targetToRequest(
		target: string | URL | Route | Request,
		opts: RequestOptions = {},
	): Request {
		if (typeof target === 'string') {
			if (target.startsWith('/')) {
				// todo should we use the language matching or throw if the route does not
				// exists
				const site = this.route.get()?.site ?? this.primarySite();
				target = new URL(site.uri + target, site.url);
			} else if (!target) {
				throw new Error('the url is not allowed to be empty');
			} else {
				target = new URL(target);
			}
		}

		if (target instanceof URL) {
			target = this.requestFromUrl(target);
		}

		if (!isRequest(target)) {
			return Request.fromRoute(target, opts);
		}

		target.z_updateOpts(opts);
		return target;
	}

	/**
	 * Resolve a url and convert it to a Request
	 *
	 * @param url
	 * @return Returns null if the url does not match our host (the protocol get's ignored)
	 */
	requestFromUrl(fullUrl: URL): Request {
		// strip stuff we dont need from url
		const req = new Request(fullUrl, null!);

		const site = siteFromUrl(this.sites, req.url);

		// todo should we throw if we can't find a site
		// or use the site which matches the language
		req.site = site ?? this.primarySite();

		return req;
	}

	/** You are not allowed to pass in the same request twice */
	async openRequest(_req: Request): Promise<Route | void> {
		throw new Error('env specific');
	}

	pushRequest(
		_req: Request,
		_opts: RequestOptions = {},
	): Promise<Route | void> {
		throw new Error('env specific');
	}

	async replaceRequest(
		_req: Request,
		_opts: RequestOptions = {},
	): Promise<Route | void> {
		throw new Error('env specific');
	}

	/**
	 * Checks if there are previous routes which would allow it to go back
	 */
	canGoBack(): boolean {
		return this.route.get()?.canGoBack() ?? false;
	}

	/**
	 * Go back in the history
	 */
	back() {
		throw new Error('env specific');
	}

	async preload(target: string | URL | Route | Request) {
		const req = this.targetToRequest(target, { origin: 'preload' });
		const current = this.route.get();

		// if the origin matches, the route will be able to be load
		// so let's preload it
		if (current && current.url.origin === req.url.origin) {
			// todo i don't wan't to send a CrelteRequest?
			// todo, it would be nice if this could not have any side effects
			// but at the moment cr.router.open will cause a redirect
			this.loadRunner.preload(this.onNewCrelteRequest(req));
		}
	}

	cancelRequest() {
		// destroy the old request
		if (this.request) {
			this.request.cancel();
			this.request = null;
		}
	}

	/**
	 * ## Throws
	 * If the request completed but had an error
	 */
	async handleRequest(
		req: Request,
		updateHistory: (route: Route) => void,
	): Promise<Route | void> {
		// this isCancelled check is not if a user cancelled the request
		// but if the router cancelled the request, because for example
		// the user clicked on a new link or an event decided to call open
		const isCancelled = () => req.cancelled;

		// cancel the previous request
		this.cancelRequest();

		const barrier = req.z_renderBarrier;
		if (barrier.isOpen()) throw new Error('the request was already used');

		// not sure this really helps
		// it should be in open maybe?
		if (req.getContext(INF_LOOP_CHECK))
			throw new Error('infinite loop detected');

		this.request = req;
		const cr = this.onNewCrelteRequest(req);

		// trigger event onRequestStart
		const onBeforeReqProm = this.onBeforeRequest(cr);
		if (isPromise(onBeforeReqProm)) await onBeforeReqProm;
		if (isCancelled()) return;

		// if the request does not have a matching site, redirect
		if (!req.siteMatches()) {
			const site = this.defaultSite();
			const req = new Request(site.url, site);
			req.setContext(INF_LOOP_CHECK, true);
			return await this.openRequest(req);
		}

		// trigger onRequest listeners (this is not an event and more intended
		// to be used by the actual site and not a plugin)
		this.onRequestListeners.trigger(cr);
		if (isCancelled()) return;

		//!! this block might throw if something did not work as expected
		// todo do we wan't this?
		if (!req.disableLoadData) {
			const completed = await this.loadRunner.load(cr);
			// the request was succeeded by some other request
			if (!completed) return;
		} else {
			// just discard the old one since nobody will wan't it
			this.loadRunner.discard();
			this.copyEntryToRequest(req);
		}

		// check if the render was cancelled
		// else wait until the renderBarrier gets opened
		const readyProm = req.z_renderBarrier.ready();
		const wasCancelled = isPromise(readyProm) ? await readyProm : readyProm;
		if (wasCancelled || isCancelled()) return;

		// the onRender should decide by itself if it wants to render or not
		// for example in most cases if !entryChanged it does not make sense to render
		return await this.onRender(
			cr,
			// readyForRoute
			() => {
				// throws if the route is missing entry, template or loadedData
				// or the request was cancelled
				const route = req.toRoute();

				updateHistory(route);

				// update route, site and onRoute
				this.triggerRoute(route);

				return route;
			},
			// domUpdated
			// we use a callback to maybe decrease latency?
			(cr, route) => {
				this.updateScroll(cr, route);
			},
		);
	}

	copyEntryToRequest(req: Request) {
		const route = this.route.get();
		if (!route)
			throw new Error(
				'the first request is not allowed to disableLoadData',
			);

		req.entry = route.entry;
		req.template = route.template;
		req.loadedData = route.loadedData;
	}

	triggerRoute(route: Route) {
		this.route.setSilent(route);
		const siteChanged = this.site.get()?.id !== route.site.id;
		this.site.setSilent(route.site);
		this.entry.setSilent(route.entry);

		// trigger an update
		this.route.notify();
		if (siteChanged) this.site.notify();
		if (route.entryChanged) this.entry.notify();
		this.onRouteListeners.trigger(route);
	}

	updateScroll(_cr: CrelteRequest, _route: Route) {}
}

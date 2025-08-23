/**
 * This is the Router which we internally extend from
 * it does not directly get exposed
 */

import { Writable } from 'crelte-std/stores';
import Request, { isRequest, RequestOptions } from './Request.js';
import Route from './Route.js';
import Site, { SiteFromGraphQl, siteFromUrl } from './Site.js';
import { matchAcceptLang } from './utils.js';
import { UpdateRequest } from './Router.js';
import LoadRunner, { LoadRunnerOptions } from './LoadRunner.js';
import { type CrelteRequest } from '../index.js';
import { Listeners } from 'crelte-std/sync';
import { objClone } from '../utils.js';

export type BaseRouterOptions = {} & LoadRunnerOptions;

const INF_LOOP_CHECK = '__REQ_FROM_REQ_START__';

export default class BaseRouter {
	sites: Site[];
	private sitesByLanguage: Map<string, Site>;

	/**
	 * The current route
	 *
	 * ## Note
	 * Will always contain a route except in the first loadData call
	 */
	route: Writable<Route | null>;

	/**
	 * The current site
	 *
	 * ## Note
	 * Will always contain a site except in the first loadData call
	 */
	site: Writable<Site | null>;

	// the next request if it is not only a preload request
	request: Request | null;

	onNewCrelteRequest: (req: Request) => CrelteRequest;

	onRequestStart: (cr: CrelteRequest) => Promise<void> | void;

	onRequestListeners: Listeners<[Request]>;

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
		domUpdated: () => void,
	) => Promise<Route>;

	constructor(sites: SiteFromGraphQl[], opts: BaseRouterOptions) {
		this.sites = sites.map(s => new Site(s));
		this.sitesByLanguage = new Map(this.sites.map(s => [s.language, s]));
		this.route = new Writable(null);
		this.site = new Writable(null);
		this.request = null;
		this.onNewCrelteRequest = () => null!;
		this.onRequestStart = () => {};
		this.onRequestListeners = new Listeners();
		this.loadRunner = new LoadRunner(opts);
		this.onRouteListeners = new Listeners();
		this.onRender = async () => {};
	}

	/**
	 * Get the default site
	 */
	primarySite(): Site {
		return this.sites.find(s => s.primary) ?? this.sites[0];
	}

	/**
	 * Should be override by environment specific router
	 *
	 * This should be based on the language
	 *
	 * todo check that the router uses the correct sites for each function
	 */
	defaultSite(): Site {
		return this.primarySite();
	}

	/**
	 * Get a site and if possible use the accept lang header.
	 *
	 * @param acceptLang Accept Language header.
	 */
	siteByAcceptLang(acceptLang: string | null = null): Site {
		if (!acceptLang) return this.primarySite();

		const lang = matchAcceptLang(
			acceptLang,
			Array.from(this.sitesByLanguage.keys()),
		);

		return lang ? this.sitesByLanguage.get(lang)! : this.primarySite();
	}

	/**
	 * Tries to get a site by it's id
	 */
	siteById(id: number): Site | null {
		return this.sites.find(s => s.id === id) ?? null;
	}

	/**
	 * Todo, this should only be on the router
	 * because it knows which the current route is
	 * So everything behaves as expected
	 *
	 * Transforms a target to a request
	 *
	 * returns null if the request was canceled by the update request
	 */
	targetOrUpdateToRequest(
		target: string | URL | Route | Request | UpdateRequest,
		opts: RequestOptions = {},
		forcedOpts: RequestOptions = {},
	): Request | null {
		// we have an update request
		if (typeof target === 'function') {
			const route = this.route.get();
			if (!route) {
				// todo should we use the request here?
				throw new Error(
					'route to update missing in first loadData call. ' +
						'Use cr.req.clone() instead',
				);
			}

			// first get a req
			const req = this.targetToRequest(route, opts);
			// check if the request was canceled by the update request
			if (target(req) === false) return null;

			// now we add the forcedOpts
			req._updateOpts(forcedOpts);

			return req;
		}

		return this.targetToRequest(target, {
			...opts,
			...forcedOpts,
		});
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

		target._updateOpts(opts);
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

		const site = siteFromUrl(req.url, this.sites);

		// todo should we throw if we can't find a site
		// or use the site which matches the language
		req.site = site ?? this.primarySite();

		return req;
	}

	async openRequest(_req: Request) {
		throw new Error('environment specific');
	}

	// async open() {
	// 	throw new Error('environment specific');
	// }

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

		// destroy the old request
		if (this.request) {
			this.request._cancel();
			this.request = null;
		}

		const barrier = req._renderBarrier;
		if (barrier.isOpen()) throw new Error('the request was already used');

		// not sure this really helps
		// it should be in open maybe?
		if (req.getContext(INF_LOOP_CHECK))
			throw new Error('infinite loop detected');

		this.request = req;
		const cr = this.onNewCrelteRequest(req);

		// trigger event onRequestStart
		const onReqStartProm = this.onRequestStart(cr);
		if (isPromise(onReqStartProm)) await onReqStartProm;
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
		this.onRequestListeners.trigger(req);
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
		const readyProm = req._renderBarrier.ready();
		const wasCancelled = isPromise(readyProm) ? await readyProm : readyProm;
		if (wasCancelled || isCancelled()) return;

		// todo should onRender not happen if the request was cancelled?
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
			() => {
				this.updateScroll();
			},
		);
	}

	copyEntryToRequest(req: Request) {
		const route = this.route.get();
		if (!route)
			throw new Error(
				'the first request is not allowed to disableLoadData',
			);

		req.entry = objClone(route.entry);
		req.template = route.template;
		req.loadedData = objClone(route.loadedData);
	}

	triggerRoute(route: Route) {
		this.route.setSilent(route);
		const siteChanged = this.site.get()?.id !== route.site.id;
		this.site.setSilent(route.site);

		// trigger an update
		this.route.notify();
		if (siteChanged) this.site.notify();
		this.onRouteListeners.trigger(route);
	}

	updateHistory(_req: Request) {}

	updateScroll() {}
}

function isPromise<T>(p: Promise<T> | T): p is Promise<T> {
	return typeof (p as any)?.then === 'function';
}

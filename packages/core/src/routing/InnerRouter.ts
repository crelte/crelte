import Site, { SiteFromGraphQl, siteFromUrl } from './Site.js';
import History from './History.js';
import { ClientHistory, ServerHistory } from './History.js';
import Request, { isRequest, RequestOptions } from './Request.js';
import Route from './Route.js';

export type InnerRouterOpts = {
	preloadOnMouseOver: boolean;
};

/**
 * Manages event listeners or functions.
 */
export default class InnerRouter {
	sites: Site[];
	/**
	 * The current route
	 *
	 * ## Null
	 * It might be null on the first targetToRequest, open, and routeFromUrl call
	 */
	route: Route | null;
	history: History;
	preloadOnMouseOver: boolean;
	/**
	 * @param changeHistory returns a function you need to call when you are ready to
	 update the window history (note do not call this after another onRoute call was made)
	 */
	onRoute: (route: Request, changeHistory: () => void) => void;
	onPreload: (route: Request) => void;

	private scrollDebounceTimeout: any | null;

	/**
	 * Creates a new Router
	 *
	 * @param sites - sites needs to be from craft-graphql-sites plugin
	 * @param opts - Options for the router
	 */
	constructor(sites: SiteFromGraphQl[], opts: InnerRouterOpts) {
		this.sites = sites.map(s => new Site(s));

		this.route = null;
		// @ts-ignore
		this.history = import.meta.env.SSR
			? new ServerHistory()
			: new ClientHistory();
		this.preloadOnMouseOver = opts.preloadOnMouseOver;

		// this.preloadListeners = new Listeners();

		this.onRoute = () => {};
		this.onPreload = () => {};

		this.scrollDebounceTimeout = null;
	}

	/**
	 * Initializes the router when running on the client.
	 */
	initClient() {
		this.listen();

		// let's first try to load from the state
		const req = this.targetToRequest(window.location.href);
		req._fillFromState(window.history.state);

		req.origin = 'init';
		window.history.scrollRestoration = 'manual';

		// we set it now instead of waiting for the onRoute call
		// because the window.history is already set
		this.route = req.toRoute();
		this.onRoute(req, () => {});
	}

	/**
	 * Initializes the router when running on the server.
	 */
	initServer() {}

	/**
	 * Get a site and if possible use the accept lang header.
	 *
	 * @param acceptLang Accept Language header.
	 */
	siteByAcceptLang(acceptLang: string | null = null): Site {
		if (!acceptLang) return this.defaultSite();

		const directives = acceptLang
			.split(',')
			.map(d => d.trim())
			.filter(d => !!d);

		// let's expect that weights are correctly ordered
		const languages = directives
			.map(d => {
				const lang = d.split(';');
				return lang[0].trim();
			})
			.filter(d => !!d);

		// find a site which matches the language
		// first try to match the full language
		for (const lang of languages) {
			const site = this.sites.find(s => s.language === lang);
			if (site) return site;
		}

		// if we don't find any language which matches
		// try to match languages without the -
		for (let lang of languages) {
			lang = lang.split('-')[0];
			const site = this.sites.find(s => {
				const sLang = s.language.split('-')[0];
				return sLang === lang;
			});
			if (site) return site;
		}

		// we did not find a match then just return the first site
		return this.defaultSite();
	}

	/**
	 * Get the default site
	 */
	defaultSite(): Site {
		return this.sites.find(s => s.primary) ?? this.sites[0];
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
				const site = this.route?.site ?? this.defaultSite();
				target = new URL(site.uri + target, site.url);
			} else if (!target) {
				throw new Error('the url is not allowed to be empty');
			} else {
				target = new URL(target);
			}
		}

		if (target instanceof URL) {
			target = this.routeFromUrl(target);
		}

		if (!isRequest(target)) {
			return Request.fromRoute(target, opts);
		}

		target._updateOpts(opts);
		return target;
	}

	/**
	 * Resolve a url and convert it to a Route
	 *
	 * @param url
	 * @return Returns null if the url does not match our host (the protocol get's ignored)
	 */
	routeFromUrl(fullUrl: URL): Route {
		// strip stuff we dont need from url
		const route = new Route(fullUrl, null!);
		const url = route.url;

		const site = siteFromUrl(url, this.sites);

		// todo should we throw if we can't find a site
		// or use the site which matches the language
		route.site = site ?? this.defaultSite();

		return route;
	}

	listen() {
		window.addEventListener('click', async e => {
			// @ts-ignore
			const link = e.target.closest('a');
			const openInNewTab = e.metaKey || e.ctrlKey || e.shiftKey;
			const saveLink = e.altKey;
			if (!link || !link.href || openInNewTab || saveLink) return;
			if (link.target.toLowerCase() === '_blank') return;
			if (!link.href.startsWith('http')) return;

			e.preventDefault();

			const req = this.targetToRequest(link.href, { origin: 'click' });
			const routeEq =
				this.route && this.route.eqUrl(req) && this.route.eqSearch(req);

			// this means the route is the same maybe with a different hash
			// so it is not necessary to load the data again
			if (routeEq) {
				req.disableLoadData = true;
			}

			this.open(req);
		});

		if (this.preloadOnMouseOver) {
			let currentMouseOver: any = null;
			window.addEventListener('mouseover', e => {
				// @ts-ignore
				const link = e.target.closest('a');

				if (currentMouseOver && link === currentMouseOver) return;
				if (link && link.target.toLowerCase() === '_blank') return;

				if (
					link &&
					!link.hasAttribute('data-no-preload') &&
					link.href
				) {
					this.preload(link.href);
				}

				currentMouseOver = link;
			});
		}

		// store the scrollY position every 200ms
		// we can't do this at the time of the open call since the pop event
		// has already changed to a new history state so we can't update our
		// current/previous state
		// eslint-disable-next-line no-constant-condition
		if (true) {
			window.addEventListener('scroll', () => {
				const current = this.route;
				if (!current) return;

				// store the scroll position
				current.scrollY = window.scrollY;

				if (this.scrollDebounceTimeout) return;

				// this might cause `Attempt to use history.replaceState() more than
				// 100 times per 30 seconds` in safari
				// since we wait a moment we should almost ever be fine
				this.scrollDebounceTimeout = setTimeout(() => {
					if (!this.route || !current.eq(this.route)) return;

					// use the latest state
					this.history.replaceState(this.route._toState());

					if (current.inLivePreview()) {
						sessionStorage.setItem(
							'live-preview-scroll',
							// use the latest scrollY
							this.route.scrollY + '',
						);
					}

					this.scrollDebounceTimeout = null;
				}, 280);
			});
		}

		window.addEventListener('popstate', async e => {
			if (!e.state?.route) return;

			const req = this.targetToRequest(window.location.href);
			req._fillFromState(e.state);
			req.origin = 'pop';

			// we set it now instead of waiting for the onRoute call
			// because the window.history was already modified
			this.route = req.toRoute();
			this.onRoute(req, () => {});
		});
	}

	/**
	 * Open a new route
	 *
	 * @param route a route object or an url or uri, never input the same route object again
	 * @param pushState if true pushed the state to the window.history
	 *
	 * ## Important
	 * Make sure a req always has the correct origin,
	 * `push` and `replace` will cause this function to throw an error
	 */
	open(req: Request) {
		if (['push', 'replace'].includes(req.origin)) {
			throw new Error('Do not use open with push or replace');
		}

		const current = this.route;
		// store scrollY
		if (current) {
			// if the scrollY would still be updated we clear the timeout
			// since we should have the latest scrollY
			if (this.scrollDebounceTimeout) {
				clearTimeout(this.scrollDebounceTimeout);
				this.scrollDebounceTimeout = null;
			}

			// store the scroll position
			const scrollY = this.history.scrollY();
			if (typeof scrollY === 'number') {
				current.scrollY = scrollY;
				this.history.replaceState(current._toState());
			}
		}

		// if the domain of the current site is different than the domain of the
		// new site we need to do a window.location.href call
		if (
			(current && current.url.origin !== req.url.origin) ||
			// @ts-ignore
			import.meta.env.SSR
		) {
			this.history.open(req);
			return;
		}

		req.index = (current?.index ?? 0) + 1;
		this.onRoute(req, () => {
			const url = req.url;
			this.history.pushState(
				req._toState(),
				url.pathname + url.search + url.hash,
			);
			this.route = req.toRoute();
		});
	}

	/**
	 * This pushes a new route to the history
	 *
	 * @param req, never input the same route object again
	 *
	 * ## Important
	 * Make sure the route has the correct origin
	 */
	push(req: Request) {
		const url = req.url;
		// todo a push should also store the previous scrollY

		let nReq = req;
		if (req.scrollY === null) {
			// if there is no scrollY stored we store the current scrollY
			// since a push does not cause a scroll top
			// todo: probably should refactor something probably
			// should not be here
			nReq = req.clone();
			nReq.scrollY = this.history.scrollY();
		}

		this.onRoute(req, () => {
			this.history.pushState(
				req._toState(),
				url.pathname + url.search + url.hash,
			);
			this.route = req.toRoute();
		});
	}

	/**
	 * This replaces the current route
	 *
	 * @param req, never input the same route object again
	 *
	 * ## Important
	 * Make sure the route has the correct origin
	 */
	replace(req: Request) {
		const url = req.url;

		let nReq = req;
		if (req.scrollY === null) {
			// if there is no scrollY stored we store the current scrollY
			// since a replace does not cause a scrollTo and we wan't
			// history back to work as intended
			// todo: probably should refactor something probably
			// should not be here
			nReq = req.clone();
			nReq.scrollY = this.history.scrollY();
		}

		this.onRoute(req, () => {
			this.history.replaceState(
				req._toState(),
				url.pathname + url.search + url.hash,
			);
			this.route = req.toRoute();
		});
	}

	/**
	 * Preload a url
	 *
	 * This will only work if the origin of the url matches the current site
	 *
	 * @param url
	 */
	preload(target: string | URL | Route | Request) {
		const req = this.targetToRequest(target);
		const current = this.route;

		// if the origin matches, the route will be able to be load
		// so let's preload it
		if (current && current.url.origin === req.url.origin) {
			this.onPreload(req);
		}
	}

	domReady(req: Request) {
		if (req.disableScroll) return;

		// scroll to target
		let scrollTo:
			| { top: number; behavior: ScrollBehavior }
			| { intoView: HTMLElement; behavior: ScrollBehavior }
			| null = null;

		// if the route is a live preview init and we have a scrollY stored
		// scroll to that
		if (req.inLivePreview()) {
			const scrollY = sessionStorage.getItem('live-preview-scroll');
			if (scrollY) {
				scrollTo = {
					top: parseInt(scrollY),
					behavior: 'instant',
				};
			}
			// if we have a hash and the route was not visited
		} else if (
			req.hash &&
			((req.origin === 'init' && typeof req.scrollY !== 'number') ||
				req.origin === 'click')
		) {
			const el = document.getElementById(req.hash.substring(1));
			if (el) {
				scrollTo = {
					intoView: el,
					behavior: 'smooth',
				};
			}
		}

		// restore scroll position
		if (
			!scrollTo &&
			req.origin !== 'click' &&
			typeof req.scrollY === 'number'
		) {
			scrollTo = {
				top: req.scrollY,
				behavior: 'instant',
			};
		}

		// make sure push and replace don't cause a scroll if it is not intended
		if (!scrollTo && (req.origin === 'push' || req.origin === 'replace'))
			return;

		// scroll to the top if nothing else matches
		if (!scrollTo) {
			scrollTo = {
				top: 0,
				behavior: 'instant',
			};
		}

		if ('top' in scrollTo) {
			window.scrollTo({
				top: scrollTo.top,
				behavior: scrollTo.behavior,
			});
		} else {
			scrollTo.intoView.scrollIntoView({
				behavior: scrollTo.behavior,
				block: 'start',
			});
		}
	}
}

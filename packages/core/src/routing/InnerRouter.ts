import Site, { SiteFromGraphQl } from './Site.js';
import History from './History.js';
import { ClientHistory, ServerHistory } from './History.js';
import Request, { isRequest } from './Request.js';
import Route from './Route.js';

export type InnerRouterOpts = {
	preloadOnMouseOver: boolean;
};

/**
 * Manages event listeners or functions.
 */
export default class InnerRouter {
	sites: Site[];
	route: Route | null;
	site: Site;
	history: History;
	preloadOnMouseOver: boolean;
	/**
	 * @param changeHistory returns a function you need to call when you are ready to
	 update the window history (note do not call this after another onRoute call was made)
	 */
	onRoute: (route: Request, site: Site, changeHistory: () => void) => void;
	onPreload: (route: Request, site: Site) => void;

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
		this.site = this.defaultSite();
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
		const route = this.targetToRequest(window.location.href);
		route._fillFromState(window.history.state);

		route.origin = 'init';

		if (route.search.get('x-craft-live-preview')) {
			route.origin = 'live-preview-init';
		}

		window.history.scrollRestoration = 'manual';

		this.open(route, false);
	}

	/**
	 * Initializes the router when running on the server.
	 */
	initServer() {}

	/**
	 * Get a site and if possible use the accept lang header.
	 *
	 * @param {(string|null)} [acceptLang=null] Accept Language header.
	 * @return {Site}
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
		return this.sites[0];
	}

	/**
	 * Tries to get a site by it's id
	 */
	siteById(id: number): Site | null {
		return this.sites.find(s => s.id === id) ?? null;
	}

	/**
	 * Resolve a url or Route and convert it to a Route
	 *
	 * @param target
	 * @return Returns null if the url does not match our host (the protocol get's ignored)
	 */
	targetToRequest(target: string | URL | Route | Request): Request {
		if (typeof target === 'string') {
			if (target.startsWith('/')) {
				const site = this.site;
				target = new URL(site.uri + target, site.url);
			} else {
				target = new URL(target);
			}
		}

		if (target instanceof URL) {
			target = this.routeFromUrl(target);
		}

		if (!isRequest(target)) {
			return Request.fromRoute(target);
		}

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
		const route = new Route(fullUrl, null);
		const url = route.url;

		let site: Site | null = null;
		// get the site which matches the url the most
		for (const s of this.sites) {
			const siteUri = s.uri;

			// make sure the start of the url matches
			if (url.host !== s.url.host || !url.pathname.startsWith(siteUri)) {
				continue;
			}

			// make sure that after the base url a slash follows or nothing
			const uri = url.pathname.substring(siteUri.length);
			if (uri.length > 0 && !uri.startsWith('/')) continue;

			/// make sure we get the most matched site
			if (site && site.uri.length > siteUri.length) continue;

			site = s;
		}

		route.site = site;

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

			const route = this.routeFromUrl(link.href);
			if (this.route?.eq(route)) return;

			route.origin = 'click';

			this.open(route);
		});

		if (this.preloadOnMouseOver) {
			let currentMouseOver: any = null;
			window.addEventListener('mouseover', e => {
				// @ts-ignore
				const link = e.target.closest('a');

				if (currentMouseOver && link === currentMouseOver) return;
				if (link && link.target.toLowerCase() === '_blank') return;

				if (link && !link.hasAttribute('data-no-preload')) {
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

					if (current.origin === 'live-preview-init') {
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
			if (!('route' in e.state)) return;

			const route = this.targetToRequest(window.location.href);
			route._fillFromState(e.state);
			route.origin = 'pop';

			// since the pop event replaced our state we can't replace the state
			// for the scrollY in our open call so we just clear the current
			// route since it is now already the new route
			this.route = null;

			this.open(route, false);
		});
	}

	/**
	 * Open's a route
	 *
	 * @param route a route object or an url or uri, never input the same route object again
	 * @param pushState if true pushed the state to the window.history
	 */
	open(target: string | URL | Route | Request, pushState: boolean = true) {
		const req = this.targetToRequest(target);

		const current = this.route;
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
			import.meta.env.SSR
		) {
			this.history.open(req.url.href);
			return;
		}

		if (pushState) {
			req.index = (current?.index ?? 0) + 1;
			this.onRoute(req, req.site ?? this.site, () => {
				this.pushState(req.toRoute());
			});
		} else {
			this.setRoute(req);
		}
	}

	/**
	 * Sets a route
	 *
	 * Will trigger an onRoute event but will not store any scroll progress
	 * or modify the history
	 *
	 * @param req
	 */
	setRoute(req: Request) {
		this.route = req.toRoute();
		if (req.site) this.site = req.site;

		this.onRoute(req, this.site, () => {});
	}

	/**
	 * This pushes the state of the route without triggering a currentRoute
	 * or currentSiteId change
	 *
	 * You can use when using pagination for example change the route object
	 * (search argument) and then call pushState
	 *
	 * @param route, never input the same route object again
	 */
	pushState(route: Route) {
		const url = route.url;

		this.history.pushState(
			route._toState(),
			url.pathname + url.search + url.hash,
		);

		this.route = route;
		if (route.site) this.site = route.site;
	}

	/**
	 * This replaces the state of the route without triggering a currentRoute
	 * or currentSiteId change
	 *
	 * @param route, never input the same route object again
	 */
	replaceState(route: Route) {
		const url = route.url;

		this.history.replaceState(
			route._toState(),
			url.pathname + url.search + url.hash,
		);

		this.route = route;
		if (route.site) this.site = route.site;
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

		// todo, don't think this makes any sense
		// if the domain of the current site is different than the domain of the
		// new site id does not make sense to preload
		if (this.site.url.origin !== req.url.origin) {
			return;
		}

		const current = this.route;
		const site = req.site ?? this.site;

		// if the origin matches, the route will be able to be load
		// so let's preload it
		if (current && current.url.origin === req.url.origin) {
			this.onPreload(req, site);
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
		if (req.origin === 'live-preview-init') {
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

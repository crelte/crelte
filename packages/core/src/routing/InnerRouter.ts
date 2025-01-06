/**
 * The origin of
 */

import Route from './Route.js';
import Site, { SiteFromGraphQl } from './Site.js';
import History, { ClientHistory, ServerHistory } from './History.js';

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
	onRoute: (route: Route, site: Site, changeHistory: () => void) => void;
	onPreload: (route: Route, site: Site) => void;

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
		this.history = null!;
		this.preloadOnMouseOver = opts.preloadOnMouseOver;

		// this.preloadListeners = new Listeners();

		this.onRoute = () => {};
		this.onPreload = () => {};
	}

	/**
	 * Initializes the router when running on the client.
	 */
	initClient() {
		this.history = new ClientHistory();

		this.listen();

		// let's first try to load from the state
		const route = this.targetToRoute(window.location.href);
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
	initServer() {
		this.history = new ServerHistory();
	}

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
	targetToRoute(target: string | URL | Route): Route {
		if (typeof target === 'string') {
			if (target.startsWith('/')) {
				const site = this.site;
				target = new URL(site.uri + target, site.url);
			} else {
				target = new URL(target);
			}
		}

		if (target instanceof URL) {
			return this.routeFromUrl(target);
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
			let timeout: any = null;

			window.addEventListener('scroll', () => {
				const current = this.route;
				if (!current) return;

				// store the scroll position
				current.scrollY = window.scrollY;

				if (timeout) return;

				timeout = setTimeout(() => {
					if (!current.eq(this.route!)) return;

					this.history.replaceState(this.route?._toState());

					if (current.origin === 'live-preview-init') {
						sessionStorage.setItem(
							'live-preview-scroll',
							current.scrollY + '',
						);
					}

					timeout = null;
				}, 200);
			});
		}

		window.addEventListener('popstate', async e => {
			if (!('route' in e.state)) return;

			const route = this.targetToRoute(window.location.href);
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
	 * @param route a route object or an url or uri
	 * @param pushState if true pushed the state to the window.history
	 */
	open(target: string | URL | Route, pushState: boolean = true) {
		const route = this.targetToRoute(target);

		const current = this.route;
		if (current) {
			// store the scroll position
			current.scrollY = this.history.scrollY();
			this.history.replaceState(current._toState());
		}

		// if the domain of the current site is different than the domain of the
		// new site we need to do a window.location.href call
		if (current && current.url.origin !== route.url.origin) {
			this.history.open(route.url.href);
			return;
		}

		if (pushState) {
			route.index = (current?.index ?? 0) + 1;
			this.onRoute(route, route.site ?? this.site, () => {
				this.pushState(route);
			});
		} else {
			this.setRoute(route);
		}
	}

	/**
	 * Sets a route
	 *
	 * Will trigger an onRoute event but will not store any scroll progress
	 * or modify the history
	 *
	 * @param route
	 */
	setRoute(route: Route) {
		this.route = route;
		if (route.site) this.site = route.site;

		this.onRoute(route, this.site, () => {});
	}

	/**
	 * This pushes the state of the route without triggering a currentRoute
	 * or currentSiteId change
	 *
	 * You can use when using pagination for example change the route object
	 * (search argument) and then call pushState
	 *
	 * @param route
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
	 * @param route
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
	preload(target: string | URL | Route) {
		const route = this.targetToRoute(target);

		// if the domain of the current site is different than the domain of the
		// new site id does not make sense to preload
		if (this.site.url.origin !== route.url.origin) {
			return;
		}

		const current = this.route;
		const site = route.site ?? this.site;

		// if the origin matches, the route will be able to be load
		// so let's preload it
		if (current && current.url.origin === route.url.origin) {
			this.onPreload(route, site);
		}
	}

	domReady(route: Route) {
		// scroll to target
		let scrollTo: { top: number; behavior: ScrollBehavior } | null = null;

		// if we have a hash in the route scroll to that element
		if (route.hash) {
			const el = document.getElementById(route.hash.substring(1));
			if (el) {
				scrollTo = {
					top: el.offsetTop,
					behavior: 'smooth',
				};
			}
		}

		// if the route already contains a scrollY scroll to that
		if (route.scrollY) {
			scrollTo = {
				top: route.scrollY,
				behavior: 'instant',
			};
		}

		// if the route is a live preview init and we have a scrollY stored
		// scroll to that
		if (!scrollTo && route.origin === 'live-preview-init') {
			const scrollY = sessionStorage.getItem('live-preview-scroll');
			if (scrollY) {
				scrollTo = {
					top: parseInt(scrollY),
					behavior: 'instant',
				};
			}
		}

		// if we don't have a scrollY and the route is a click scroll to the top
		if (!scrollTo && route.origin === 'click') {
			scrollTo = {
				top: 0,
				behavior: 'instant',
			};
		}

		if (scrollTo) window.scrollTo(scrollTo);
	}
}

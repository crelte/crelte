import { CrelteRequest } from '../../crelte.js';
import BaseRouter, { BaseRouterOptions } from './BaseRouter.js';
import { Request, RequestOptions } from '../index.js';
import Route from '../route/Route.js';
import { SiteFromGraphQl } from '../Site.js';

export type ClientRouterOptions = {
	preloadOnMouseOver: boolean;
} & BaseRouterOptions;

export default class ClientRouter extends BaseRouter {
	private scrollDebounceTimeout: any | null;
	private preloadOnMouseOver: boolean;

	onError: (e: any) => void;

	constructor(sites: SiteFromGraphQl[], opts: ClientRouterOptions) {
		super(sites, opts);

		this.scrollDebounceTimeout = null;
		this.preloadOnMouseOver = opts.preloadOnMouseOver;
		this.onError = () => {};
	}

	/**
	 * ## Throws
	 */
	async init() {
		this.listen();

		// let's first try to load from the state
		const req = this.targetToRequest(window.location.href);
		req._fillFromState(window.history.state);

		req.origin = 'init';
		window.history.scrollRestoration = 'manual';

		return await this.handleRequest(req, () => {});
	}

	/**
	 * Do not call this with origin push or replace
	 */
	async openRequest(req: Request): Promise<Route | void> {
		if (['push', 'replace'].includes(req.origin)) {
			throw new Error('Do not use open with push or replace');
		}

		const current = this.route.get();
		// store scrollY
		if (current) {
			// if the scrollY would still be updated we clear the timeout
			// since we should have the latest scrollY
			if (this.scrollDebounceTimeout) {
				clearTimeout(this.scrollDebounceTimeout);
				this.scrollDebounceTimeout = null;
			}

			// store the scroll position
			const scrollY = window.scrollY;
			if (typeof scrollY === 'number') {
				current.scrollY = scrollY;
				window.history.replaceState(current._toState(), '');
			}
		}

		// if the domain of the current site is different than the domain of the
		// new site we need to do a window.location.href call
		if (
			(current && current.url.origin !== req.url.origin) ||
			// @ts-ignore
			import.meta.env.SSR
		) {
			window.location.href = req.url.href;
			return;
		}

		req.index = (current?.index ?? 0) + 1;
		return await this.handleRequestAndError(req, route => {
			const url = route.url;
			window.history.pushState(
				route._toState(),
				'',
				url.pathname + url.search + url.hash,
			);
		});
	}

	async pushRequest(req: Request, _opts: RequestOptions = {}) {
		const url = req.url;
		// todo a push should also store the previous scrollY

		if (req.scrollY === null) {
			// if there is no scrollY stored we store the current scrollY
			// since a push does not cause a scroll top
			// todo: probably should refactor something probably
			// should not be here
			req.scrollY = window.scrollY;
		}

		return await this.handleRequest(req, route => {
			window.history.pushState(
				route._toState(),
				'',
				url.pathname + url.search + url.hash,
			);
		});
	}

	async replaceRequest(req: Request, _opts: RequestOptions = {}) {
		const url = req.url;

		if (req.scrollY === null) {
			// if there is no scrollY stored we store the current scrollY
			// since a replace does not cause a scrollTo and we wan't
			// history back to work as intended
			// todo: probably should refactor something probably
			// should not be here
			req.scrollY = window.scrollY;
		}

		try {
			return await this.handleRequest(req, () => {
				window.history.replaceState(
					req._toState(),
					'',
					url.pathname + url.search + url.hash,
				);
			});
		} catch (e) {
			console.warn('replacing route failed', e);
			throw e;
		}
	}

	/**
	 * This returns a route if it was handled else if an error occured
	 * or the request was cancelled returns void
	 */
	async handleRequestAndError(
		req: Request,
		updateHistory: (route: Route) => void,
	): Promise<Route | void> {
		try {
			return await this.handleRequest(req, updateHistory);
		} catch (e) {
			console.error('request failed', e);
			this.onError(e);
		}
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
			const currRoute = this.route.get();
			const routeEq =
				currRoute && currRoute.eqUrl(req) && currRoute.eqSearch(req);

			// this means the route is the same maybe with a different hash
			// so it is not necessary to load the data again
			if (routeEq) {
				req.disableLoadData = true;
			}

			this.openRequest(req);
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
				const current = this.route.get();
				if (!current) return;

				// store the scroll position
				current.scrollY = window.scrollY;

				if (this.scrollDebounceTimeout) return;

				// this might cause `Attempt to use history.replaceState() more than
				// 100 times per 30 seconds` in safari
				// since we wait a moment we should almost ever be fine
				this.scrollDebounceTimeout = setTimeout(() => {
					const routerRoute = this.route.get();
					if (!routerRoute || !current.eq(routerRoute)) return;

					// use the latest state
					window.history.replaceState(routerRoute._toState(), '');

					if (current.inLivePreview()) {
						sessionStorage.setItem(
							'live-preview-scroll',
							// use the latest scrollY
							routerRoute.scrollY + '',
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

			// todo handle errors
			this.handleRequest(req, () => {});
		});
	}

	updateScroll(cr: CrelteRequest, _route: Route): void {
		const req = cr.req;

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

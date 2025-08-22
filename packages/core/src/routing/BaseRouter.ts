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

export type BaseRouterOptions = {} & LoadRunnerOptions;

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

	loadRunner: LoadRunner;
	// onLoaded: () => void;

	constructor(sites: SiteFromGraphQl[], opts: BaseRouterOptions) {
		this.sites = sites.map(s => new Site(s));
		this.sitesByLanguage = new Map(this.sites.map(s => [s.language, s]));
		this.route = new Writable(null);
		this.site = new Writable(null);
		this.request = null;
		this.loadRunner = new LoadRunner(opts);
	}

	/**
	 * Get the default site
	 */
	defaultSite(): Site {
		return this.sites.find(s => s.primary) ?? this.sites[0];
	}

	/**
	 * Get a site and if possible use the accept lang header.
	 *
	 * @param acceptLang Accept Language header.
	 */
	siteByAcceptLang(acceptLang: string | null = null): Site {
		if (!acceptLang) return this.defaultSite();

		const lang = matchAcceptLang(
			acceptLang,
			Array.from(this.sitesByLanguage.keys()),
		);

		return lang ? this.sitesByLanguage.get(lang)! : this.defaultSite();
	}

	/**
	 * Tries to get a site by it's id
	 */
	siteById(id: number): Site | null {
		return this.sites.find(s => s.id === id) ?? null;
	}

	/**
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
				const site = this.route.get()?.site ?? this.defaultSite();
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
		req.site = site ?? this.defaultSite();

		return req;
	}
}

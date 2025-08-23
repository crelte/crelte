import BaseRouter, { BaseRouterOptions } from './BaseRouter.js';
import { Request } from './index.js';
import Route from './Route.js';
import Site, { SiteFromGraphQl } from './Site.js';

export default class ServerRouter extends BaseRouter {
	acceptLang: string | null;
	redirect: Request | null;

	constructor(sites: SiteFromGraphQl[], opts: BaseRouterOptions) {
		super(sites, opts);

		this.acceptLang = null;
		this.redirect = null;

		this.onRender = async (cr, readyForRoute, _domUpdated) => {
			const route = readyForRoute();
			cr._complete(route);

			return route;
		};
	}

	defaultSite(): Site {
		return this.siteByAcceptLang(this.acceptLang);
	}

	async openRequest(req: Request) {
		this.redirect = req;
		this.cancelRequest();
	}

	/**
	 * This function always returns the request or a redirect one
	 *
	 * And then if no redirect happen the final route
	 *
	 * ## Throws
	 * If the request fails
	 */
	async init(
		url: string,
		acceptLang?: string,
	): Promise<[Request, Route | null]> {
		this.acceptLang = acceptLang ?? null;

		const req = this.targetToRequest(url);
		req.origin = 'init';

		// throws if something goes wrong
		const route = await this.handleRequest(req, () => {});
		if (!route) {
			if (!this.redirect)
				throw new Error(
					'if the request gets cancelled on the server there should be a redirect',
				);

			return [this.redirect!, null];
		}

		return [req, route];
	}
}

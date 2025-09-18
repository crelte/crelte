import BaseRouter, { BaseRouterOptions } from './BaseRouter.js';
import { Request, RequestOptions } from '../index.js';
import Route from '../route/Route.js';
import Site, { SiteFromGraphQl } from '../Site.js';
import { preferredSite } from '../utils.js';
import { parseAcceptLanguage } from '../../std/intl/index.js';

export default class ServerRouter extends BaseRouter {
	private prefSite: Site | null;
	redirect: Request | null;

	constructor(
		sites: SiteFromGraphQl[],
		acceptLang: string,
		opts: BaseRouterOptions,
	) {
		const langs = parseAcceptLanguage(acceptLang).map(([l]) => l);
		super(sites, langs, opts);

		this.prefSite = preferredSite(this.sites, this.languages);

		this.redirect = null;
	}

	/**
	 * Returns a site which is preffered based on the users language
	 *
	 * Returns null if no site could be determined
	 */
	preferredSite(): Site | null {
		return this.prefSite;
	}

	async openRequest(req: Request) {
		// only handle the first redirect
		// this makes the behaviour the same as client router
		// not true
		// todo: the client only instatly redirects if it belongs to another
		// site (aka needs to use window.location.href)
		if (this.redirect) return;

		this.redirect = req;
		this.cancelRequest();

		// request was handled with a redirect so we don't have an entry
		// templateData or anything else
		// todo is that what we wan't to return. Because void would tell
		// the user the request was cancelled
	}

	async pushRequest(req: Request, _opts: RequestOptions = {}) {
		// todo not sure if that is what we want?
		return await this.openRequest(req);
	}

	async replaceRequest(req: Request, _opts: RequestOptions = {}) {
		// todo not sure if that is what we want?
		return await this.openRequest(req);
	}

	/**
	 * This function always returns the request or a redirect one
	 *
	 * And then if no redirect happen the final route
	 *
	 * ## Throws
	 * If the request fails
	 */
	async init(url: string): Promise<[Request, Route | null]> {
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

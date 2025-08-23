import BaseRouter, { BaseRouterOptions } from './BaseRouter.js';
import { Request } from './index.js';
import Route from './Route.js';
import Site, { SiteFromGraphQl } from './Site.js';

export default class ServerRouter extends BaseRouter {
	// acceptLang: string | null;
	// redirect: Request | null;

	constructor(sites: SiteFromGraphQl[], opts: BaseRouterOptions) {
		super(sites, opts);

		// this.acceptLang = null;
		// this.redirect = null;
	}

	// async openRequest(req: Request) {
	// 	this.redirect = req;
	// 	this.cancelRequest();
	// }
	//

	// async handleRequestNoThrow() {}

	async init() {}
}

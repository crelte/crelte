import BaseRouter from './BaseRouter.js';
import { SiteFromGraphQl } from './Site.js';

export default class ServerRouter extends BaseRouter {
	constructor(sites: SiteFromGraphQl[]) {
		super(sites);
	}

	async init(url: string, acceptLang?: string) {
		// todo
	}
}

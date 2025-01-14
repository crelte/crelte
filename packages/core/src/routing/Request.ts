import Route, { RouteOrigin } from './Route.js';
import Site from './Site.js';

export type RequestOpts = {
	scrollY?: number;
	index?: number;
	origin?: RouteOrigin;
	disableLoadData?: boolean;
	disableScroll?: boolean;
};

export default class Request extends Route {
	// todo
	disableLoadData: boolean;

	// todo
	disableScroll: boolean;

	constructor(url: string | URL, site: Site | null, opts: RequestOpts = {}) {
		super(url, site, opts);

		this.disableLoadData = opts.disableLoadData ?? false;
		this.disableScroll = opts.disableScroll ?? false;
	}

	static fromRoute(route: Route) {
		return new Request(route.url.href, route.site, {
			scrollY: route.scrollY ?? undefined,
			index: route.index,
			origin: route.origin,
		});
	}

	clone() {
		return new Request(this.url.href, this.site, {
			scrollY: this.scrollY ?? undefined,
			index: this.index,
			origin: this.origin,
			disableLoadData: this.disableLoadData,
			disableScroll: this.disableScroll,
		});
	}

	toRoute() {
		return new Route(this.url.href, this.site, {
			scrollY: this.scrollY ?? undefined,
			index: this.index,
			origin: this.origin,
		});
	}
}

export function isRequest(req: any): req is Request {
	return typeof req === 'object' && req !== null && req instanceof Request;
}

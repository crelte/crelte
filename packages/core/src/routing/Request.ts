import { Barrier } from 'crelte-std/sync';
import Route, { RouteOrigin } from './Route.js';
import { DelayRender } from './Router.js';
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

	private renderBarrier: RenderBarrier;

	constructor(url: string | URL, site: Site | null, opts: RequestOpts = {}) {
		super(url, site, opts);

		this.disableLoadData = opts.disableLoadData ?? false;
		this.disableScroll = opts.disableScroll ?? false;
		this.renderBarrier = new RenderBarrier();
	}

	static fromRoute(route: Route) {
		return new Request(route.url.href, route.site, {
			scrollY: route.scrollY ?? undefined,
			index: route.index,
			origin: route.origin,
		});
	}

	/**
	 * If you call delayRender you need to call ready or the render will never happen
	 */
	delayRender(): DelayRender {
		throw new Error('todo');
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

	async destroy() {
		this.renderBarrier.cancel();
	}
}

export function isRequest(req: any): req is Request {
	return typeof req === 'object' && req !== null && req instanceof Request;
}

class RenderBarrier {
	inner: Barrier<unknown>;
	cancelled: boolean;
	root: DelayRender;

	constructor() {
		this.inner = new Barrier();
		this.cancelled = false;
		this.root = this.add();
	}

	add(): DelayRender {
		const action = this.inner.add();

		return {
			ready: async () => {
				if (this.inner.isOpen()) await action.ready(null);
				return this.cancelled;
			},
			remove: () => {
				if (this.inner.isOpen()) action.remove();
			},
		};
	}

	cancel() {
		if (!this.root.isOpen()) return;

		this.cancelled = true;
		this.root.remove();
	}

	// returns if the render was cancelled
	ready(): Promise<boolean> {
		return this.root.ready();
	}
}

export type DelayRender = {
	/**
	 * Call this when you're ready for the render to happen
	 * the promise will resolve when the render is done or was cancelled
	 *
	 * @returns if the render was cancelled
	 */
	ready: () => Promise<boolean>;

	/**
	 * If youre not interested in the render anymore
	 */
	remove: () => void;
};

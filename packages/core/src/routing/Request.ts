import { Barrier } from 'crelte-std/sync';
import Route, { RouteOrigin } from './Route.js';
import Site from './Site.js';
import { objClone } from '../utils.js';

/**
 * Options to create a Request
 */
export type RequestOptions = {
	scrollY?: number;
	index?: number;
	origin?: RouteOrigin;
	state?: Record<string, any>;
	context?: Record<string, any>;
	disableScroll?: boolean;
	disableLoadData?: boolean;
	statusCode?: number;
};

/**
 * A Request is a Route with some extra options
 * you get a Request from the onRequest event or
 * in a loadData function.
 */
export default class Request extends Route {
	/**
	 * Disable scrolling for this request
	 * @default false
	 */
	disableScroll: boolean;

	/**
	 * Disable loading data
	 * @default false
	 */
	disableLoadData: boolean;

	/**
	 * The Status code that should be returned for a redirect
	 */
	statusCode: number | null;

	/** @hidden */
	_renderBarrier: RenderBarrier;

	/**
	 * Create a new Request
	 */
	constructor(url: string | URL, site: Site, opts: RequestOptions = {}) {
		super(url, site, opts);

		this.disableScroll = opts.disableScroll ?? false;
		this.disableLoadData = opts.disableLoadData ?? false;
		this.statusCode = opts.statusCode ?? null;
		this._renderBarrier = new RenderBarrier();
	}

	/**
	 * Create a Request from a Route
	 */
	static fromRoute(route: Route, opts: RequestOptions = {}) {
		return new Request(route.url.href, route.site, {
			scrollY: route.scrollY ?? undefined,
			index: route.index,
			origin: route.origin,
			state: route._state,
			context: route._context,
			...opts,
		});
	}

	/**
	 * With delayRender you can make sure that the render waits
	 * until you are ready. This is useful for building page transitions.
	 *
	 * ## Important
	 * If you call delayRender you need to call `ready/remove` or the render
	 * will never happen
	 *
	 * ## Example
	 * ```
	 * import { onRequest } from 'crelte';
	 * import { animate } from 'motion';
	 *
	 * onRequest(async req => {
	 *     if (req.origin !== 'click' && req.origin !== 'manual') return;
	 *
	 *     const delay = req.delayRender();
	 *
	 *     await animate(plane, { x: '0%' });
	 *
	 *     // wait until the new page is ready to be rendered
	 *     // if the render was cancelled we return
	 *     if (await delay.ready()) return;
	 *
	 *     await animate(plane, { x: '100%' });
	 * });
	 * ```
	 */
	delayRender(): DelayRender {
		return this._renderBarrier.add();
	}

	/**
	 * Create a copy of the request
	 */
	clone() {
		return new Request(this.url.href, this.site, {
			scrollY: this.scrollY ?? undefined,
			index: this.index,
			origin: this.origin,
			state: objClone(this._state),
			context: this._context,
			disableScroll: this.disableScroll,
			disableLoadData: this.disableLoadData,
			statusCode: this.statusCode ?? undefined,
		});
	}

	/**
	 * Create a Route from the Request
	 */
	toRoute() {
		return new Route(this.url.href, this.site, {
			scrollY: this.scrollY ?? undefined,
			index: this.index,
			origin: this.origin,
			state: objClone(this._state),
			context: this._context,
		});
	}

	/** @hidden */
	_updateOpts(opts: RequestOptions = {}) {
		this.scrollY = opts.scrollY ?? this.scrollY;
		this.index = opts.index ?? this.index;
		this.origin = opts.origin ?? this.origin;
		this._state = opts.state ?? this._state;
		this._context = opts.context ?? this._context;
		this.disableScroll = opts.disableScroll ?? this.disableScroll;
		this.disableLoadData = opts.disableLoadData ?? this.disableLoadData;
		this.statusCode = opts.statusCode ?? this.statusCode;
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

	isOpen(): boolean {
		return this.inner.isOpen();
	}

	add(): DelayRender {
		const action = this.inner.add();

		return {
			ready: async () => {
				if (!this.inner.isOpen()) await action.ready(null);
				return this.cancelled;
			},
			remove: () => {
				if (!this.inner.isOpen()) action.remove();
			},
		};
	}

	/** @hidden */
	cancel() {
		if (this.inner.isOpen()) return;

		this.cancelled = true;
		this.root.remove();
	}

	// returns if the render was cancelled
	/** @hidden */
	ready(): Promise<boolean> {
		return this.root.ready();
	}
}

/**
 * DelayRender is returned by `Request.delayRender`
 */
export type DelayRender = {
	/**
	 * Call this when you're ready for the render to happen
	 * the promise will resolve when the render is done or was cancelled
	 *
	 * @returns if the render was cancelled
	 */
	ready: () => Promise<boolean>;

	/**
	 * If youre not interested when the render happens anymore
	 */
	remove: () => void;
};

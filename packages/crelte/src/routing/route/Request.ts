import Site from '../Site.js';
import { objClone } from '../../utils.js';
import BaseRoute, { RouteOrigin } from './BaseRoute.js';
import Route, { TemplateModule } from './Route.js';
import { Entry } from '../../loadData/index.js';
import { Barrier } from '../../std/sync/index.js';

/**
 * Options to create a Request
 */
export type RequestOptions = {
	entry?: Entry;
	template?: TemplateModule;
	loadedData?: Record<string, any>;
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
 * in a loadGlobal function.
 */
export default class Request extends BaseRoute {
	/**
	 * The entry of the request once loaded
	 */
	entry: Entry | null;

	/**
	 * The template module of the request once loaded
	 */
	template: TemplateModule | null;

	/**
	 * The loaded data of the request
	 */
	loadedData: Record<string, any> | null;

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

	private _cancelled: boolean;

	/**
	 * Create a new Request
	 */
	constructor(url: string | URL, site: Site, opts: RequestOptions = {}) {
		super(url, site, opts);

		this.entry = opts.entry ?? null;
		this.template = opts.template ?? null;
		this.loadedData = opts.loadedData ?? null;
		this.disableScroll = opts.disableScroll ?? false;
		this.disableLoadData = opts.disableLoadData ?? false;
		this.statusCode = opts.statusCode ?? null;
		this._renderBarrier = new RenderBarrier();
		this._cancelled = false;
	}

	/**
	 * Create a Request from a Route
	 *
	 * Clears the entry, template, and loadedData
	 * todo should it?
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

	get cancelled(): boolean {
		return this._cancelled;
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
	 *
	 * without including the entry, template, loadedData or cancelled state
	 *
	 * Is this what we wan't, maybe it should copy everything
	 */
	clone() {
		// todo should this clone the entry
		// the route for example does not do it
		//
		// todo should this clone keep the entry?
		const req = new Request(this.url.href, this.site, {
			// entry: objClone(this.entry),
			// template: this.template ?? undefined,
			// loadedData: objClone(this.loadedData),
			scrollY: this.scrollY ?? undefined,
			index: this.index,
			origin: this.origin,
			state: objClone(this._state),
			context: this._context,
			disableScroll: this.disableScroll,
			disableLoadData: this.disableLoadData,
			statusCode: this.statusCode ?? undefined,
		});

		return req;
	}

	/**
	 * Create a Route from the Request
	 *
	 * ## Throws
	 * if the entry, template or loadedData is missing
	 * or the request was cancelled
	 */
	toRoute() {
		if (this.cancelled)
			throw new Error(
				'cannot create a new route because it was cancelled',
			);

		if (!this.entry || !this.template || !this.loadedData)
			throw new Error(
				'cannot create a new route because entry, template or loadedData is missing',
			);

		const route = new Route(
			this.url.href,
			this.site,
			this.entry,
			this.template,
			this.loadedData,
			{
				scrollY: this.scrollY ?? undefined,
				index: this.index,
				origin: this.origin,
				state: objClone(this._state),
				context: this._context,
			},
		);
		route.entryChanged = !this.disableLoadData;

		return route;
	}

	/** @hidden */
	_updateOpts(opts: RequestOptions = {}) {
		// todo maybe should check that if entry is updated
		// template and loadedData is also updated

		this.entry = opts.entry ?? this.entry;
		this.template = opts.template ?? this.template;
		this.loadedData = opts.loadedData ?? this.loadedData;
		this.scrollY = opts.scrollY ?? this.scrollY;
		this.index = opts.index ?? this.index;
		this.origin = opts.origin ?? this.origin;
		this._state = opts.state ?? this._state;
		this._context = opts.context ?? this._context;
		this.disableScroll = opts.disableScroll ?? this.disableScroll;
		this.disableLoadData = opts.disableLoadData ?? this.disableLoadData;
		this.statusCode = opts.statusCode ?? this.statusCode;
	}

	/** @hidden */
	_cancel() {
		this._cancelled = true;
		this._renderBarrier.cancel();
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
		// if the barrier is already open
		// we don't wan't to flag the render as cancelled
		// because it already happened
		if (this.inner.isOpen()) return;

		this.cancelled = true;
		this.root.remove();
	}

	// returns true if the render was cancelled
	/** @hidden */
	ready(): Promise<boolean> | boolean {
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

import { Pattern, Trouter } from 'trouter';
import { Crelte, CrelteRequest, Entry } from '../index.js';

export type EntryRouteHandler = (
	cr: CrelteRequest,
) => Promise<Entry | null | undefined> | Entry | null | undefined;

export type EntryRoutes = (
	crelte: Crelte,
	router: EntryRouter,
) => Promise<void> | void;

export default class EntryRouter {
	private inner: Trouter<EntryRouteHandler>;

	constructor() {
		this.inner = new Trouter();
	}

	add(pattern: Pattern, ...handlers: EntryRouteHandler[]): this {
		this.inner.add('GET', pattern, ...handlers);
		return this;
	}

	/** @hidden */
	async _handle(cr: CrelteRequest): Promise<Entry | null> {
		const { params, handlers } = this.inner.find('GET', cr.req.uri);

		if (!handlers.length) return null;

		cr.req.setContext('params', params);

		for (const handler of handlers) {
			const res = await handler(cr);
			if (res) return res;
		}

		return null;
	}
}

export function getEntryParam(cr: CrelteRequest, key: string): string | null {
	return (cr.req.getContext('params') ?? {})[key] ?? null;
}

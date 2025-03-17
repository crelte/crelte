export default class ServerRequest extends Request {
	private params: Map<string, string>;

	constructor(inner: Request, params: Map<string, string>) {
		super(inner);

		this.params = params;
	}

	/**
	 * returns the url params from the request
	 *
	 * @example
	 * ```js
	 * router.get('/blog/:slug', async (cs, req) => {
	 *     return Response.json({ slug: cs.getParam('slug') });
	 * });
	 * ```
	 */
	getParam(name: string): string | null {
		return this.params.get(name) ?? null;
	}
}

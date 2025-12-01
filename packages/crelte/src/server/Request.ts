import { Site } from '../routing/index.js';

export default class ServerRequest extends Request {
	private params: Map<string, string>;

	/**
	 * The site of the route
	 *
	 * #### Note
	 * The site might not always match with the current route
	 * but be the site default site or one that matches the
	 * users language.
	 *
	 * If that is important call `req.siteMatches()` to verify
	 */
	site: Site;

	constructor(inner: Request, params: Map<string, string>, site: Site) {
		super(inner);

		this.params = params;
		this.site = site;
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

	/**
	 * Returns if the site matches the url
	 */
	siteMatches(): boolean {
		const url = new URL(this.url);
		if (url.origin !== this.site.url.origin) return false;

		// make sure that urls like pathname: /abcbc and site: /abc don't match
		return (url.pathname + '/').startsWith(
			// uri never returns a slash at the end
			this.site.uri + '/',
		);
	}
}

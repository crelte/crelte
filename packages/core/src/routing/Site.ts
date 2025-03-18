import { trimSlashEnd } from './utils.js';

export type SiteFromGraphQl = {
	id: number;
	baseUrl: string;
	language: string;
	name: string | null;
	handle: string;
	primary: boolean;
};

/**
 * A Craft Site
 */
export default class Site {
	/**
	 * The id of the site
	 */
	id: number;

	/**
	 * The base url of the site
	 */
	url: URL;

	/**
	 * The language of the site
	 *
	 * ex: de-CH
	 */
	language: string;

	/**
	 * The name of the site
	 */
	name: string | null;

	/**
	 * The handle of the site
	 */
	handle: string;

	/**
	 * Is this the primary site
	 */
	primary: boolean;

	constructor(obj: SiteFromGraphQl) {
		this.id = obj.id;
		this.url = new URL(obj.baseUrl);
		this.language = obj.language;
		this.name = obj.name;
		this.handle = obj.handle;
		this.primary = obj.primary;
	}

	/**
	 * Returns the uri of the site
	 *
	 * Never ends with a slash
	 */
	get uri(): string {
		return trimSlashEnd(this.url.pathname);
	}
}

export function siteFromUrl(url: URL, sites: Site[]): Site | null {
	let site: Site | null = null;
	// get the site which matches the url the most
	for (const s of sites) {
		const siteUri = s.uri;

		// make sure the start of the url matches
		if (url.host !== s.url.host || !url.pathname.startsWith(siteUri)) {
			continue;
		}

		// make sure that after the base url a slash follows or nothing
		const uri = url.pathname.substring(siteUri.length);
		if (uri.length > 0 && !uri.startsWith('/')) continue;

		/// make sure we get the most matched site
		if (site && site.uri.length > siteUri.length) continue;

		site = s;
	}

	return site;
}

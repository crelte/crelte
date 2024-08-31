import { trimSlashEnd } from './Router.js';

export type SiteFromGraphQl = {
	id: number;
	baseUrl: string;
	language: string;
};

/**
 * Craft Site
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

	constructor(obj: SiteFromGraphQl) {
		this.id = obj.id;
		this.url = new URL(obj.baseUrl);
		this.language = obj.language;
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

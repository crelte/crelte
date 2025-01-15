import { trimSlashEnd } from './Router.js';

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

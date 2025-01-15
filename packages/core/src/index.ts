import { getContext } from 'svelte';
import type Route from './routing/Route.js';
import type Router from './routing/Router.js';
import type SsrCache from './ssr/SsrCache.js';
import type Site from './routing/Site.js';
import type GraphQl from './graphql/GraphQl.js';
import Crelte, { type QueryOptions } from './Crelte.js';
import CrelteRequest from './CrelteRequest.js';
import type { Global, GlobalData } from './loadData/Globals.js';
import type { Cookies } from './cookies/index.js';
import type { Readable } from 'crelte-std/stores';

export { Crelte, CrelteRequest, type QueryOptions };

/**
 * Get Crelte from the current context
 *
 * ## Note
 * This only works during component initialisation.
 */
export function getCrelte(): Crelte {
	return getContext('crelte');
}

/**
 * Get the router from the current context
 *
 * ## Note
 * This only works during component initialisation.
 */
export function getRouter(): Router {
	return getCrelte().router;
}

/**
 * Get the SSR cache from the current context
 *
 * ## Note
 * This only works during component initialisation.
 */
export function getSsrCache(): SsrCache {
	return getCrelte().ssrCache;
}

/**
 * Get the GraphQl from the current context
 *
 * ## Note
 * This only works during component initialisation.
 */
export function getGraphQl(): GraphQl {
	return getCrelte().graphQl;
}

/**
 * Get a store with the current route
 *
 * ## Note
 * This only works during component initialisation.
 */
export function getRoute(): Readable<Route> {
	return getRouter().route;
}

/**
 * Get a store with the current site
 *
 * ## Note
 * This only works during component initialisation.
 */
export function getSite(): Readable<Site> {
	return getRouter().site;
}

/**
 * returns an env variable from the craft/.env file.
 * All env variables need to start with VITE_
 * except ENDPOINT_URL and CRAFT_WEB_URL
 *
 * ## Note
 * This only works during component initialisation.
 */
export function getEnv(name: 'ENDPOINT_URL'): string;
export function getEnv(name: 'CRAFT_WEB_URL'): string;
export function getEnv(name: string): string | null;
export function getEnv(name: string): string | null {
	return getCrelte().getEnv(name);
}

/**
 * returns a store which indicates if the a page is loading
 *
 * ## Note
 * This only works during component initialisation.
 */
export function getLoading(): Readable<boolean> {
	return getRouter().loading;
}

/**
 * returns a store which indicates the loading progress between 0 and 1
 *
 * ## Note
 * This only works during component initialisation.
 */
export function getLoadingProgress(): Readable<number> {
	return getRouter().loadingProgress;
}

/**
 * returns a store which contains a globalSet
 *
 * ## Note
 * This only works during component initialisation.
 */
export function getGlobal<T extends GlobalData>(
	name: string,
): Global<T> | null {
	return getCrelte().globals.get(name) ?? null;
}

/**
 * returns the cookies instance
 *
 * ## Note
 * This only works during component initialisation.
 */
export function getCookies(): Cookies {
	return getCrelte().cookies;
}

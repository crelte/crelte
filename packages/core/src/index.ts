import { getContext } from 'svelte';
import type Route from './routing/Route.js';
import type Router from './routing/Router.js';
import type SsrCache from './ssr/SsrCache.js';
import type Site from './routing/Site.js';
import type GraphQl from './graphql/GraphQl.js';
import Crelte from './Crelte.js';
import CrelteRouted from './CrelteRouted.js';
import CrelteBase from './CrelteBase.js';
import { Global, GlobalData } from './loadData/Globals.js';
import { Cookies } from './cookies/index.js';
import { Readable } from 'crelte-std/stores';

export { Crelte, CrelteRouted };
export type { CrelteBase };

/**
 * Get the Crelte from the current context
 */
export function getCrelte(): Crelte {
	return getContext('crelte');
}

/**
 * Get the router from the current context
 */
export function getRouter(): Router {
	return getCrelte().router;
}

/**
 * Get the SSR cache from the current context
 */
export function getSsrCache(): SsrCache {
	return getCrelte().ssrCache;
}

/**
 * Get the GraphQl from the current context
 */
export function getGraphQl(): GraphQl {
	return getCrelte().graphQl;
}

/**
 * Get the current route
 */
export function getRoute(): Readable<Route> {
	return getRouter().route;
}

/**
 * Get the current site
 */
export function getSite(): Readable<Site> {
	return getRouter().site;
}

/**
 * Get the next route
 */
export function getNextRoute(): Readable<Route> {
	return getRouter().nextRoute;
}

/**
 * Get the next site
 */
export function getNextSite(): Readable<Site> {
	return getRouter().nextSite;
}

/**
 * returns an env Variables, always needs to be prefixed VITE_
 * Except ENDPOINT_URL and CRAFT_WEB_URL
 */
export function getEnv(name: string): string | null {
	return getCrelte().getEnv(name);
}

/**
 * returns a store which indicates if the a page is loading
 */
export function getLoading(): Readable<boolean> {
	return getRouter().loading;
}

/**
 * returns a store which indicates the loading progress
 */
export function getLoadingProgress(): Readable<number> {
	return getRouter().loadingProgress;
}

/**
 * returns a store which contains a globalSet
 */
export function getGlobal<T extends GlobalData>(
	name: string,
): Global<T> | null {
	return getCrelte().globals.get(name) ?? null;
}

/**
 * returns the cookies instance
 */
export function getCookies(): Cookies {
	return getCrelte().cookies;
}

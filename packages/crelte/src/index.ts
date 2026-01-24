import { getContext, onDestroy } from 'svelte';
import { type Route, type Router } from './routing/index.js';
import type SsrCache from './ssr/SsrCache.js';
import type Site from './routing/Site.js';
import {
	type Crelte,
	type CrelteRequest,
	type CrelteWithRoute,
	type Config,
} from './crelte.js';
import type { Cookies } from './cookies/index.js';
import {
	Entry,
	LoadData,
	LoadDataArray,
	LoadDataFn,
	LoadDataObj,
} from './loadData/index.js';
import Queries from './queries/Queries.js';
import { Readable } from './std/stores/index.js';

export {
	type Crelte,
	type CrelteWithRoute,
	type CrelteRequest,
	type Config,
	type LoadData,
	type LoadDataFn,
	type LoadDataObj,
	type LoadDataArray,
};

export type Init = (crelte: Crelte) => void;

function innerGetCrelte(): Crelte {
	return getContext('crelte');
}

/**
 * Get Crelte from the current context
 *
 * #### Note
 * This only works during component initialisation.
 */
export function getCrelte(): CrelteWithRoute {
	const crelte = innerGetCrelte();

	// the route, site and entry will never be null because it is
	// only null in the first loadData call and that happens
	// before any component initialisation
	return {
		...crelte,
		route: crelte.router.route as Readable<Route>,
		site: crelte.router.site as Readable<Site>,
		entry: crelte.router.entry as Readable<Entry>,
		getGlobal: name => crelte.getGlobalStore(name),
	};
}

/**
 * Get the router from the current context
 *
 * #### Note
 * This only works during component initialisation.
 */
export function getRouter(): Router {
	return innerGetCrelte().router;
}

/**
 * Get the SSR cache from the current context
 *
 * #### Note
 * This only works during component initialisation.
 */
export function getSsrCache(): SsrCache {
	return innerGetCrelte().ssrCache;
}

/**
 * Get the Queries from the current context
 *
 * #### Note
 * This only works during component initialisation.
 */
export function getQueries(): Queries {
	return innerGetCrelte().queries;
}

/**
 * Get a store with the current route
 *
 * #### Note
 * This only works during component initialisation.
 */
export function getRoute(): Readable<Route> {
	return getCrelte().route;
}

/**
 * Get a store with the current site
 *
 * #### Note
 * This only works during component initialisation.
 */
export function getSite(): Readable<Site> {
	return getCrelte().site;
}

/**
 * Get a store with the current entry
 *
 * #### Note
 * This only works during component initialisation.
 */
export function getEntry(): Readable<Entry> {
	return getCrelte().entry;
}

/**
 * returns an env variable from the craft/.env file.
 * All env variables need to start with VITE_
 * except ENDPOINT_URL, CRAFT_WEB_URL and FRONTEND_URL
 *
 * #### Note
 * This only works during component initialisation.
 */
export function getEnv(name: 'ENDPOINT_URL'): string;
export function getEnv(name: 'CRAFT_WEB_URL'): string;
export function getEnv(name: 'FRONTEND_URL'): string;
export function getEnv(name: string): string | null;
export function getEnv(name: string): string | null {
	return innerGetCrelte().getEnv(name);
}

/**
 * returns a store which indicates if the a page is loading
 *
 * #### Note
 * This only works during component initialisation.
 */
export function getLoading(): Readable<boolean> {
	return getRouter().loading;
}

/**
 * returns a store which indicates the loading progress between 0 and 1
 *
 * #### Note
 * This only works during component initialisation.
 */
export function getLoadingProgress(): Readable<number> {
	return getRouter().loadingProgress;
}

/**
 * returns a store which contains a globalSet
 *
 * #### Note
 * This only works during component initialisation.
 */
export function getGlobal<T = any>(name: string): Readable<T> | null {
	return getCrelte().getGlobal(name);
}

/**
 * returns the cookies instance
 *
 * #### Note
 * This only works during component initialisation.
 */
export function getCookies(): Cookies {
	return innerGetCrelte().cookies;
}

/**
 * Listen for route changes
 *
 * route: {@link Route}
 *
 * #### Note
 * This only works during component initialisation.
 */
export function onRoute(fn: (route: Route) => void) {
	const rmListener = getRouter().onRoute(route => fn(route));

	onDestroy(rmListener);
}

/**
 * Listen for requests
 *
 * cr: {@link CrelteRequest}
 *
 * #### Note
 * This only works during component initialisation.
 */
export function onRequest(fn: (cr: CrelteRequest) => void) {
	const rmListener = getRouter().onRequest(cr => fn(cr));

	onDestroy(rmListener);
}

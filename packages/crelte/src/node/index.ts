import http, { IncomingMessage, ServerResponse } from 'node:http';
import path, { join } from 'node:path';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import {
	EnvData,
	initEnvData,
	initSites,
	modRender,
	modRenderError,
} from '../server/shared.js';
import ServerRouter from '../server/ServerRouter.js';
import { fileURLToPath } from 'node:url';
import { initQueryRoutes } from '../server/queries/queries.js';
import {
	PLATFORM,
	readFile,
	requestToWebRequest,
	webResponseToResponse,
	writeFile,
} from './utils.js';
import { timeout } from '../std/index.js';
import { SiteFromGraphQl } from '../routing/Site.js';

function localDir(...args: string[]) {
	return join(path.dirname(fileURLToPath(import.meta.url)), ...args);
}

async function readSitesCache(): Promise<any> {
	return JSON.parse(await readFile(localDir('sites.json')));
}

async function writeSitesCache(data: any): Promise<void> {
	return await writeFile(localDir('sites.json'), JSON.stringify(data));
}

async function initRouter(
	serverMod: any,
	env: EnvData,
): Promise<[SiteFromGraphQl[], ServerRouter]> {
	const sites = await initSites(env, {
		enabled: process.env.NODE_ENV === 'production',
		writeSitesCache,
		readSitesCache,
	});

	const router = new ServerRouter(
		env.endpointUrl,
		env.frontendUrl,
		env.env,
		sites,
		{
			endpointToken: env.endpointToken,
		},
	);

	await initQueryRoutes(PLATFORM, serverMod, router);

	if (typeof serverMod.routes === 'function') {
		await serverMod.routes(router);
	}

	return [sites, router];
}

/**
 * Create and start the server
 *
 * Generally this call should automatically happen via the vite build step.
 */
export default async function createServer(serverMod: any, buildTime: string) {
	const env = await initEnvData(PLATFORM);
	const template = await readFile(localDir('index.html'));
	const globalEtag = '"' + buildTime + '"';
	const ssrManifest = JSON.parse(
		await readFile(localDir('ssr-manifest.json')),
	);

	let sites: SiteFromGraphQl[] | null = null;
	let router: ServerRouter | null = null;
	let routesError: any = null;

	// let's try to init the router
	// if it fails we start a retry loop
	// this way the server can start even if the endpoint is not yet available
	try {
		[sites, router] = await initRouter(serverMod, env);
	} catch (e) {
		routesError = e;
		console.error('Failed to setup router:', e);

		// retry loop
		(async () => {
			while (!router) {
				await timeout(1000);

				try {
					[sites, router] = await initRouter(serverMod, env);
					routesError = null;
				} catch (e) {
					routesError = e;
					console.error('Failed to setup router:', e);
				}
			}
		})();
	}

	const publicDir = localDir('public');

	const handle = async (req: Request, res: ServerResponse) => {
		// if router is not set, just render the error page
		if (routesError || !router || !sites) {
			throw routesError ?? new Error('Router not initialized');
		}

		const routeResp = await router.z_handle(req);
		if (routeResp) {
			await webResponseToResponse(routeResp, res);
			return;
		}

		if (await basicAuthCheck(req, res, env)) return;

		const response = await modRender(env, sites, serverMod, template, req, {
			ssrManifest,
		});
		await webResponseToResponse(response, res);
	};

	http.createServer(async (nodeReq, res) => {
		let req: Request | null = null;
		let err: any;
		try {
			if (await servePublic(nodeReq, res, publicDir, globalEtag)) return;

			// todo this is not safe if we are not in a trusted environment
			const baseUrl =
				(nodeReq.headers['x-forwarded-proto'] ?? 'http') +
				'://' +
				nodeReq.headers['host'];

			req = requestToWebRequest(baseUrl, nodeReq);

			await handle(req, res);

			return;
		} catch (e) {
			err = e;
		}

		if (typeof serverMod.renderError !== 'function' || !req) {
			basicError(res, err);
			return;
		}

		try {
			const response = await modRenderError(
				env,
				serverMod,
				err,
				template,
				req,
				{ ssrManifest },
			);
			await webResponseToResponse(response, res);
		} catch (e) {
			basicError(res, e);
		}
	}).listen(8080);
}

function basicError(res: ServerResponse, err: any) {
	console.error('Internal Server Error:', err);
	res.statusCode = 500;
	res.end('Internal Server Error: ' + err?.message);
	return;
}

const MIME_TYPES: Record<string, string> = {
	'.html': 'text/html',
	'.css': 'text/css',
	'.js': 'application/javascript',
	'.json': 'application/json',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.gif': 'image/gif',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.eot': 'application/vnd.ms-fontobject',
	'.otf': 'font/otf',
	'.txt': 'text/plain',
	'.xml': 'application/xml',
	'.pdf': 'application/pdf',
};

async function servePublic(
	req: IncomingMessage,
	res: ServerResponse,
	publicDir: string,
	globalEtag: string,
): Promise<boolean> {
	if (!req.url || req.url === '/' || req.method !== 'GET') return false;

	// parse the url so we can get the pathname without query params
	const url = new URL(req.url, 'http://localhost');

	let filePath = join(publicDir, url.pathname);
	filePath = path.normalize(filePath);

	if (!filePath.startsWith(publicDir)) {
		res.statusCode = 403;
		res.end();
		return true;
	}

	try {
		const fileStat = await fs.stat(filePath);

		if (!fileStat.isFile()) return false;

		// If client’s ETag matches our global ETag, respond with 304
		if (req.headers['if-none-match'] === globalEtag) {
			res.statusCode = 304;
			res.end();
			return true;
		}

		const ext = path.extname(filePath).toLowerCase();
		const contentType = MIME_TYPES[ext] || 'application/octet-stream';

		// Set up caching headers
		// JS/CSS get a long-lived cache since they're hashed by Vite
		const cacheControl =
			ext === '.js' || ext === '.css'
				? 'public, max-age=31536000, immutable'
				: 'public, max-age=600';

		// Write headers
		res.writeHead(200, {
			'Content-Type': contentType,
			ETag: globalEtag,
			'Cache-Control': cacheControl,
		});

		const stream = createReadStream(filePath);
		stream.pipe(res);

		stream.on('error', () => {
			res.statusCode = 500;
			res.end();
		});

		return true;
	} catch (_e: any) {
		return false;
	}
}

/**
 * This is not a secure basicAuth but a simple way to add some protection
 * for staging or unlisted instances.
 */
async function basicAuthCheck(
	req: Request,
	res: ServerResponse,
	{ env }: EnvData,
): Promise<boolean> {
	const user = env.get('BASIC_AUTH_USER');
	const password = env.get('BASIC_AUTH_PASSWORD');

	// ignore if one information is missing
	if (!user || !password) return false;

	const authHeader = req.headers.get('authorization');

	if (!authHeader || !authHeader.startsWith('Basic ')) {
		res.statusCode = 401;
		res.setHeader('WWW-Authenticate', 'Basic realm="Restricted"');
		res.end('Unauthorized');
		return true;
	}

	const base64Credentials = authHeader.substring('Basic '.length);
	const credentials = Buffer.from(base64Credentials, 'base64').toString(
		'ascii',
	);
	const [username, pwd] = credentials.split(':');

	if (username !== user || pwd !== password) {
		res.statusCode = 401;
		res.setHeader('WWW-Authenticate', 'Basic realm="Restricted"');
		res.end('Unauthorized');
		return true;
	}

	return false;
}

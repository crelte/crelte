import http, { IncomingMessage, ServerResponse } from 'node:http';
import path, { join } from 'node:path';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import {
	EnvData,
	initEnvData,
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

function localDir(...args: string[]) {
	return join(path.dirname(fileURLToPath(import.meta.url)), ...args);
}

async function readSitesCache(): Promise<any> {
	return JSON.parse(await readFile(localDir('sites.json')));
}

async function writeSitesCache(data: any): Promise<void> {
	return await writeFile(localDir('sites.json'), JSON.stringify(data));
}

/**
 * Create and start the server
 *
 * Generally this call should automatically happen via the vite build step.
 */
export default async function createServer(serverMod: any, buildTime: string) {
	const env = await initEnvData(PLATFORM, {
		enabled: process.env.NODE_ENV === 'production',
		writeSitesCache,
		readSitesCache,
	});
	const template = await readFile(localDir('index.html'));
	const globalEtag = '"' + buildTime + '"';
	const ssrManifest = JSON.parse(
		await readFile(localDir('ssr-manifest.json')),
	);

	const router = new ServerRouter(
		env.endpointUrl,
		env.frontendUrl,
		env.env,
		env.sites,
		{
			endpointToken: env.endpointToken,
		},
	);

	await initQueryRoutes(PLATFORM, serverMod, router);

	if (typeof serverMod.routes === 'function') {
		await serverMod.routes(router);
	}

	const publicDir = localDir('public');

	http.createServer(async (nReq, res) => {
		if (await servePublic(nReq, res, publicDir, globalEtag)) return;

		// todo this is not safe if we are not in a trusted environment
		const baseUrl =
			(nReq.headers['x-forwarded-proto'] ?? 'http') +
			'://' +
			nReq.headers['host'];

		const req = requestToWebRequest(baseUrl, nReq);

		let thrownError: any = null;

		try {
			const routeResp = await router.z_handle(req);
			if (routeResp) {
				await webResponseToResponse(routeResp, res);
				return;
			}

			if (await basicAuthCheck(nReq, res, env)) return;

			const response = await modRender(env, serverMod, template, req, {
				ssrManifest,
			});
			await webResponseToResponse(response, res);
			return;
		} catch (e: any) {
			if (typeof serverMod.renderError !== 'function') {
				console.log('error', e);
				throw e;
			}

			thrownError = e;
		}

		try {
			const response = await modRenderError(
				env,
				serverMod,
				thrownError,
				template,
				req,
				{ ssrManifest },
			);
			await webResponseToResponse(response, res);
			return;
		} catch (e) {
			console.log('error', e);
			throw e;
		}
	}).listen(8080);
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
	req: IncomingMessage,
	res: ServerResponse,
	{ env }: EnvData,
): Promise<boolean> {
	const user = env.get('BASIC_AUTH_USER');
	const password = env.get('BASIC_AUTH_PASSWORD');

	// ignore if one information is missing
	if (!user || !password) return false;

	const authHeader = req.headers['authorization'];

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

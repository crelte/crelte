import http, { IncomingMessage, ServerResponse } from 'node:http';
import path, { join } from 'node:path';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import {
	initEnvData,
	modRender,
	modRenderError,
	requestToWebRequest,
	webResponseToResponse,
} from './server.js';
import Router from './Router.js';
import { fileURLToPath } from 'node:url';

async function readFile(path: string): Promise<string> {
	// maybe not necessary
	return await fs.readFile(path, 'utf-8');
}

async function writeFile(path: string, data: string): Promise<void> {
	// maybe not necessary
	return await fs.writeFile(path, data, 'utf-8');
}

function localDir(...args: string[]) {
	return join(path.dirname(fileURLToPath(import.meta.url)), ...args);
}

async function readSitesCache(): Promise<any> {
	return JSON.parse(await readFile(localDir('sites.json')));
}

async function writeSitesCache(data: any): Promise<void> {
	return await writeFile(localDir('sites.json'), JSON.stringify(data));
}

export default async function createServer(serverMod: any, buildTime: string) {
	const env = await initEnvData({
		enabled: process.env.NODE_ENV === 'production',
		writeSitesCache,
		readSitesCache,
	});
	const template = await readFile(localDir('index.html'));
	const globalEtag = '"' + buildTime + '"';
	const ssrManifest = JSON.parse(
		await readFile(localDir('ssr-manifest.json')),
	);

	let router: Router | null = null;
	if (typeof serverMod.routes === 'function') {
		router = new Router(env.endpointUrl, env.env, env.sites);
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
			if (router) {
				const response = await router._handle(req);
				if (response) {
					await webResponseToResponse(response, res);
					return;
				}
			}

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

	let filePath = join(publicDir, req.url);
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

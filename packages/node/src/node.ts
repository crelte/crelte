import http, { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import {
	initEnvData,
	modRender,
	modRenderError,
	requestToWebRequest,
	webResponseToResponse,
} from './server.js';
import Router from './Router.js';
import { createReadStream } from 'node:fs';

async function readFile(path: string): Promise<string> {
	// maybe not necessary
	return await fs.readFile(path, 'utf-8');
}

export default async function createServer(serverMod: any, buildTime: string) {
	const env = await initEnvData();
	const template = await readFile('./dist/index.html');
	const globalEtag = '"' + buildTime + '"';
	// const ssrManifest = await readFile('./ssr-manifest.json');

	let router: Router | null = null;
	if (typeof serverMod.routes === 'function') {
		router = new Router(env.endpointUrl, env.env);
		await serverMod.routes(router);
	}

	const publicDir = path.join(process.cwd(), 'dist/public');

	http.createServer(async (nReq, res) => {
		if (await servePublic(nReq, res, publicDir, globalEtag)) return;

		const baseUrl = 'https://' + nReq.headers['host'];

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

			const response = await modRender(env, serverMod, template, req);
			await webResponseToResponse(response, res);
			return;
		} catch (e: any) {
			if (typeof serverMod.renderError !== 'function') {
				console.log('error', e);
				throw e;
				return;
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

	let filePath = path.join(publicDir, req.url);
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

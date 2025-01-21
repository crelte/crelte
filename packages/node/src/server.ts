// import path from 'path';
import { readFile as readFileAsync } from 'fs/promises';
import { Connect, ViteDevServer } from 'vite';
import { Readable } from 'node:stream';
import * as http from 'node:http';
import Router from './Router.js';

async function readFile(path: string): Promise<string> {
	// maybe not necessary
	return await readFileAsync(path, 'utf-8');
}

export type ServerOptions = {
	// typescript client.ts & server.ts
	ts?: boolean;
};

export type RenderResponse = {
	status: number;
	location?: string;
	html?: string;
	setCookies?: string[];
};

/*
steps debug:
setup vite
setup route
*/

export type EnvData = {
	env: Map<string, string>;
	endpointUrl: string;
	craftWebUrl: string;
	viteEnv: Map<string, string>;
};

export async function initEnvData(): Promise<EnvData> {
	const envPath = '../craft/.env';

	let env;
	try {
		env = readEnv(await readFile(envPath));
	} catch (_e) {
		throw new Error('failed to read ' + envPath + ' file');
	}

	const endpointUrl = env.get('ENDPOINT_URL');
	if (!endpointUrl) throw new Error('ENDPOINT_URL not set');

	const craftWebUrl = env.get('CRAFT_WEB_URL');
	if (!craftWebUrl) throw new Error('CRAFT_WEB_URL not set');

	// parse all vite related env variables
	const viteEnv = new Map(
		Array.from(env).filter(([key]) => key.startsWith('VITE_')),
	);

	return {
		env,
		endpointUrl,
		craftWebUrl,
		viteEnv,
	};
}

type RenderFn = (req: RenderRequest) => Promise<RenderResponse>;

export type RenderRequest = {
	url: string;
	htmlTemplate: string;
	ssrManifest: Record<string, string>;
	acceptLang: string | null;
	endpoint: string;
	craftWeb: string;
	viteEnv: Map<string, string>;
	cookies: string;
};

async function modRender(
	env: EnvData,
	mod: any,
	template: string,
	req: Request,
): Promise<Response> {
	const acceptLang = req.headers.get('accept-language') ?? null;
	const cookies = req.headers.get('Cookie') ?? '';
	const nHeaders = new Headers();

	const { status, location, html, setCookies } = await (
		mod.render as RenderFn
	)({
		url: req.url,
		htmlTemplate: template,
		ssrManifest: {},
		acceptLang,
		endpoint: env.endpointUrl,
		craftWeb: env.craftWebUrl,
		viteEnv: env.viteEnv,
		cookies,
	});

	if (setCookies) {
		setCookies.forEach(cookie => nHeaders.append('Set-Cookie', cookie));
	}

	if (status === 301 || status === 302) {
		nHeaders.append('Location', location ?? '');
		return new Response(null, { status, headers: nHeaders });
	}

	nHeaders.append('Content-Type', 'text/html');
	return new Response(html, { status, headers: nHeaders });
}

type RenderErrorFn = (
	error: { status: number; message: string },
	req: RenderErrorRequest,
) => Promise<RenderResponse>;

export type RenderErrorRequest = {
	url: string;
	htmlTemplate: string;
	ssrManifest: Record<string, string>;
	acceptLang: string | null;
	endpoint: string;
	craftWeb: string;
	viteEnv: Map<string, string>;
};

async function modRenderError(
	env: EnvData,
	mod: any,
	thrownError: Error,
	template: string,
	req: Request,
): Promise<Response> {
	const acceptLang = req.headers.get('accept-language') ?? null;

	// in the case of an error let's try to render a nice Error Page
	const error = {
		status: 500,
		message: thrownError.message,
	};

	if (typeof (thrownError as any).__isGraphQlError__ === 'function')
		error.status = (thrownError as any).status();

	if (error.status !== 503 && process.env.NODE_ENV === 'development') {
		throw thrownError;
	}

	const { status, html } = await (mod.renderError as RenderErrorFn)(error, {
		url: req.url,
		htmlTemplate: template,
		ssrManifest: {},
		endpoint: env.endpointUrl,
		craftWeb: env.craftWebUrl,
		viteEnv: env.viteEnv,
		acceptLang,
	});

	return new Response(html, {
		status,
		headers: {
			'Content-Type': 'text/html',
		},
	});
}

export async function serveVite(env: EnvData, vite: ViteDevServer) {
	vite.middlewares.use(async (nReq, res, next) => {
		const protocol = vite.config.server.https ? 'https' : 'http';
		const baseUrl = protocol + '://' + nReq.headers['host'];

		const req = requestToWebRequest(baseUrl, nReq);

		// todo at this point we should check the routes for overrides

		let thrownError: any = null;

		const serverMod = await vite.ssrLoadModule('./src/server.js', {
			fixStacktrace: true,
		});

		if (typeof serverMod.routes === 'function') {
			// check if a route matches
			const router = new Router(env.endpointUrl, env.env);

			await serverMod.routes(router);

			try {
				const response = await router._handle(req);
				if (response) {
					await webResponseToResponse(response, res);
					return;
				}
			} catch (e: any) {
				vite.ssrFixStacktrace(e);
				next(e);
				return;
			}
		}

		let template = await readFile('./index.html');
		template = await vite.transformIndexHtml(
			nReq.originalUrl ?? '',
			template,
		);

		try {
			const response = await modRender(env, serverMod, template, req);
			await webResponseToResponse(response, res);
			return;
		} catch (e: any) {
			vite.ssrFixStacktrace(e);

			if (typeof serverMod.renderError !== 'function') return next(e);

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
			next(e);
		}
	});
}

// export async function serveExpress(server: CoreServer, app: Express) {
// 	app.use(express.static('./dist/public'));

// 	const ssrManifest = await readFile('./dist/ssr-manifest.json');
// 	server.ssrManifest = JSON.parse(ssrManifest);

// 	const template = await readFile('./dist/index.html');

// 	app.use('*', async (req, res, next) => {
// 		const url = req.originalUrl;
// 		const fullUrl = req.protocol + '://' + req.get('host') + url;
// 		const acceptLang = req.get('accept-language') ?? null;
// 		let serverMod = null;
// 		let thrownError: any = null;
// 		try {
// 			const distServer = path.resolve('./dist/server.js');
// 			serverMod = await import(distServer);
// 		} catch (e) {
// 			return next(e);
// 		}
// 		try {
// 			// render app html
// 			const { status, location, html, setCookies } =
// 				await server.serverModRender(
// 					serverMod,
// 					fullUrl,
// 					template,
// 					acceptLang,
// 					req.get('Cookie') ?? '',
// 				);

// 			if (setCookies) {
// 				res.append('Set-Cookie', setCookies);
// 			}

// 			if (status === 301 || status === 302) {
// 				res.redirect(status, location ?? '');
// 				return;
// 			}

// 			// Send the rendered HTML back
// 			res.status(status).set({ 'Content-Type': 'text/html' }).end(html);
// 			return;
// 		} catch (e: any) {
// 			console.log('error', e);

// 			if (typeof serverMod.renderError !== 'function') return next(e);

// 			thrownError = e;
// 		}

// 		// in the case of an error let's try to render a nice Error Page
// 		const error = {
// 			status: 500,
// 			message: thrownError.message,
// 		};

// 		if (typeof thrownError.__isGraphQlError__ === 'function')
// 			error.status = thrownError.status();

// 		if (error.status !== 503 && process.env.NODE_ENV === 'development')
// 			return next(thrownError);

// 		const { status, html } = await server.serverModRenderError(
// 			serverMod,
// 			error,
// 			fullUrl,
// 			template,
// 			acceptLang,
// 		);

// 		res.status(status).set({ 'Content-Type': 'text/html' }).end(html);
// 	});
// }

/**
 * Parses an .env file
 *
 * @param fileCtn the file content.
 * @returns a Map of the env variables.
 */
function readEnv(fileCtn: string): Map<string, string> {
	// todo should we skip comments?
	const REGEX = /^ *(\w+) *= *"?(.+?)"? *$/gm;

	const map = new Map();
	// @ts-ignore
	for (const match of fileCtn.matchAll(REGEX)) {
		if (match.length === 3) map.set(match[1], match[2]);
	}

	return map;
}

function requestToWebRequest(
	baseUrl: string,
	nodeReq: Connect.IncomingMessage,
): Request {
	const method = nodeReq.method ?? 'GET';

	let body;
	if (method !== 'GET' && method !== 'HEAD') {
		body = Readable.toWeb(nodeReq) as BodyInit;
	}

	const url = baseUrl + (nodeReq.originalUrl ?? nodeReq.url);

	// 4. Construct a new Request
	return new Request(url, {
		method,
		headers: nodeReq.headers as Record<string, string>,
		body,
	});
}

export async function webResponseToResponse(
	webResponse: Response,
	nodeRes: http.ServerResponse,
): Promise<void> {
	nodeRes.statusCode = webResponse.status;
	nodeRes.statusMessage = webResponse.statusText || '';

	for (const [key, value] of webResponse.headers.entries()) {
		nodeRes.setHeader(key, value);
	}

	if (!webResponse.body) {
		nodeRes.end();
		return;
	}

	const nodeStream = Readable.fromWeb(webResponse.body as any);
	nodeStream.pipe(nodeRes);

	nodeStream.on('error', err => {
		nodeRes.destroy(err);
	});
}

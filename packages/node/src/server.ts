// import path from 'path';
import { readFile as readFileAsync } from 'fs/promises';
import { Connect, ViteDevServer } from 'vite';
import { Readable } from 'node:stream';
import * as http from 'node:http';

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

async function initEnvData(): Promise<EnvData> {
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
	mod: any,
	data: RenderRequest,
): Promise<RenderResponse> {
	return await mod.render(data);
}

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
	mod: any,
	error: any,
	data: RenderErrorRequest,
): Promise<RenderResponse> {
	return await mod.renderError(error, data);
}

export async function serveVite(vite: ViteDevServer) {
	const env = await initEnvData();

	vite.middlewares.use(async (req, res, next) => {
		const url = req.originalUrl;
		const protocol = vite.config.server.https ? 'https' : 'http';
		const fullUrl = protocol + '://' + req.headers['host'] + url;
		const acceptLang = req.headers['accept-language'] ?? null;

		// todo at this point we should check the routes for overrides

		let thrownError: any = null;

		const serverMod = await vite.ssrLoadModule('./src/server.js', {
			fixStacktrace: true,
		});

		let template = await readFile('./index.html');
		template = await vite.transformIndexHtml(url ?? '', template);

		try {
			const cookies = req.headers['Cookie'] ?? '';

			const { status, location, html, setCookies } = await modRender(
				serverMod,
				{
					url: fullUrl,
					htmlTemplate: template,
					ssrManifest: {},
					acceptLang,
					endpoint: env.endpointUrl,
					craftWeb: env.craftWebUrl,
					viteEnv: env.viteEnv,
					cookies: Array.isArray(cookies)
						? cookies.join(';')
						: cookies,
				},
			);

			if (setCookies) {
				res.setHeader('Set-Cookie', setCookies);
			}

			res.statusCode = status;

			if (status === 301 || status === 302) {
				res.setHeader('Location', location ?? '');
				res.end();
				return;
			}

			res.setHeader('Content-Type', 'text/html');
			res.end(html);
			return;
		} catch (e: any) {
			vite.ssrFixStacktrace(e);

			if (typeof serverMod.renderError !== 'function') return next(e);

			thrownError = e;
		}

		// in the case of an error let's try to render a nice Error Page
		const error = {
			status: 500,
			message: thrownError.message,
		};

		if (typeof thrownError.__isGraphQlError__ === 'function')
			error.status = thrownError.status();

		if (error.status !== 503 && process.env.NODE_ENV === 'development')
			return next(thrownError);

		const { status, html } = await modRenderError(serverMod, error, {
			url: fullUrl,
			htmlTemplate: template,
			ssrManifest: {},
			endpoint: env.endpointUrl,
			craftWeb: env.craftWebUrl,
			viteEnv: env.viteEnv,
			acceptLang,
		});

		res.statusCode = status;
		res.setHeader('Content-Type', 'text/html');
		res.end(html);
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

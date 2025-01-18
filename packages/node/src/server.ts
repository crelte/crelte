// import path from 'path';
import { readFile as readFileAsync } from 'fs/promises';
import path from 'path';
import express, { Express } from 'express';
import { ViteDevServer } from 'vite';

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

/**
 * Express Server
 */
export class CoreServer {
	env: Map<string, string>;
	ssrManifest: Record<string, string>;
	fileExtension: string;

	endpointUrl!: string;
	craftWebUrl!: string;
	viteEnv!: Map<string, string>;

	/**
	 * Creates a new Server
	 */
	constructor(opts: ServerOptions) {
		this.env = new Map();

		this.ssrManifest = {};

		this.fileExtension = opts.ts ? 'ts' : 'js';
	}

	/**
	 * Setups the Express server
	 *
	 * - Creates the vite middleware
	 * - loads the ssr manifest and the index.html file
	 */
	async _setup() {
		const envPath = '../craft/.env';

		try {
			this.env = readEnv(await readFile(envPath));
		} catch (_e) {
			throw new Error('failed to read ' + envPath + ' file');
		}

		const endpointUrl = this.env.get('ENDPOINT_URL');
		if (!endpointUrl) throw new Error('ENDPOINT_URL not set');
		this.endpointUrl = endpointUrl;

		const craftWebUrl = this.env.get('CRAFT_WEB_URL');
		if (!craftWebUrl) throw new Error('CRAFT_WEB_URL not set');
		this.craftWebUrl = craftWebUrl;

		// parse all vite related env variables
		this.viteEnv = new Map(
			Array.from(this.env).filter(([key]) => key.startsWith('VITE_')),
		);
	}

	// /**
	//  * Setups a custom route
	//  *
	//  * the handler should be a function which will be called from the server.js / .ts
	//  * file
	//  */
	// async register(route: any, handler: string) {
	// 	this.app.use(route, async (...args) => {
	// 		const server = await this._getServer();
	// 		if (!(handler in server))
	// 			throw new Error('handler ' + handler + ' not found');
	// 		return await server[handler](...args);
	// 	});
	// }

	// /**
	//  * Start the express server
	//  *
	//  * If `process.env.PORT` exists uses it instead.
	//  *
	//  * @param  [port=8080]
	//  * @param  [addr='127.0.0.1']
	//  */
	// listen(port: number = 8080, addr: string = '127.0.0.1') {
	// 	if (process?.env?.PORT) {
	// 		port = parseFloat(process.env.PORT);
	// 	}

	// 	if (process?.env?.HOST) {
	// 		addr = process.env.HOST;
	// 	}

	// 	console.log('listening on http://' + addr + ':' + port + '/');
	// 	this.app.listen(port, addr);
	// }

	async serverModRender(
		serverMod: any,
		url: string,
		htmlTemplate: string,
		acceptLang: string | null,
		cookieHeader: string,
	): Promise<RenderResponse> {
		return await serverMod.render({
			url,
			htmlTemplate,
			ssrManifest: this.ssrManifest ?? {},
			acceptLang,
			endpoint: this.endpointUrl,
			craftWeb: this.craftWebUrl,
			viteEnv: this.viteEnv,
			cookies: cookieHeader,
		});
	}

	async serverModRenderError(
		serverMod: any,
		error: any,
		url: string,
		htmlTemplate: string,
		acceptLang: string | null,
	): Promise<RenderResponse> {
		return await serverMod.renderError(error, {
			url,
			htmlTemplate,
			ssrManifest: this.ssrManifest ?? {},
			acceptLang,
			endpoint: this.endpointUrl,
			craftWeb: this.craftWebUrl,
			viteEnv: this.viteEnv,
		});
	}
}

export async function serveVite(server: CoreServer, vite: ViteDevServer) {
	vite.middlewares.use(async (req, res, next) => {
		const url = req.originalUrl;
		const protocol = vite.config.server.https ? 'https' : 'http';
		const fullUrl = protocol + '://' + req.headers['host'] + url;
		const acceptLang = req.headers['accept-language'] ?? null;

		let thrownError: any = null;

		const serverMod = await vite.ssrLoadModule(
			'./src/server.' + server.fileExtension,
			{
				fixStacktrace: true,
			},
		);

		let template = await readFile('./index.html');
		template = await vite.transformIndexHtml(url ?? '', template);

		try {
			const cookies = req.headers['Cookie'] ?? '';

			const { status, location, html, setCookies } =
				await server.serverModRender(
					serverMod,
					fullUrl,
					template,
					acceptLang,
					Array.isArray(cookies) ? cookies.join(';') : cookies,
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

		const { status, html } = await server.serverModRenderError(
			serverMod,
			error,
			fullUrl,
			template,
			acceptLang,
		);

		res.statusCode = status;
		res.setHeader('Content-Type', 'text/html');
		res.end(html);
	});
}

export async function serveExpress(server: CoreServer, app: Express) {
	app.use(express.static('./dist/public'));

	const ssrManifest = await readFile('./dist/ssr-manifest.json');
	server.ssrManifest = JSON.parse(ssrManifest);

	const template = await readFile('./dist/index.html');

	app.use('*', async (req, res, next) => {
		const url = req.originalUrl;
		const fullUrl = req.protocol + '://' + req.get('host') + url;
		const acceptLang = req.get('accept-language') ?? null;
		let serverMod = null;
		let thrownError: any = null;
		try {
			const distServer = path.resolve('./dist/server.js');
			serverMod = await import(distServer);
		} catch (e) {
			return next(e);
		}
		try {
			// render app html
			const { status, location, html, setCookies } =
				await server.serverModRender(
					serverMod,
					fullUrl,
					template,
					acceptLang,
					req.get('Cookie') ?? '',
				);

			if (setCookies) {
				res.append('Set-Cookie', setCookies);
			}

			if (status === 301 || status === 302) {
				res.redirect(status, location ?? '');
				return;
			}

			// Send the rendered HTML back
			res.status(status).set({ 'Content-Type': 'text/html' }).end(html);
			return;
		} catch (e: any) {
			console.log('error', e);

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

		const { status, html } = await server.serverModRenderError(
			serverMod,
			error,
			fullUrl,
			template,
			acceptLang,
		);

		res.status(status).set({ 'Content-Type': 'text/html' }).end(html);
	});
}

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

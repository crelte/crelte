import path from 'path';
import { readFile as readFileAsync } from 'fs/promises';
import express, { Express, Request, Response } from 'express';
import { ViteDevServer, createServer as createViteServer } from 'vite';

async function readFile(path: string): Promise<string> {
	// maybe not necessary
	return await readFileAsync(path, 'utf-8');
}

export type ServerOptions = {
	// typescript client.ts & server.ts
	ts?: boolean;

	// set this to false if you don't have a craft instance
	// using static
	hasCraft?: boolean;
};

export async function newServer(opts: ServerOptions = {}) {
	opts = {
		ts: false,
		hasCraft: true,
		...opts,
	};

	const server = new Server(opts);
	await server._setup(opts);
	return server;
}

export type GenericRouteOptions = {
	hookBefore?: (
		req: Request,
		res: Response,
		next: () => void,
	) => Promise<boolean> | boolean;
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
export class Server {
	app: Express;
	vite: ViteDevServer | null;
	env: Map<string, string>;
	ssrManifest: Record<string, string>;
	inDebug: boolean;
	fileExtension: string;

	endpointUrl!: string;
	craftWebUrl!: string;
	viteEnv!: Map<string, string>;

	private prodTemplate: string;

	/**
	 * Creates a new Server
	 */
	constructor(opts: ServerOptions = {}) {
		this.app = express();
		this.vite = null;

		this.env = new Map();

		this.ssrManifest = {};
		this.prodTemplate = '';

		this.inDebug = process.argv.length >= 3 && process.argv[2] === 'dev';
		this.fileExtension = opts.ts ? 'ts' : 'js';
	}

	/**
	 * Setups the Express server
	 *
	 * - Creates the vite middleware
	 * - loads the ssr manifest and the index.html file
	 *
	 * @param {Object} opts if env is present it should be a Map
	 */
	async _setup(opts: ServerOptions = {}) {
		let envPath = opts.hasCraft ? '../craft/.env' : '.env';

		try {
			this.env = readEnv(await readFile(envPath));
		} catch (e) {
			throw new Error('failed to read ' + envPath + ' file');
		}

		if (opts.hasCraft) {
			const endpointUrl = this.env.get('ENDPOINT_URL');
			if (!endpointUrl) throw new Error('ENDPOINT_URL not set');
			this.endpointUrl = endpointUrl;

			const craftWebUrl = this.env.get('CRAFT_WEB_URL');
			if (!craftWebUrl) throw new Error('CRAFT_WEB_URL not set');
			this.craftWebUrl = craftWebUrl;
		} else {
			// shim them if we don't have craft
			this.endpointUrl = '';
			this.craftWebUrl = '';
		}

		// parse all vite related env variables
		this.viteEnv = new Map(
			Array.from(this.env).filter(([key]) => key.startsWith('VITE_')),
		);

		if (this.inDebug) {
			return await this._setupDebug();
		} else {
			return await this._setupProd();
		}
	}

	/**
	 * Setups the generic routes
	 *
	 * @param {Object} opts
	 * - opts.hookBefore(req, res, next) -> bool (true stops routing)
	 */
	async setupGenericRoute(opts: GenericRouteOptions = {}) {
		this.app.use('*', async (req, res, next) => {
			return await this._handleGenericRequest(req, res, next, opts);
		});
	}

	/**
	 * Setups a custom route
	 *
	 * the handler should be a function which will be called from the server.js / .ts
	 * file
	 */
	async register(route: any, handler: string) {
		this.app.use(route, async (...args) => {
			const server = await this._getServer();
			if (!(handler in server))
				throw new Error('handler ' + handler + ' not found');
			return await server[handler](...args);
		});
	}

	/**
	 * Start the express server
	 *
	 * If `process.env.PORT` exists uses it instead.
	 *
	 * @param  [port=8080]
	 * @param  [addr='127.0.0.1']
	 */
	listen(port: number = 8080, addr: string = '127.0.0.1') {
		if (process?.env?.PORT) {
			port = parseFloat(process.env.PORT);
		}

		if (process?.env?.HOST) {
			addr = process.env.HOST;
		}

		console.log('listening on http://' + addr + ':' + port + '/');
		this.app.listen(port, addr);
	}

	private async _setupDebug() {
		// Create Vite server in middleware mode and configure the app type as
		// 'custom', disabling Vite's own HTML serving logic so parent server
		// can take control
		this.vite = await createViteServer({
			server: { middlewareMode: true },
			appType: 'custom',
		});

		// use vite's connect instance as middleware
		// if you use your own express router (express.Router()), you should
		// use router.use
		this.app.use(this.vite.middlewares);
	}

	private async _setupProd() {
		const manifest = await readFile('./dist/ssr-manifest.json');
		this.ssrManifest = JSON.parse(manifest);

		const template = await readFile('./dist/index.html');
		this.prodTemplate = template;

		this.app.use(express.static('./dist/public'));
	}

	async _handleGenericRequest(
		req: Request,
		res: Response,
		next: (e?: any) => void,
		opts: GenericRouteOptions = {},
	) {
		// at the moment only used in static package
		if (opts.hookBefore) {
			const quit = await opts.hookBefore(req, res, next);
			if (quit) return;
		}

		const url = req.originalUrl;
		const fullUrl = req.protocol + '://' + req.get('host') + url;
		const acceptLang = req.get('accept-language') ?? null;
		const vite = this.vite;

		let serverMod = null;
		let template = this.prodTemplate;
		let thrownError: any = null;

		try {
			serverMod = await this._getServer();
		} catch (e) {
			return next(e);
		}

		try {
			if (vite) {
				// read index
				template = await readFile('./index.html');
				template = await vite!.transformIndexHtml(url, template);
			}

			// render app html
			const { status, location, html, setCookies }: RenderResponse =
				await serverMod.render({
					url: fullUrl,
					htmlTemplate: template,
					ssrManifest: this.ssrManifest ?? {},
					acceptLang,
					endpoint: this.endpointUrl,
					craftWeb: this.craftWebUrl,
					viteEnv: this.viteEnv,
					cookies: req.get('Cookie'),
				});

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
			// If an error is caught, let Vite fix the stack trace so it maps back to
			// your actual source code.
			if (vite) vite.ssrFixStacktrace(e);

			console.log('error', e);

			if (typeof serverMod.renderError !== 'function') return next(e);

			thrownError = e;
		}

		// in the case of an error let's try to render a nice Error Page
		try {
			const error = {
				status: 500,
				message: thrownError.message,
			};

			if (typeof thrownError.__isGraphQlError__ === 'function')
				error.status = thrownError.status();

			if (error.status !== 503 && process.env.NODE_ENV === 'development')
				return next(thrownError);

			const { status, html } = await serverMod.renderError(error, {
				url: fullUrl,
				htmlTemplate: template,
				ssrManifest: this.ssrManifest ?? {},
				acceptLang,
				endpoint: this.endpointUrl,
				craftWeb: this.craftWebUrl,
				viteEnv: this.viteEnv,
			});

			res.status(status).set({ 'Content-Type': 'text/html' }).end(html);
		} catch (e: any) {
			if (vite) vite.ssrFixStacktrace(e);

			next(e);
		}
	}

	async _getServer() {
		const vite = this.vite;
		if (this.inDebug && vite) {
			// load server entry
			return await vite.ssrLoadModule(
				'./src/server.' + this.fileExtension,
				{
					fixStacktrace: true,
				},
			);
		}

		const distServer = path.resolve('./dist/server.js');
		return await import(distServer);
	}
}

/**
 * Parses an .env file
 *
 * @param fileCtn the file content.
 * @returns a Map of the env variables.
 */
function readEnv(fileCtn: string): Map<string, string> {
	// todo should we skip comments?
	const REGEX = /^ *(\w+) *= *\"?(.+?)\"? *$/gm;

	const map = new Map();
	// @ts-ignore
	for (const match of fileCtn.matchAll(REGEX)) {
		if (match.length === 3) map.set(match[1], match[2]);
	}

	return map;
}

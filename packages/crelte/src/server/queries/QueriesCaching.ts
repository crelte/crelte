import CrelteServerRequest from '../CrelteServer.js';
import { newError } from './routes.js';
import ServerRouter from '../ServerRouter.js';
import { Platform } from '../platform.js';

export type QueriesCachingOptions = {
	debug?: boolean;
};

// internal only
export default class QueriesCaching {
	private platform: Platform;
	private cacheDir: string | null;
	private validBearerToken: string | null;
	debug: boolean;
	router: ServerRouter;

	constructor(
		platform: Platform,
		cs: ServerRouter,
		opts?: QueriesCachingOptions,
	) {
		this.platform = platform;
		this.router = cs;
		this.debug = !!opts?.debug;

		const enableCaching = cs.getEnv('CACHING') === 'true';
		const endpointToken = cs.getEnv('ENDPOINT_TOKEN');
		if (enableCaching) {
			if (!endpointToken)
				throw new Error(
					'if caching is enabled you need to specify an ENDPOINT_TOKEN',
				);

			// todo maybe this should be configurable
			this.cacheDir = 'queries-cache';
			this.validBearerToken = 'Bearer ' + endpointToken;
		} else {
			this.cacheDir = null;
			this.validBearerToken = null;

			if (this.debug) console.log('QueriesCaching: caching is disabled');
		}

		if (enableCaching)
			cs.post('/queries/webhook', csr => this.handleWebhook(csr));
	}

	isEnabled(): boolean {
		return !!this.cacheDir;
	}

	async getCache<T = any>(key: string): Promise<T | null> {
		if (!this.cacheDir) return null;

		const path = this.platform.joinPath(this.cacheDir, key + '.json');
		let str: string;
		try {
			str = await this.platform.readFile(path);
		} catch (_e) {
			return null;
		}

		try {
			return JSON.parse(str);
		} catch (_e) {
			console.error(`could not parse '${path}' as json`);
		}

		return null;
	}

	async setCache<T>(key: string, data: T): Promise<void> {
		if (!this.cacheDir) return;

		const path = this.platform.joinPath(this.cacheDir, key + '.json');

		await this.platform.mkdir(this.cacheDir, { recursive: true });

		await this.platform.writeFile(path, JSON.stringify(data));
	}

	/// only call this if caching is enabled
	private async handleWebhook(csr: CrelteServerRequest): Promise<Response> {
		const bearerToken = csr.req.headers.get('Authorization');
		if (bearerToken !== this.validBearerToken)
			return newError('unauthorized', 401);

		try {
			await this.platform.rm(this.cacheDir!, {
				recursive: true,
				force: true,
			});
		} catch (_e) {
			//
		}

		return new Response('ok');
	}
}

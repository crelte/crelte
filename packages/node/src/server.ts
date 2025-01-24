import { readFile as readFileAsync } from 'node:fs/promises';
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

export async function modRender(
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

export async function modRenderError(
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

export function requestToWebRequest(
	baseUrl: string,
	nodeReq: http.IncomingMessage,
): Request {
	const method = nodeReq.method ?? 'GET';

	let body;
	if (method !== 'GET' && method !== 'HEAD') {
		body = Readable.toWeb(nodeReq) as BodyInit;
	}

	const url = baseUrl + ((nodeReq as any).originalUrl ?? nodeReq.url);

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

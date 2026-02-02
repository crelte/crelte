import { QueryVar } from '../../queries/vars.js';
import CrelteServerRequest from '../CrelteServer.js';
import ServerRouter from '../ServerRouter.js';
import { HandleFn, newError, validateVars } from './routes.js';

// only internal
export default class QueryHandleRoute {
	name: string;
	handleFn: HandleFn;
	vars: Record<string, QueryVar> | null;

	constructor(
		name: string,
		handleFn: HandleFn,
		vars: Record<string, QueryVar> | null,
	) {
		this.name = name;
		this.handleFn = handleFn;
		this.vars = vars;
	}

	async handle(
		cs: ServerRouter,
		csr: CrelteServerRequest,
	): Promise<Response> {
		let vars: Record<string, any>;
		try {
			const reqVars = await csr.req.json();
			vars = validateVars(this.vars, reqVars, cs);
		} catch (e) {
			return newError(e, 400);
		}

		const res = await this.handleFn(csr, vars);
		return Response.json(res);
	}
}

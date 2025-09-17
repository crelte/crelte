export type QueryErrorResponse = {
	status?: number;
	body?: string;
};

// todo improve this
/**
 * A QueryError error
 */
export default class QueryError extends Error {
	resp: QueryErrorResponse;
	ctx: any;

	// ctx might be anything
	constructor(resp: QueryErrorResponse, ctx: any = null) {
		super();

		this.resp = resp;
		this.ctx = ctx;
	}

	/**
	 * The status code of the response
	 */
	status(): number {
		return this.resp?.status ?? 500;
	}

	__QueryError__() {}

	/**
	 * The error message in string form
	 */
	get message(): string {
		return 'QueryError: ' + JSON.stringify(this.resp);
	}
}

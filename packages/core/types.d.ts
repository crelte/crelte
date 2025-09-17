declare module '*.graphql' {
	// todo this would be a GraphQL query object
	// but node doesn't import GraphQl and the type might change?
	// this just removes the anoying typescript error
	const value: { queryName: string };
	export default value;

	export const query: {
		query: string;
		path: string;
	};
}

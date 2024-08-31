declare module '*.graphql' {
	// todo this would be a GraphQL query object
	// but node doesn't import GraphQl and the type might change?
	// this just removes the anoying typescript error
	const value: any;
	export default value;
}

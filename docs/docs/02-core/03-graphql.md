# GraphQl

GraphQL serves as the link between the Craft CMS and the Crelte frontend. With the appropriate access permissions configured, you can query nearly any data within Craft.

Crelte automatically executes two queries, `global.graphql` and `entry.graphql`. To optimize performance try to make one big request with multiple queries, instead of multiple small requests.

## How does GraphQL work

Here is the basic `entry.graphql` query:

```graphql
query ($uri: [String], $siteId: [QueryArgument]) {
	entry(uri: $uri, siteId: $siteId) {
		id
		siteId
		sectionHandle
		typeHandle
		title
	}
}
```

On the first line two variables are defined, `$uri` and `$siteId`. These need to be passed when
executing a GraphQL file. `$siteId` is special because it is automatically available in all queries.

## Definition

GraphQl can either be written inline or in a separate file.

### File

```graphql
# src/queries/blogs.graphql
query ($siteId: [QueryArgument]) {
	blogs: entries(section: "blogs", siteId: $siteId) {
		title
		url
	}
}
```

### Inline

```ts
import { gql } from 'crelte/graphql';

const query = gql`
	query ($siteId: [QueryArgument]) {
		blogs: entries(section: "blogs", siteId: $siteId) {
			title
			url
		}
	}
`;
```

:::warning
The caviat with inlining the GraphQL is that you need to enable the public GraphQL schema in craft. Therefore we do not recommend using this option in Svelte components.
:::

## Execution

Queries can either be run via [Crelte.query](/types/crelte/type-aliases/Crelte.html#query), `CrelteRequest.query` or by setting it directly as a [loadData](/docs/02-core/02-load-data.md).

By default all GraphQL queries are cached.

## Example

This is a small example of a site which has two entry types and a matrix field with two
block types.

```graphql
# fragments can be used to improve readability
fragment Text on text_Entry {
	title
	text
}

# fragments can be used to improve readability
fragment Image on image_Entry {
	title
	image {
		title
		# alias can be used for better names
		# or to use the same query multiple times
		small: url(transform: "small")
		medium: url(transform: "medium")
		width(transform: "medium")
		height(transform: "medium")
	}
}

query ($uri: [String], $siteId: [QueryArgument]) {
	entry(uri: $uri, siteId: $siteId) {
		id
		siteId
		sectionHandle
		typeHandle
		title
		... on home_Entry {
			image {
				title
				medium: url(transform: "medium")
				big: url(transform: "big")
				width(transform: "big")
				height(transform: "big")
			}
			content {
				...Text
				...Image
			}
		}
		... on page_Entry {
			content {
				...Text
				...Image
			}
		}
	}
}
```

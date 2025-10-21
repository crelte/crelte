# Load data

Before a template can be rendered, it needs data. Two data sources get loaded for you automatically, `global.graphql` and `entry.graphql` others need to be defined in `loadGlobalData` or `loadData` respectively.

## loadGlobalData

The first load that occurs is `loadGlobalData`. This will load the `global.graphql`, at the same time `entry.graphql` is loaded. If you don't need to wait for the entry to be available you can export a `loadGlobalData` function from the `App.svelte`.

```svelte
<script module>
	// Note that exporting loadGlobalData will override the default global.graphql
	/** @type {import('crelte').LoadData} */
	export const loadGlobalData = {
		someApi: () => fetch('https://api.example.com').then(res => res.json())
	};
</script>

<script>
	import { getGlobal } from 'crelte';

	const someApi = getGlobal('someApi');
</script>
```

After this `loadData` get's called.

## loadData

Each template can have a `loadData` export which will get automatically called by crelte.

### templates/pages-home.svelte

```svelte
<script module>
	import blogsQuery from '@/queries/blogs.graphql';

	/** @type {import('crelte').LoadData} */
	export const loadData = (cr, entry) => cr.query(
		blogsQuery,
		{ categories: entry.categories }
	);
</script>

<script>
	// all properties from the query will be available here
	let { entries } = $props();
</script>
```

## Types

There are four ways `loadData` can be defined. Each of them will be executed on the server and on the client.

### Object

This is the most common way loadData will be used.
Each property should be a loadData type, each one is called in parallel.
And will be available to your component with the same name.

```svelte
<script module>
	import entriesQuery from '@/queries/entries.graphql';
	import { loadData as headerLoadData } from '@/layout/header.svelte';

	/** @type {import('crelte').LoadData} */
	export const loadData = {
		entries: entriesQuery,
		header: headerLoadData
	};
</script>

<script>
	// entries will contain an object of the queries you call in
	// the graphql file
	let { entries, header } = $props();
</script>
```

### GraphQl

You can just export a graphql query as a loadData type.
This will export all queries from the graphql file as properties.

```svelte
<script module>
	import blogsQuery from '@/queries/blogs.graphql';

	/** @type {import('crelte').LoadData} */
	export const loadData = blogsQuery;
</script>

<script>
	// the name of this property comes from the graphQl file
	// graphql example: `blogs: entries(section: "blogs")`
	let { blogs } = $props();
</script>
```

### Function

Using a function gives you the most flexibility but also is the
most cumbersome.

```svelte
<script module>
	import articlesQuery from '@/queries/articles.graphql';

	/** @type {import('crelte').LoadDataFn} */
	export async function loadData(cr, entry) {
		return await cr.query(articlesQuery, {
			category: entry.category
		});
	}

	// or
	/** @type {import('crelte').LoadData} */
	export const loadData = (cr, entry) => cr.query(articlesQuery, {
		category: entry.category
	});

	// or if you're in the context of an object
	/** @type {import('crelte').LoadData} */
	export const loadData = {
		articles: (cr, entry) => cr.query(articlesQuery, {
			category: entry.category
		})
	}
</script>
```

### Array

You can also return an array of loadData types. These will be executed
in parallel and their results will be combined.

```svelte
<script module>
	import blogsQuery from '@/queries/blogs.graphql';
	import { loadData as headerLoadData } from '@/layout/header.svelte';

	/** @type {import('crelte').LoadData} */
	export const loadData = [
		blogsQuery,
		{ header: headerLoadData }
	];
</script>

<script>
	let { blogs, header } = $props();
</script>
```

## Input

Each function has access to `CrelteRequest` as well as the `entry` object except in `loadGlobalData` where `entry` is not yet loaded.

## Output

A load data should either return an object or nothing since it will be spread into the component.

## When to use a loadData

If you need to load data which cannot be loaded in `global.graphql` or `entry.graphql`, it is always favorable to use already existing queries, to avoid multiple request.

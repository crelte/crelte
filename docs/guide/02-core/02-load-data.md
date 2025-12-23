# Load data

Before a template can be rendered, it needs data.  
In Crelte, data is loaded in a structured way based on the current route and entry.

Two GraphQL queries are loaded automatically for every request:

- `global.graphql` — global, cross-page data
- `entry.graphql` — data for the currently resolved entry

Additional data can be loaded by exporting `loadGlobalData` or `loadData` from your components.

## Data loading lifecycle

Data loading happens in the following order:

1. **Global data**  
   `global.graphql` is loaded first, together with `entry.graphql`.  
   This data is available to all templates.

2. **Template data**  
   After the entry has been resolved, the active template’s `loadData` is executed.

All load functions run on both the server and the client, allowing pages to be server-rendered and hydrated on navigation.

---

## loadGlobalData

`loadGlobalData` is used to load data that does not depend on the current entry.  
It is defined in `App.svelte` and runs before any template-specific data loading.

Exporting `loadGlobalData` overrides the default `global.graphql` query.

```svelte
<script module>
	/** @type {import('crelte').LoadData} */
	export const loadGlobalData = {
		someApi: () =>
			fetch('https://api.example.com')
				.then(res => res.json())
	};
</script>

<script>
	import { getGlobal } from 'crelte';

	const someApi = getGlobal('someApi');
</script>
````

Use `loadGlobalData` for data such as navigation, site-wide configuration, or external APIs that are independent of the current entry.

---

## loadData

Each template can export a `loadData` definition.
It is executed after the entry has been resolved and receives access to both the current entry and the Crelte request context.

```svelte
<script module>
	import blogsQuery from '@/queries/blogs.graphql';

	/** @type {import('crelte').LoadData} */
	export const loadData = (cr, entry) =>
		cr.query(blogsQuery, {
			categories: entry.categories
		});
</script>

<script>
	let { entries } = $props();
</script>
```

---

## Defining loadData

`loadData` can be defined in several different ways depending on your needs.
All variants are executed in parallel and their results are merged into the component’s props.

### Object

This is the most common form. Each property defines a separate data source.

```svelte
<script module>
	import entriesQuery from '@/queries/entries.graphql';
	import { headerLoadData } from '@/layout/Header.svelte';

	/** @type {import('crelte').LoadData} */
	export const loadData = {
		entries: entriesQuery,
		header: headerLoadData
	};
</script>

<script>
	let { entries, header } = $props();
</script>
```

---

### GraphQL query

You can export a GraphQL query directly.
All named queries inside the file become available as props.

```svelte
<script module>
	import blogsQuery from '@/queries/blogs.graphql';

	/** @type {import('crelte').LoadData} */
	export const loadData = blogsQuery;
</script>

<script>
	let { blogs } = $props();
</script>
```

---

### Function

Using a function provides the most flexibility and full access to the request context.

```svelte
<script module>
	import articlesQuery from '@/queries/articles.graphql';

	/** @type {import('crelte').LoadDataFn} */
	export const loadData = (cr, entry) =>
		cr.query(articlesQuery, {
			category: entry.category
		});
</script>
```

Functions can also be used inside an object definition.

---

### Array

Multiple load definitions can be combined using an array.
All entries are executed in parallel and merged.

```svelte
<script module>
	import blogsQuery from '@/queries/blogs.graphql';
	import { headerLoadData } from '@/layout/Header.svelte';

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

---

## Input

* `loadData` functions receive a `CrelteRequest` instance and the resolved `entry`.
* `loadGlobalData` receives only the `CrelteRequest`, as the entry is not yet available.

## Output

A load function should return an object (or nothing).
The returned data is merged into the component’s props.

## When to use loadData

Use `loadData` when data cannot be loaded via `global.graphql` or `entry.graphql`.

Prefer extending existing GraphQL queries where possible to avoid unnecessary additional requests.

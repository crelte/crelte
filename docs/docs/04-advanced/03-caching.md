# Caching

Crelte comes with the option to heavely cache GraphQL queries to speed up
response times and reduce the load on Craft.

## Enable caching

Caching can be enabled by adding `CACHING = true` to `/craft/.env`.

Caching is not granular so everytime something gets saved in Craft the whole cache
is cleared.

:::warning Important caveat regarding post/expiry date
Automatic activation of entries based on their post date and expiry date currently requires an additional setup step:

Add `->staticStatuses(true)` to `/craft/config/general.php` so Craft triggers a save event whenever an entry’s publication status changes.

To process these status changes, add a cron job that runs `php craft update-statuses`.
:::

## What is cached

By default, only GraphQL queries that use `siteId` as their sole argument are cached. The only exception is `entry.graphql`, which is also cached.

To enable caching for more complex queries you need to specify in which case it is safe to cache.
Be really careful what you cache – caching everything can lead to fully filled hard drive and possibly a **DOS**.

To configure caching for a specific query, for example `articles.graphql`, you need to add an adjacent file `articles.ts`.

### Example

`articles.graphql`

```graphql
query ($category: [QueryArgument], $siteId: [QueryArgument]) {
	categories: articlesCategoriesEntries(id: $category) {
		... on articlesCategories_default_Entry {
			id
		}
	}
	articles: entries(section: "news", siteId: $siteId) {
		... on article_Entry {
			url
			title
			categories {
				title
			}
		}
	}
}
```

`articles.ts`

```ts
import { Caching, vars } from 'crelte/queries';

export const variables = {
	category: vars.ids(),
	siteId: vars.siteId(),
};

export const caching: Caching<typeof variables> = (res, vars) => {
	// if categories are equal its safe to cache
	return varsIdsEqual(vars.category, res?.categories);
};
```

### `variables`

We first have to declare what variables our query uses and define their types ([`vars`](/types/queries/variables/vars.html)).

[`vars.ids`](/types/queries/variables/vars.html#ids) will always return an array of at least one number,
each number will always be positive. They are sorted in ascending order and duplicates are removed.

[`vars.siteId`](/types/queries/variables/vars.html#siteid) is a special variable which already checks if the id belongs
to a valid site, so it is always safe to cache.

### `caching`

With the caching function or boolean we can define if the result is safe to be cached.
`res` contains the result of the query and `vars` the variables which were used to execute the query and
where defined in the `variables` export.

In the [above example](/docs/04-advanced/03-caching.md#example) we check that each category requested also exists in craft and only then cache it.

### `transform`

`transform` is another function you can export. It allows you to modify the result before it gets returned.
It can be useful to do some data manipulation instead of doing them in the `loadData` function or inside
a Svelte component. This will only be executed on the server and will be cached.

**Example**

```ts
export const transform: Transform<typeof variables> = (res, vars) => {
	for (const entry of res.entries) {
		entry.title = entry.title.toUpperCase();
	}
};
```

## Debugging

To make it easier to check if caching is working as expected you can add a line to `server.js`:

```js
export const debugCaching = true;
```

This will start to log each query execution and whether it has been cached or not.

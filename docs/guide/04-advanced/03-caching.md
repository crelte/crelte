# Caching

Crelte comes with the option to heavely cache graphql queries to speed up
response times and reduce the load on Craft.

## Enable caching

Caching can be enabled by adding `CACHING = true` to the env.

Caching is not granular so everytime something gets saved in Craft, the whole cache
is cleared.
But what doesn't work now is the post date or expiry date. To fix that
you need to add `->staticStatuses(true)` to `craft/config/general.php` this will trigger
the craft save event when the publication status changes.
Now to drive the status changes you need to add a cronjob which calls `php craft update-statuses`.

## What is cached

By default all GraphQL queries are cache which only have `siteId` as an argument.
The exception is `entry.graphq` which also gets cached.

To enable caching for more complex queries you need to specify in which case it is safe to cache
caching everything can lead to fully filled hard drive and possibly a **DOS**.
So be really careful what you cache.

To configure caching for a specific query, for example `articles.graphql` you need to add an adjacent file `articles.ts`.

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
	siteId: vars.siteId()
};

export const caching: Caching<typeof variables> = (res, vars) => {
	// if categories are equal its safe to cache
	return varsIdsEqual(vars.category, res?.categories);
};
```

### variables
First we declare what variables our query uses and define their types [vars](/types/queries/variables/vars.html).

[vars.ids](/types/queries/variables/vars.html#ids) the ids function will always return an array of at least one number,
each number will always be positive. They are sorted in ascending order and duplicates are removed.

[vars.siteId](/types/queries/variables/vars.html#siteid) is a special variable which already checks if the id belongs
to a valid site, so it is always safe to cache.

### caching
With the caching function or boolean we can define if the result is safe to be cached.
`res` contains the result of the query and `vars` the variables which were used to execute the query and
where defined in the `variables` export.

In this example we check that each category requested also exists in craft and only then cache it.

## Debugging

To make it easier to check if caching is working as expected you can add a line to `server.js`:
```js
export const debugCaching = true;
```
This will start to log each query execution and if it was cached or not.

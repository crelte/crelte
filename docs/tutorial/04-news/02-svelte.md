# Svelte news

To have the news page working we should add it to the `entry.graphql` file.
```graphql{12-15}
query ($uri: [String], $siteId: [QueryArgument]) {
  entry(uri: $uri, siteId: $siteId) {
    ...
    # those field should be available for a generic page
    ... on page_Entry {
      title
      content {
        ...Text
        ...Images
      }
    }
    ... on news_Entry {
      url
      title
    }
  }
}
```

At the moment if you open the news page. You should get the following error in the console `Template not found: <pages-news>`.

To fix that let's create a new file `svelte/src/templates/pages-news.svelte` with the following content:
```svelte
<script module>
	import articlesQuery from '@/queries/articles.graphql';

	// this will execute the query
	/** @type {import('crelte').LoadData} */
	export const loadData = articlesQuery;
</script>

<script>
	let { entry, articles } = $props();
</script>

<h1>{entry.title}</h1>

<div class="articles">
	{#each articles as article}
		<article>
			<h2>{article.title}</h2>

			<div class="categories">
				{#each article.categories as category}
					<span>{category.title}</span>
				{/each}
			</div>

			<a href={article.url}>Read</a>
		</article>
	{/each}
</div>

<style lang="scss">
	article {
		margin-bottom: 1rem;
	}

	.categories {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
</style>

```

## Articles query

This file references the articles.graphql query which we need to create now.

Create a new file `svelte/src/queries/articles.graphql` with the following content:
```graphql
query ($siteId: [QueryArgument]) {
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

This query will fetch all articles in the news section and return them in the articles variable.

## Filter

At this stage you should see a list of news articles.

To add a filter we need to modify the `articles.graphql` and the loadData.

```graphql{1-2,11-16}
query ($categories: [QueryArgument], $siteId: [QueryArgument]) {
  articles: entries(section: "news", categories: $categories, siteId: $siteId) {
    ... on article_Entry {
      url
      title
      categories {
        title
      }
    }
  }
  categories: entries(section: "categories", siteId: $siteId) {
    ... on category_Entry {
      url
      title
    }
  }
}
```

We also add another query `categories`, so we can list them in the filter.

The new `pages-news.svelte` looks like this:
```svelte {4-10,19-24}
<script module>
	import articlesQuery from '@/queries/articles.graphql';

	// this will execute the query
	/** @type {import('crelte').LoadData} */
	export const loadData = cr =>
		cr.query(articlesQuery, {
			// get category from the url and pass it to the grapqhl
			categories: cr.req.getSearchParam('category'),
		});
</script>

<script>
	let { entry, articles, categories } = $props();
</script>

<h1>{entry.title}</h1>

<div class="categories">
	<a href={entry.url}>All categories</a>
	{#each categories as category}
		<a href={category.url}>{category.title}</a>
	{/each}
</div>

<div class="articles">
	{#each articles as article}
		<article>
			<h2>{article.title}</h2>

			<div class="categories">
				{#each article.categories as category}
					<span>{category.title}</span>
				{/each}
			</div>

			<a href={article.url}>Read</a>
		</article>
	{/each}
</div>

<style lang="scss">
	article {
		margin-bottom: 1rem;
	}

	.categories {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
</style>
```

If you now click on a filter you should see that it already works.

One issue we still have is that on each click it will reset the scroll to the top.

To fix this we will need to prevent scrolling.

The easiest way is to add an event listener and set disableScroll which will not scroll to the top when the new page is loaded.
```svelte{1-5,9-19,24-29}
<script>
	import { getRouter } from 'crelte';
	import { shouldInterceptClick } from 'crelte/routing';

	const router = getRouter();

	let { entry, articles, categories } = $props();

	function onCategoryClick(e) {
		// prevent ctrl + click or middle click from being intercepted
		if (!shouldInterceptClick(e, e.currentTarget)) return;

		e.preventDefault();
		e.stopPropagation();

		router.open(e.target.href, {
			disableScroll: true,
		});
	}
</script>

<h1>{entry.title}</h1>

<div class="categories">
	<a href={entry.url} onclick={onCategoryClick}>All categories</a>
	{#each categories as category}
		<a href={category.url} onclick={onCategoryClick}>{category.title}</a>
	{/each}
</div>
```

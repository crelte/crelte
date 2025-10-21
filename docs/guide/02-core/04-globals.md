# Globals

Globals allow you to easely access global data without needing to import
or load them in every component.

The globals are automatically loaded from the `globals.graphql` file.

## Access

You can access the globals in two ways:
- In `loadData` use can use the `getGlobal` method which returns the object.
- In a component you can use the `getGlobal` method which will return a store.

## Example

### src/queries/global.graphql
```graphql
query ($siteId: [QueryArgument]) {
  header: globalSet(handle: "header", siteId: $siteId) {
    ... on header_GlobalSet {
      navigation {
        ... on navItem_Entry {
          link: linkExt {
            url
            target
            label
            defaultLabel
          }
        }
      }
    }
  }
}
```

### src/components/Header.svelte
```svelte
<script module>
	/** @type {import('crelte').LoadData} */
	export const loadData = {
		hasItems: cr => cr.getGlobal('header').navigation.length > 0
	};
</script>

<script>
	import { getGlobal } from 'crelte';

	// here the global is a store because the site might change
	const header = getGlobal('header');

	let { hasItems } = $props();
</script>

{#if !hasItems}
	<p>No Navigation</p>
{/if}

{#each $header.navigation.filter(n => !!item.link?.url) as item}
	<a href={item.link.url} target={item.link.target}>
		{item.link.label ?? item.link.defaultLabel}
	</a>
{/each}
```

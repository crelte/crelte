# Svelte Content Matrix

## entry.graphql

The content matrix is now ready. Lets add queries for its data into `entry.graphql`.

To share code we will use fragments so for each entry type that includes the content matrix
we dont have to repeat the same code.
```graphql{1-15,26-29,34-37}
fragment Text on text_Entry {
  typeHandle
  richtext
}

fragment Images on images_Entry {
  typeHandle
  images {
    title
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
    # those field should be available for home
    ... on home_Entry {
      title
      content {
        ...Text
        ...Images
      }
    }
    # those field should be available for a generic page
    ... on page_Entry {
      title
      content {
        ...Text
        ...Images
      }
    }
  }
}
```

## Blocks
To use a content matrix in crelte there exists the `Blocks` component.

Create a new file `svelte/src/components/Content.svelte` with the following content:
```svelte
<script module>
	import Blocks, { blockModules, loadBlocksData } from 'crelte/blocks';

	// this will import all svelte files from the content folder
	const mods = blockModules(import.meta.glob('./content/*.svelte'));

	// make sure any data the blocks needs gets loaded
	/** @type {import('crelte').LoadData} */
	export const loadData = (cr, blocks) => loadBlocksData(cr, blocks, mods);
</script>

<script>
	let { blocks } = $props();
</script>

<Blocks {blocks} />
```

This file automatically loads all blocks from the `content` folder
and matches them based on the entry type.

## Home and page template
Now use the `Content` component in the `home` and `page` templates.

This is the new `pages-home.svelte` file.
```svelte
<script module>
	import { loadData as loadContentData } from '@/components/Content.svelte';

	/** @type {import('crelte').LoadData} */
	export const loadData = {
		blocks: (cr, entry) => loadContentData(cr, entry.content),
	};
</script>

<script>
	import Content from '@/components/Content.svelte';

	// entry: contains all fields in the entry query for example {id, siteId, title, ...}
	let { entry, blocks } = $props();
</script>

<h1>{entry.title}</h1>

<Content {blocks} />
```

## Text

Now lets implement the text block.

Create a new file `svelte/src/components/content/text.svelte` with the following content:
```svelte
<script>
	// named after the field in the query
	let { richtext } = $props();
</script>

<!-- Render the richtext html -->
<div class="richtext">{@html richtext ?? ''}</div>
```

## Images

Now lets implement the images block.

Create a new file `svelte/src/components/content/images.svelte` with the following content:
```svelte
<script>
	let { images } = $props();
</script>

<div class="images">
	{#each images as image}
		<img
			src={image.small}
			srcset="{image.small} 600w, {image.medium} 1500w"
			sizes="100vw"
			width={image.width}
			height={image.height}
			alt={image.title}
		/>
	{/each}
</div>
```

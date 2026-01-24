# Blocks

Blocks is a convenient component to iterate over and render different types of content.
It is especially useful in combination with Craft's Matrix fields.

## Example

`Content.svelte`
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

To now call this component in a template you can do the following:  
`pages-home.svelte`
```svelte
<script module>
	import Content, { loadData as loadContentData } from '@/components/Content.svelte';
	
	/** @type {import('crelte').LoadData} */
	export const loadData = {
		blocks: (cr, entry) => loadContentData(cr, entry.content),
	};
</script>

<script>
	// entry: contains all fields in the entry query for example {id, siteId, title, ...}
	let { entry, blocks } = $props();
</script>

<Content {blocks} />
```

### blockModules [docs](/types/blocks/functions/blockModules.html)

This function prepares the modules to be used in the `loadBlocksData` function.
You can additionaly specify if the there should be an alias for a specific block type.

### loadBlocksData [docs](/types/blocks/functions/loadBlocksData.html)

This function will call all `loadData` for each block which inside the `blocks` variable.

### Block

Each block component will receive the block data and the loadedData as its properties.
Instead of receiving the entry as the second argument inside a `loadData` function the blocks
data is passed.

`articles.svelte`
```svelte
<script module>
	import articlesQuery from '@/queries/articles.graphql';

	// this will execute the query
	/** @type {import('crelte').LoadData} */
	export const loadData = articlesQuery;
</script>

<script>
	let { title, articles } = $props();
</script>
```

So if the blocks variables contains:
```json
[
	{
		"typeHandle": "articles",
		"title": "Latest Articles"
	}
]
```

The `articles` block will receive the `title` property and the loaded `articles` data
from the query.


#### Sibling data
If you need to access data from a sibling blocks you can use the `getSibling` function.
Note this will not work with data that the sibling will load itself via `loadData` since
all blocks are loaded in parallel.

```svelte
<script module>
	/** @type {import('crelte').LoadData} */
	export const loadData = {
		previousIsText: (cr, block, opts) =>
			opts.getSibling(-1)?.typeHandle === 'text'
	};
</script>

<script>
	let { previousIsText } = $props();
</script>
```

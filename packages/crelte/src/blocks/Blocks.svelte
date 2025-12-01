<script lang="ts">
	import { BlocksInstance } from './index.js';

	/*
	usage:

	const mods = blockModules(import.meta.glob('./contentDetail/*.svelte'));

	export const loadData = {
		blocks: (cr, entry) => loadBlocksData(cr, entry.blocks, mods)
	};

	export let blocks;

	// provide entry if wanted, all $$restProps will be passed to the children
	<Blocks {blocks} {entry} />

	*/

	export let blocks: BlocksInstance;
</script>

{#each blocks.each() as { mod, props }}
	<svelte:component this={mod} {...props} {...$$restProps} />
{/each}

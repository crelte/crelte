<script lang="ts">
	import { type BlocksInstance } from './index.js';

	export let blocks: BlocksInstance;
</script>

{#each blocks.each() as { mod, props }}
	<svelte:component this={mod} {...props} {...$$restProps} />
{/each}

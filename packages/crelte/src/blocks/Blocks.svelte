<script lang="ts">
	import { type BlocksInstance } from './index.js';

	// eslint-disable-next-line svelte/valid-compile
	let { blocks, ...rest }: { blocks: BlocksInstance } = $props();
</script>

{#each blocks.each() as { mod: Mod, props }}
	<Mod {...props} {...rest} />
{/each}

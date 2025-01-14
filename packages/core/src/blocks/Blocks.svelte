<script context="module" lang="ts">
	import CrelteRequest from '../CrelteRequest.js';
	/*
	usage:

	const mods = import.meta.glob('./contentDetail/*.svelte', {
		// can either be eager loaded or not
		eager: true,
	});

	const mods = blockModules(
		import.meta.glob('./contentDetail/*.svelte', { eager: true }),
		{
			alias: {
				'contentDetail': 'contentDetail',
			}
		}
	);

	export const loadData = {
		blocks: (cr, entry) => loadBlocksData(cr, entry.blocks, mods)
	};

	export let blocks;

	// provide entry if wanted, all $$restProps will be passed to the children
	<Blocks {blocks} {entry} />

	*/

	import Blocks, {
		type AsyncModule,
		type Module,
		type BlockModulesOptions,
		BlockModules,
		newBlocks,
	} from './Blocks.js';

	export type { BlockModules, BlockModulesOptions, AsyncModule, Module };

	export function blockModules(
		modules: Record<string, AsyncModule>,
		opts: BlockModulesOptions = {},
	): BlockModules {
		return new BlockModules(modules, opts);
	}

	export async function loadBlocksData(
		cr: CrelteRequest,
		blocks: any[],
		modules: BlockModules,
	): Promise<Blocks> {
		const nBlocks = await newBlocks(blocks, modules);

		await nBlocks.loadData(cr);

		return nBlocks;
	}
</script>

<script lang="ts">
	export let blocks: Blocks;
</script>

{#each blocks.each() as { mod, props }}
	<svelte:component this={mod} {...props} {...$$restProps} />
{/each}

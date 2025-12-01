import Blocks from './Blocks.svelte';
import type {
	BlockModules,
	BlockModulesOptions,
	AsyncModule,
	Module,
	BlockOptions,
} from './Blocks.js';
import type BlocksInstance from './Blocks.js';
import { newBlocks, blockModules, loadBlocksData } from './Blocks.js';

export type {
	BlocksInstance,
	BlockModules,
	BlockModulesOptions,
	AsyncModule,
	Module,
	BlockOptions,
};

export { newBlocks, Blocks, blockModules, loadBlocksData };

export default Blocks;

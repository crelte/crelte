// import fs from 'node:fs';
// import path from 'node:path';
// import * as p from '@clack/prompts';
import { program } from 'commander';
import create from './create.js';

program.name('crelte-cli').version('0.1.0');

program
	.command('create')
	.description('Create a new Crelte Project')
	.argument('[cwd]', 'The directory to create the project in')
	.action(cwd => create(cwd));

program.parse();

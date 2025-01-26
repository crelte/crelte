#!/usr/bin/env node

import { program } from 'commander';
import create from './create.js';

program.name('crelte-cli').version('0.1.1');

program
	.command('create')
	.description('Create a new Crelte Project')
	.argument('[cwd]', 'The directory to create the project in')
	.option(
		'--template <string>',
		'the template to use: default, or a url to clone',
	)
	.action((cwd, a, b) => create(cwd, a, b));

program.parse();

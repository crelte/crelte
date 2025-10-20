import path from 'node:path';
import { Command } from 'commander';
import {
	spawn,
	exit,
	exitEarly,
	mergeCopy,
	mkdir,
	readFile,
	rmFile,
	copyFile,
	rmDir,
	appendFile,
} from './utils.js';
import {
	group,
	intro,
	isCancel,
	log,
	note,
	outro,
	password,
	text,
} from '@clack/prompts';
import color from 'picocolors';

type Options = {
	template?: string;
};

const PRIMARY_SITE_URL_REGEX = /PRIMARY_SITE_URL=\s*"?(.*?)"?\s*$/m;

const j = path.join;

export default async function create(
	wd: string | undefined,
	opts: Options,
	_cmd: Command,
) {
	intro('Creating a new Crelte project');

	// resolve the tempalte to something we can use in git clone
	const template = templatePath(opts.template);

	// get the working directory
	if (!wd) {
		const nWd = await text({
			message: 'Where should we create your project?',
			placeholder: '  (hit Enter to use the current directory)',
		});

		if (isCancel(nWd)) exitEarly();

		wd = nWd as string;
	}

	// get all information needed to install craft
	const craftOptions = await craftInstallOptions();

	// clone the template
	await spawn('git', ['clone', template, wd]);

	wd = path.resolve(wd);
	const projectName = path.basename(wd);
	const craftDir = j(wd, 'craft');
	const craftTempDir = j(wd, 'craft-template');
	const svelteDir = j(wd, 'svelte');

	// setup a new git repo
	await rmDir(j(wd, '.git'));
	await spawn('git', ['init'], { cwd: wd });

	// start to setup craft
	await mkdir(craftDir);
	await spawn(
		'ddev',
		[
			'config',
			'--project-type=craftcms',
			'--docroot=web',
			'--project-name',
			projectName,
		],
		{ cwd: craftDir },
	);
	await spawn(
		'ddev',
		[
			'composer',
			'create',
			'-y',
			'--no-scripts',
			'--no-install',
			'craftcms/craft: ^5',
		],
		{ cwd: craftDir },
	);
	await spawn('ddev', ['composer', 'install'], { cwd: craftDir });

	// since we don't run the after setup step from craft we do that step manually
	await rmFile(j(craftDir, 'composer.json'));
	await copyFile(
		j(craftDir, 'composer.json.default'),
		j(craftDir, 'composer.json'),
	);
	rmFile(j(craftDir, 'composer.json.default'));

	// how should the site environment variable be called, for exampe EN_US_SITE_URL
	const siteEnvName =
		craftOptions.language.toUpperCase().replace('-', '_') + '_SITE_URL';

	const prevEnv = await readFile(j(craftDir, '.env'));
	const prevPrimaryUrlMatch = prevEnv.match(PRIMARY_SITE_URL_REGEX);
	if (!prevPrimaryUrlMatch) {
		exit('Could not find PRIMARY_SITE_URL in .env', 1);
	}

	const prevPrimaryUrl = new URL(prevPrimaryUrlMatch![1]);
	const endpointUrl = new URL(prevPrimaryUrl.href);
	// we never wan't the endpoint url to be https in dev because
	// that fails in node
	endpointUrl.protocol = 'http';
	endpointUrl.pathname = 'api';

	// copy files from the template
	await rmFile(j(craftDir, '.env'));
	await mergeCopy(craftTempDir, craftDir);
	await rmDir(craftTempDir);

	// create .env file
	await appendFile(
		j(craftDir, '.env.example.dev'),
		`ENDPOINT_URL=${endpointUrl.href}
CRAFT_WEB_URL=${prevPrimaryUrl.href}
${siteEnvName}=http://localhost:8080/
`,
	);
	await copyFile(j(craftDir, '.env.example.dev'), j(craftDir, '.env'));

	// add placeholders env files for staging and production
	for (const file of ['.env.example.staging', '.env.example.production']) {
		await appendFile(
			j(craftDir, file),
			`ENDPOINT_URL=
CRAFT_WEB_URL=
${siteEnvName}=
`,
		);
	}

	// remove unused twig since rendering will happen in svelte
	await rmFile(j(craftDir, 'templates/index.twig'));

	// finally we are ready to install craft
	await spawn(
		'ddev',
		[
			'craft',
			'install/craft',
			'--interactive=0',
			'--email',
			craftOptions.email,
			'--username',
			craftOptions.username,
			'--password',
			craftOptions.password,
			'--language',
			craftOptions.language,
			'--site-name',
			craftOptions.siteName,
			'--site-url',
			'$' + siteEnvName,
		],
		{ cwd: craftDir },
	);

	// install the crelte plugin
	await spawn('ddev', ['composer', 'require', 'crelte/craft-crelte'], {
		cwd: craftDir,
	});
	await spawn(
		'ddev',
		['craft', 'plugin/install', 'craft-crelte', '--interactive=0'],
		{
			cwd: craftDir,
		},
	);

	// enable graphql
	await enableGraphQl(craftDir);

	await spawn('npm', ['install'], { cwd: svelteDir });

	const relativeSvelte = path.relative(process.cwd(), svelteDir);

	note(
		`To start your project, run the following command:
  \`cd ${relativeSvelte} && npm run dev\`

You're login credentials are:
  ${color.bold('Username')}: ${craftOptions.username}
  ${color.bold('Password')}: ${craftOptions.password}`,
	);

	outro("You're all set up! 🎉");
}

// this is just a simple test, the real check will be when calling git clone
const SSH_REGEX = /^\w+@[^:]+:.+$/;
const VALID_TEMPLATES = ['default'];

// get the path to the template
// can be a local path, which starts with a dot
// can be an url or an ssh url
// or can be default
function templatePath(template: string | undefined): string {
	if (!template) template = 'default';

	if (template.startsWith('.') || template.startsWith('/')) {
		log.info(
			'You are using a local path\nBe aware that only commited changes will be copied',
		);
		return template;
	}

	if (template.startsWith('http') || SSH_REGEX.test(template)) {
		return template;
	}

	if (VALID_TEMPLATES.includes(template)) {
		return `https://github.com/crelte/crelte-template-${template}.git`;
	}

	throw exit('Invalid template ' + template, 1);
}

type CraftInstallOptions = {
	email: string;
	username: string;
	password: string;
	siteName: string;
	language: string;
};

async function craftInstallOptions(): Promise<CraftInstallOptions> {
	log.info('Please provide the following information to install Craft CMS');

	return await group(
		{
			email: () =>
				text({
					message: 'Email',
					// only a minimal check for basic validity
					validate: value =>
						!value.includes('@') ? 'Invalid email' : undefined,
				}),
			username: () => text({ message: 'Username' }),
			password: () =>
				password({
					message: 'Password',
					validate: value =>
						value.length < 6
							? 'Password too short (min. 6 characters)'
							: undefined,
				}),
			siteName: () => text({ message: 'Site Name' }),
			language: () =>
				text({
					message: 'Language',
					placeholder: 'for example: en-US or de-CH',
				}),
		},
		{
			onCancel: () => exitEarly(),
		},
	);
}

// this is a bit complicated
// because in the start the schema does not already exists
// so we start to modify the project config
//
// todo: maybe this could be done better
async function enableGraphQl(craftDir: string) {
	await spawn(
		'ddev',
		[
			'craft',
			'pc/set',
			'graphql',
			'publicToken:\n    enabled: true\n    expiryDate: null',
		],
		{ cwd: craftDir },
	);

	// now let craft generate the schema
	// without this craft will return no schemas in list-schemas
	await spawn(
		'ddev',
		['craft', 'exec', 'return \\Craft::$app->gql->getPublicToken();'],
		{ cwd: craftDir },
	);

	// eslint-disable-next-line no-useless-escape
	const SCHEMA_REGEX = /- ([0-9a-z\-]+)/;
	const schemaMatch = (
		await spawn('ddev', ['craft', 'graphql/list-schemas'], {
			cwd: craftDir,
		})
	).stdout.match(SCHEMA_REGEX);
	if (!schemaMatch || !schemaMatch.length)
		throw exit('Could not find schema', 1);

	// eslint-disable-next-line no-useless-escape
	const SITE_REGEX = /\s*([0-9a-z\-]+):/;
	const siteUuid = (
		await spawn('ddev', ['craft', 'pc/get', 'sites'], {
			cwd: craftDir,
		})
	).stdout.match(SITE_REGEX);
	if (!siteUuid || !siteUuid.length) throw exit('Could not find site', 1);

	await spawn(
		'ddev',
		[
			'craft',
			'pc/set',
			`graphql.schemas.${schemaMatch[1]}`,
			`{ isPublic: true, name: 'Public Schema', scope: ['sites.${siteUuid[1]}:read', 'crelte.all:read'] }`,
		],
		{ cwd: craftDir },
	);
}

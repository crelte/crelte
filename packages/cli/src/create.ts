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
	writeFile,
	isFile,
	spawnInline,
} from './utils.js';
import { intro, isCancel, log, note, outro, text } from '@clack/prompts';
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
			defaultValue: '.',
		});

		if (isCancel(nWd)) exitEarly();

		wd = nWd as string;
	}

	// clone the template
	await spawn('git', ['clone', template, wd]);

	wd = path.resolve(wd);
	const projectName = path.basename(wd);
	const craftDir = j(wd, 'craft');
	const craftTempDir = j(wd, 'craft-template');
	const ddevTempDir = j(wd, 'ddev-template');

	// setup a new git repo
	await rmDir(j(wd, '.git'));
	await spawn('git', ['init'], { cwd: wd });

	// start to setup craft
	await mkdir(j(craftDir, 'web'));
	await spawn(
		'ddev',
		[
			'config',
			'--project-type=craftcms',
			'--docroot=craft/web',
			'--composer-root=craft',
			'--nodejs-version=24',
			'--additional-hostnames',
			'admin.' + projectName,
			'--web-environment-add',
			'CRAFT_CMD_ROOT=/var/www/html/craft',
			'--project-name',
			projectName,
		],
		{ cwd: wd },
	);

	// add collation to .env.web
	await appendFile(
		j(wd, '.ddev/.env.web'),
		`CRAFT_DB_CHARSET="utf8mb4"
CRAFT_DB_COLLATION="utf8mb4_unicode_ci"
`,
	);

	await spawnInline(
		'ddev',
		['composer', 'create-project', 'craftcms/craft'],
		{ cwd: wd },
	);

	const ddevEnvPath = j(wd, '.ddev/.env.web');
	if (!(await isFile(ddevEnvPath))) {
		exit(
			'Could not find .ddev/.env.web file, maybe your ddev version is too old.',
			1,
		);
	}
	const ddevEnv = await readFile(ddevEnvPath);
	const primaryUrlMatch = ddevEnv.match(PRIMARY_SITE_URL_REGEX);
	if (!primaryUrlMatch) {
		exit('Could not find PRIMARY_SITE_URL in .env', 1);
	}

	// the primary ddev url (https://<project>.ddev.site) serves the
	// svelte dev server, craft is served on the admin subdomain
	const frontendUrl = new URL(primaryUrlMatch![1]);
	const adminUrl = new URL(frontendUrl.href);
	adminUrl.hostname = 'admin.' + adminUrl.hostname;
	const endpointUrl = new URL(adminUrl.href);
	endpointUrl.pathname = 'api';

	// copy files from the template
	await mergeCopy(craftTempDir, craftDir);
	await rmDir(craftTempDir);

	await mergeCopy(ddevTempDir, j(wd, '.ddev'));
	await rmDir(ddevTempDir);
	for (const file of ['svelte-site.conf', 'admin-site.conf']) {
		const confPath = j(wd, '.ddev/nginx_full', file);
		const conf = await readFile(confPath);
		await writeFile(
			confPath,
			conf.replaceAll('CRELTE_PROJECT_HOST', frontendUrl.hostname),
		);
	}

	// create .env file
	await appendFile(
		j(craftDir, '.env'),
		`ENDPOINT_URL=${endpointUrl.href}
ENDPOINT_TOKEN=
CRAFT_WEB_URL=${adminUrl.href}
CRAFT_BASE_CP_URL=${adminUrl.href}
FRONTEND_URL=${frontendUrl.href}
`,
	);
	await copyFile(j(craftDir, '.env'), j(craftDir, '.env.example.dev'));

	// add placeholders env files for staging and production
	for (const file of ['.env.example.staging', '.env.example.production']) {
		await appendFile(
			j(craftDir, file),
			`ENDPOINT_URL=
ENDPOINT_TOKEN=
CRAFT_WEB_URL=
CRAFT_BASE_CP_URL=
FRONTEND_URL=
`,
		);
	}

	// restart so nginx picks up the new vhosts and the new command
	await spawn('ddev', ['restart'], { cwd: wd });

	// remove unused twig since rendering will happen in svelte
	await rmFile(j(craftDir, 'templates/index.twig'));

	// make sure to commit an empty templates folder
	await writeFile(j(craftDir, 'templates/.gitkeep'), '');

	// install the crelte plugin
	await spawn('ddev', ['composer', 'require', 'crelte/craft-crelte'], {
		cwd: wd,
	});
	await spawn(
		'ddev',
		['craft', 'plugin/install', 'craft-crelte', '--interactive=0'],
		{
			cwd: wd,
		},
	);

	// enable graphql
	const endpointToken = await enableGraphQl(wd);

	// write the endpoint token to the env file
	const envFile = await readFile(j(craftDir, '.env'));
	await writeFile(
		j(craftDir, '.env'),
		envFile.replace('ENDPOINT_TOKEN=', `ENDPOINT_TOKEN=${endpointToken}`),
	);

	await copyFile(j(craftDir, '.env'), j(craftDir, '.env.example.dev'));

	// install the npm dependencies inside the web container
	await spawn('ddev', ['npm', 'install'], { cwd: wd });

	const relativeWd = path.relative(process.cwd(), wd) || '.';

	note(
		`To start your project, run the following command:
  \`cd ${relativeWd} && ddev npm run dev\`

Your project will be available at:
  ${color.bold('Frontend')}: ${frontendUrl.href}
  ${color.bold('Craft CP')}: ${adminUrl.href}admin`,
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

// this is a bit complicated
// because in the start the schema does not already exists
// so we start to modify the project config
//
// todo: maybe this could be done better
async function enableGraphQl(wd: string): Promise<string> {
	// eslint-disable-next-line no-useless-escape
	const SITE_REGEX = /\s*([0-9a-z\-]+):/;
	const siteUuid = (
		await spawn('ddev', ['craft', 'pc/get', 'sites'], {
			cwd: wd,
		})
	).stdout.match(SITE_REGEX);
	if (!siteUuid || !siteUuid.length) throw exit('Could not find site', 1);

	// let's create a schema
	await spawn(
		'ddev',
		[
			'craft',
			'exec',
			'\\Craft::$app->gql->saveSchema(new \\craft\\models\\GqlSchema([' +
				'"name"=>"Endpoint",' +
				`"scope"=>['sites.${siteUuid[1]}:read','crelte.all:read']` +
				']));',
		],
		{ cwd: wd },
	);

	// eslint-disable-next-line no-useless-escape
	const SCHEMA_REGEX = /- ([0-9a-z\-]+)/;
	const schemaMatch = (
		await spawn('ddev', ['craft', 'graphql/list-schemas'], {
			cwd: wd,
		})
	).stdout.match(SCHEMA_REGEX);
	if (!schemaMatch || !schemaMatch.length)
		throw exit('Could not find schema', 1);

	// eslint-disable-next-line no-useless-escape
	const TOKEN_REGEX = /: ([0-9a-zA-Z\-\_]+)/;
	const tokenMatch = (
		await spawn(
			'ddev',
			[
				'craft',
				'graphql/create-token',
				schemaMatch[1],
				'--name',
				'Endpoint',
				'--interactive=0',
			],
			{ cwd: wd },
		)
	).stdout.match(TOKEN_REGEX);
	if (!tokenMatch || !tokenMatch.length)
		throw exit('Could not create token', 1);

	return tokenMatch[1] as string;
}

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
			defaultValue: '.',
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
	const ddevTempDir = j(wd, 'ddev-template');

	// setup a new git repo
	await rmDir(j(wd, '.git'));
	await spawn('git', ['init'], { cwd: wd });

	// start to setup craft
	// the ddev project lives at the project root (not in craft/) so the
	// svelte dev server can run inside the web container as well
	await mkdir(j(craftDir, 'web'));
	await spawn(
		'ddev',
		[
			'config',
			'--project-type=craftcms',
			'--docroot=craft/web',
			'--composer-root=craft',
			'--nodejs-version=22',
			'--additional-hostnames',
			'admin.' + projectName,
			'--web-environment-add',
			'CRAFT_CMD_ROOT=/var/www/html/craft',
			'--project-name',
			projectName,
		],
		{ cwd: wd },
	);

	// do manually, what 'ddev composer create-project' seems to do
	// we do it manually because the ddev cli is just stuck and waits
	// forever on some systems
	{
		await spawn('ddev', ['start', projectName], { cwd: wd });
		// we need to work in a temporary directory, because / craft
		// isn't empty and we aren't allowed to create - project in a
		// non - empty directory.
		const craftCreateProjectDir = j(craftDir, 'cc-temp');
		await spawn(
			'ddev',
			[
				'exec',
				'--dir',
				'/var/www/html/craft',
				'composer',
				'create-project',
				'--no-scripts',
				'--no-install',
				'--no-interaction',
				'craftcms/craft',
				'cc-temp',
			],
			{ cwd: wd },
		);

		// Move contents from temp directory to parent
		await mergeCopy(craftCreateProjectDir, craftDir);
		await rmDir(craftCreateProjectDir);

		// run ddev start again to maybe create the necessary .env variables
		await spawn('ddev', ['start', projectName], { cwd: wd });
	}

	await spawn('ddev', ['composer', 'install'], { cwd: wd });

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

	// try to read .env.web file first (only ddev ~1.24+)
	let primaryEnvPath = j(wd, '.ddev/.env.web');
	if (!(await isFile(primaryEnvPath))) {
		// older ddev versions write the env variables to the approot .env
		primaryEnvPath = j(wd, '.env');
	}
	if (!(await isFile(primaryEnvPath))) {
		primaryEnvPath = j(craftDir, '.env');
	}
	const prevEnv = await readFile(primaryEnvPath);
	const prevPrimaryUrlMatch = prevEnv.match(PRIMARY_SITE_URL_REGEX);
	if (!prevPrimaryUrlMatch) {
		exit('Could not find PRIMARY_SITE_URL in .env', 1);
	}

	// the primary ddev url (https://<project>.ddev.site) serves the
	// svelte dev server, craft is served on the admin subdomain
	const frontendUrl = new URL(prevPrimaryUrlMatch![1]);
	const adminUrl = new URL(frontendUrl.href);
	adminUrl.hostname = 'admin.' + adminUrl.hostname;
	// the endpoint can stay https because node runs inside the web
	// container where ddev sets NODE_EXTRA_CA_CERTS to the mkcert root
	const endpointUrl = new URL(adminUrl.href);
	endpointUrl.pathname = 'api';

	// copy files from the template
	await rmFile(j(craftDir, '.env'), { force: true });
	await mergeCopy(craftTempDir, craftDir);
	await rmDir(craftTempDir);

	// copy the ddev template files (nginx vhosts and the sv command)
	// and point them to the correct hostnames
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
		j(craftDir, '.env.example.dev'),
		`ENDPOINT_URL=${endpointUrl.href}
ENDPOINT_TOKEN=
CRAFT_WEB_URL=${adminUrl.href}
CRAFT_BASE_CP_URL=${adminUrl.href}
FRONTEND_URL=${frontendUrl.href}
${siteEnvName}=${frontendUrl.href}
`,
	);
	await copyFile(j(craftDir, '.env.example.dev'), j(craftDir, '.env'));

	// add placeholders env files for staging and production
	for (const file of ['.env.example.staging', '.env.example.production']) {
		await appendFile(
			j(craftDir, file),
			`ENDPOINT_URL=
ENDPOINT_TOKEN=
CRAFT_WEB_URL=
CRAFT_BASE_CP_URL=
FRONTEND_URL=
${siteEnvName}=
`,
		);
	}

	// restart so nginx picks up the new vhosts and the sv command
	// becomes available
	await spawn('ddev', ['restart'], { cwd: wd });

	// remove unused twig since rendering will happen in svelte
	await rmFile(j(craftDir, 'templates/index.twig'));

	// make sure to commit an empty templates folder
	await writeFile(j(craftDir, 'templates/.gitkeep'), '');

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
		{ cwd: wd },
	);

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
	await spawn('ddev', ['sv', 'npm', 'install'], { cwd: wd });

	const relativeWd = path.relative(process.cwd(), wd) || '.';

	note(
		`To start your project, run the following command:
  \`cd ${relativeWd} && ddev sv npm run dev\`

Your project will be available at:
  ${color.bold('Frontend')}: ${frontendUrl.href}
  ${color.bold('Craft CP')}: ${adminUrl.href}admin

Your login credentials are:
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

# Creating a project

## Prerequisites
- You know how to use the terminal [Guide](https://craftcms.com/docs/getting-started-tutorial/environment/terminal.html)
- You have ddev installed [Guide](https://ddev.readthedocs.io/en/stable)
- You have node and npm installed, we recommend using a version manager like [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm)

If the following commands each return a version number you are good to go:

```bash
ddev -v
node -v
npm -v
```

## Create a new project
The simplest way to create a new Crelte project is to run `npx crelte-cli create`:

```bash
npx crelte-cli create my-project
cd my-project/svelte
npm run dev
```

This will create a new project in the `my-project` directory and prompt you with a few questions, such as whether to include TypeScript and TailwindCSS support, the name of your site, and the initial username and password. To explore Crelte, we recommend choosing the blog starter template. This will include a few example pages and a blog section showing some features which make crelte great.

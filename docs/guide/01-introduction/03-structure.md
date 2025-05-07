# Project structure

A typical Crelte project looks like this:

```plaintext
my-project/
├ craft/
│ ├ .ddev/
│ ├ config/
│ ├ storage/
│ ├ templates/
│ ├ web/
│ ├ .env
│ ├ bootstrap.php
│ └ composer.json
├ svelte/
│ ├ public/
│ ├ src/
│ │ ├ queries/
│ │ │ ├ entry.graphql
│ │ │ └ global.graphql
│ │ ├ templates/
│ │ │ └  error-404.svelte
│ │ ├ App.svelte
│ │ ├ client.js
│ │ ├ Error.svelte
│ │ └ server.js
│ ├ build.js
│ ├ index.html
│ ├ package.json
│ ├ server.js
│ └ vite.config.js
└ graphql.config.js
```

You'll also find common files like .gitignore and .prettierrc.

## Project files

This section provides a list of the most important folders and files you will encounter during typical Crelte development.

### craft

The `craft` folder contains a Craft CMS installation. You can find more information about the Craft CMS directory structure in the [Craft CMS documentation](https://craftcms.com/docs/5.x/system/directory-structure.html).

- `.env` is the file where you can configure your environment variables. Like database credentials, site URL, and more.

### svelte

The `svelte` folder contains the frontend code. Most of the time you work in this folder.

- `public` is the folder where static assets go that should be served as-is, like `robots.txt` or `favicon.ico`.
- `build.js` contains instructions on how to build the frontend code for production.
- `index.html` is the entry point for the frontend code.
    - It should contain the attribute `lang="<!--page-lang-->"` on the html tag.
    - In the body the following comment `<!--ssr-body-->` is used to inject the server-side rendered content.
    - You can extend this file with fonts, icons, and other tags which stay the same for all pages.
- `vite.config.js` is the configuration file for the Vite build tool.

#### svelte/src

The `src` folder contains all frontend code. The most important folders and files are:

- `templates` is the folder where each section and entry can contain its own files. Each page that should look different or has a different structure might have its own file here. The naming convention is `<section-handle>-<entry-type>.svelte` or if the section only has one template you can omit the entry type. For example `blog-post.svelte` or `blog.svelte`.
    - `error-404.svelte` is the component that gets rendered when a page is not found and should always exist.
- `queries` is the folder where you can define your GraphQL queries. Each file should contain a single query. Two files always need to exist:
    - `global.graphql` is the query for global data like header information and the navigation.
    - `entry.graphql` is the query for the current entry / page. This needs to be extended each time a new section or a new field on an entry needs to be accessible.
- `App.svelte` is the first Svelte component that get's rendered. It should contain Header and Footer components and other components which exist on all pages.
- `client.js` is the entry point for the client-side code. Here you can configure things like `preloadOnHover`.
- `Error.svelte` is the component that gets rendered when an error occurs or craft is in maintenance mode.
- `server.js` is the entry point for the server-side rendering code.

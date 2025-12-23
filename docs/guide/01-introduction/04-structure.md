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
│ │ ├ templates/
│ │ ├ App.svelte
│ │ ├ client.js
│ │ ├ Error.svelte
│ │ └ server.js
│ ├ index.html
│ ├ package.json
│ ├ server.cjs
│ └ vite.config.js
└ graphql.config.js
````

You’ll also find common files like `.gitignore`, `.prettierrc`, and similar configuration files at the project root.

## Overview

A Crelte project is split into two applications:

* **Craft CMS** (`craft/`) handles content modeling, localization, and content delivery.
* **Svelte** (`svelte/`) handles rendering, interactivity, and the frontend application.

Both applications are developed and deployed together, but remain clearly separated in responsibility.

## craft

The `craft` directory contains a standard Craft CMS installation. It is responsible for defining content structure, managing entries, and exposing content via GraphQL.

For a detailed breakdown of the Craft directory structure, see the [Craft CMS documentation](https://craftcms.com/docs/5.x/system/directory-structure.html).

* `.env` contains environment-specific configuration such as database credentials and site URLs.
* `config/` contains Craft configuration files.
* `web/` is the public web root for Craft.

Most day-to-day Crelte development does not require modifying files inside this directory beyond content modeling and configuration.

## svelte

The `svelte` directory contains the frontend application. This is where most development work happens.

* `public/` contains static assets that are served as-is, such as `robots.txt` or `favicon.ico`.
* `index.html` is the HTML entry point for the frontend.

  * The `<html>` tag must include `lang="<!--page-lang-->"`
  * The `<!--ssr-body-->` comment marks where server-rendered content is injected
* `vite.config.js` contains the Vite configuration for the frontend build.

### svelte/src

The `src` directory contains the core frontend source code.

* `templates/` contains page-level Svelte components used to render entries.
* `queries/` contains GraphQL queries used to fetch entry and global data.
* `App.svelte` is the root component rendered for every page.
* `client.js` is the entry point for client-side code.
* `server.js` is the entry point for server-side rendering.
* `Error.svelte` is rendered when an error occurs or when Craft is unavailable.

## graphql.config.js

The `graphql.config.js` file configures GraphQL tooling and editor integrations for working with Craft’s GraphQL API.

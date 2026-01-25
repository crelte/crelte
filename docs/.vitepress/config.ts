import { DefaultTheme, defineConfig } from 'vitepress';
import typedocSidebar from '../types/typedoc-sidebar.json';

const hideFromTypedoc = ['client', 'node', 'server', 'vite'];

// https://vitepress.dev/reference/site-config
export default defineConfig({
	title: 'Crelte Docs',
	description: 'The crelte documentation',
	themeConfig: {
		// https://vitepress.dev/reference/default-theme-config
		nav: [
			{ text: 'Guide', link: '/guide/01-introduction/01-introduction' },
			{ text: 'Tutorial', link: '/tutorial/01-introduction/01-overview' },
			{ text: 'Cookbook', link: '/cookbook/01-overview' },
			{ text: 'Types', link: '/types' },
		],

		sidebar: {
			'/guide/': { base: '/guide/', items: sidebarGuide() },
			'/tutorial/': { base: '/tutorial/', items: sidebarTutorial() },
			'/cookbook/': { base: '/cookbook/', items: sidebarCookbook() },
			'/types/': [
				{ text: 'crelte', link: '/types' },
				...typedocSidebar.filter(
					item => !hideFromTypedoc.includes(item.text),
				),
			],
		},

		socialLinks: [
			{ icon: 'github', link: 'https://github.com/crelte/crelte' },
		],

		search: {
			provider: 'local',
		},
	},
});

function sidebarGuide(): DefaultTheme.SidebarItem[] {
	return [
		{
			text: 'Getting started',
			// collapsed: false,
			items: [
				{
					text: 'Introduction',
					link: '01-introduction/01-introduction',
				},
				{
					text: 'Architecture overview',
					link: '01-introduction/02-overview',
				},
				{ text: 'Create a project', link: '01-introduction/03-create' },
				{ text: 'Structure', link: '01-introduction/04-structure' },
			],
		},
		{
			text: 'Concepts',
			// collapsed: false,
			items: [
				{ text: 'Routing', link: '02-core/01-routing' },
				{ text: 'Load data', link: '02-core/02-load-data' },
				{ text: 'GraphQL', link: '02-core/03-graphql' },
				{ text: 'Globals', link: '02-core/04-globals' },
				{ text: 'Styling', link: '02-core/05-styling' },
				{
					text: 'State management',
					link: '02-core/06-state-management',
				},
				{ text: 'Blocks', link: '02-core/07-blocks' },
				{ text: 'Translations', link: '02-core/08-translations' },
				{ text: 'Server routes', link: '02-core/09-server-routes' },
			],
		},
		{
			text: 'Build and Deploy',
			items: [{ text: 'Overview', link: '03-build-deploy/01-overview' }],
		},
		{
			text: 'Advanced',
			items: [
				{ text: 'Data flow', link: '04-advanced/01-data-flow' },
				{ text: 'Plugins', link: '04-advanced/02-plugins' },
				{ text: 'Caching', link: '04-advanced/03-caching' },
				{ text: 'Static Router', link: '04-advanced/04-static-router' },
			],
		},
	];
}

function sidebarTutorial(): DefaultTheme.SidebarItem[] {
	return [
		{
			text: 'Introduction',
			items: [
				{ text: 'Overview', link: '01-introduction/01-overview' },
				{ text: 'Create a project', link: '01-introduction/02-create' },
			],
		},
		{
			text: 'Page & Header',
			items: [
				{ text: 'Craft', link: '02-page-header/01-craft' },
				{ text: 'Svelte', link: '02-page-header/02-svelte' },
			],
		},
		{
			text: 'Content Matrix',
			items: [
				{ text: 'Craft', link: '03-content-matrix/01-craft' },
				{ text: 'Svelte', link: '03-content-matrix/02-svelte' },
				{ text: 'Preview', link: '03-content-matrix/03-preview' },
			],
		},
		{
			text: 'News',
			items: [
				{ text: 'Craft', link: '04-news/01-craft' },
				{ text: 'Svelte', link: '04-news/02-svelte' },
				{ text: 'End', link: '04-news/03-end' },
			],
		},
	];
}

function sidebarCookbook(): DefaultTheme.SidebarItem[] {
	return [
		{ text: 'Overview', link: '01-overview' },
		{ text: 'PageLoader', link: 'page-loader' },
		{ text: 'preloadOnMouseOver', link: 'preload-on-mouse-over' },
	];
}

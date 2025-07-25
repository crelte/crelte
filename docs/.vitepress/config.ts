import { DefaultTheme, defineConfig } from 'vitepress';

// https://vitepress.dev/reference/site-config
export default defineConfig({
	title: 'Crelte Documentation',
	description: 'The crelte documentation',
	themeConfig: {
		// https://vitepress.dev/reference/default-theme-config
		nav: [
			{ text: 'Guide', link: '/guide/01-introduction/01-introduction' },
			{ text: 'Tutorial', link: '/tutorial/01-introduction/01-overview' },
		],

		sidebar: {
			'/guide/': { base: '/guide/', items: sidebarGuide() },
			'/tutorial/': { base: '/tutorial/', items: sidebarTutorial() },
		},

		socialLinks: [
			{ icon: 'github', link: 'https://github.com/crelte/crelte' },
		],
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
				{ text: 'Overview', link: '01-introduction/02-overview' },
				{ text: 'Create a project', link: '01-introduction/02-create' },
				{ text: 'Structure', link: '01-introduction/03-structure' },
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

import Page from '../app/dashboard/page';
import Layout from '../app/dashboard/layout';
import Home from '../app/routes/home';
import Root from '../app/root';
import Index from '../pages/index.vue';
import Landing from './pages/index.astro';
import Shell from './routes/+layout.svelte';

export const all = [Page, Layout, Home, Root, Index, Landing, Shell];

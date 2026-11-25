import { mount } from 'svelte';
import App from './App.svelte';
import './theme.css';
import { toHost } from './host';
import { watchErrors } from './usage-report';

watchErrors(toHost);

mount(App, { target: document.getElementById('app')! });

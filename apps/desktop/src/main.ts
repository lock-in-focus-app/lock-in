import { createApp } from 'vue';
import App from './App.vue';
import { restWhenAway } from './app';
import './theme.css';

restWhenAway();
createApp(App).mount('#app');

import './styles.css';
import { App } from './App';

const root = document.getElementById('app');

if (!root) {
  throw new Error('Brak elementu #app w index.html');
}

new App(root);

import Splitting from 'splitting';
import { SPLITTING_GLOBAL } from './splitting';

const NOTICE = 'Splitting 1.1.0, Copyright (c) 2018 Stephen Shaw, MIT licence';

const style = document.createElement('style');
style.textContent = '@property --split{syntax:"<number>";inherits:true;initial-value:0}.splitting .word,.splitting .char{display:inline-block}.splitting .char{--char-percent:calc(var(--char-index) / var(--char-total))}';
document.head.appendChild(style);

(window as unknown as Record<string, unknown>)[SPLITTING_GLOBAL] = { Splitting, notices: [NOTICE] };

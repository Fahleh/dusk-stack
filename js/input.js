// Drop input: pointer on the canvas, Space or Enter on the keyboard.
// Every listener is tied to one AbortSignal so teardown removes them all.

const DROP_KEYS = new Set(['Space', 'Enter', 'NumpadEnter']);
const NATIVE_CONTROLS = 'button, a, input, select, textarea';

/**
 * @param {{ canvas: HTMLElement, onAction: (source: 'pointer'|'key') => void, signal: AbortSignal }} options
 */
export function bindInput({ canvas, onAction, signal }) {
  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    onAction('pointer');
  }, { signal });

  canvas.addEventListener('contextmenu', (event) => event.preventDefault(), { signal });

  window.addEventListener('keydown', (event) => {
    if (!DROP_KEYS.has(event.code)) return;
    // A focused button keeps its own Space/Enter behaviour.
    if (event.target instanceof Element && event.target.closest(NATIVE_CONTROLS)) return;
    event.preventDefault();
    if (event.repeat) return;
    onAction('key');
  }, { signal });
}

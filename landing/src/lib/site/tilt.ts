const MAX_DEGREES = 6;
const PERSPECTIVE = 'perspective(1500px)';

export function tilt(node: HTMLElement) {
  const fine = matchMedia('(hover: hover) and (pointer: fine)');

  function move(event: PointerEvent) {
    if (!fine.matches) {
      return;
    }

    const box = node.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    node.style.transform = `${PERSPECTIVE} rotateX(${-y * MAX_DEGREES}deg) rotateY(${x * MAX_DEGREES}deg)`;
  }

  function leave() {
    node.style.transform = PERSPECTIVE;
  }

  node.addEventListener('pointermove', move);
  node.addEventListener('pointerleave', leave);

  return {
    destroy() {
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerleave', leave);
    }
  };
}

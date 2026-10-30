export function resetForm(form: HTMLFormElement): void {
  HTMLFormElement.prototype.reset.call(form);
}

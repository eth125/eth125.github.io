// "Copy email" button: copies the address, or selects it when the clipboard is unavailable.

const COPY_KEYS = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘C' : 'Ctrl+C';

export function initContact() {
  const button = document.getElementById('copyEmail');
  const email = document.getElementById('email');
  if (!button || !email) return;

  const idleLabel = button.textContent;
  let timer = 0;

  const say = (label) => {
    button.textContent = label;
    clearTimeout(timer);
    timer = setTimeout(() => {
      button.textContent = idleLabel;
    }, 1800);
  };

  const selectAddress = () => {
    const range = document.createRange();
    range.selectNodeContents(email);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    say(`Selected, press ${COPY_KEYS}`);
  };

  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(email.textContent.trim());
      say('Copied');
    } catch {
      selectAddress();
    }
  });
}

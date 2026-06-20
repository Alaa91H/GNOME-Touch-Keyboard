// src/ui/LanguageButton.js
// A button showing a globe icon that cycles through available languages on
// click. The LanguageManager is injected by the caller (no globals).

import St from 'gi://St';

export function createLanguageButton(languageManager) {
  const button = new St.Button({
    style_class: 'keyboard-language-button',
    label: '🌐',
    reactive: true,
    can_focus: true,
    track_hover: true,
  });

  button.connect('clicked', () => languageManager.cycle());

  return button;
}

// src/ui/LanguageButton.js
// A button that shows the current language (emoji globe) and cycles through available languages on click.

const { St, Clutter } = imports.gi;
const Main = imports.ui.main;
const Lang = imports.lang;
const ExtensionUtils = imports.misc.extensionUtils;

function init() {}

function createLanguageButton() {
    const lm = ExtensionUtils.getCurrentExtension().imports.core.LanguageManager.getLanguageManager();
    const button = new St.Button({
        style_class: 'keyboard-language-button',
        reactive: true,
        can_focus: true,
        track_hover: true,
        tooltip_text: _('Switch keyboard language'),
    });

    // Use a globe emoji as the icon – you can replace with a flag image later.
    const label = new St.Label({ text: '🌐' });
    button.set_child(label);

    button.connect('button-press-event', () => {
        lm.cycle();
        // Update tooltip to show current language code.
        button.tooltip_text = `${_('Language')}: ${lm.getActiveId().toUpperCase()}`;
    });

    // Update tooltip initially
    button.tooltip_text = `${_('Language')}: ${lm.getActiveId().toUpperCase()}`;
    // Listen for language changes via manager signal
    if (lm && lm.connect) {
        const signal = lm.connect('language-changed', () => {
            button.tooltip_text = `${_('Language')}: ${lm.getActiveId().toUpperCase()}`;
        });
        // Store signal for potential cleanup (optional)
        if (!global._gnomeTouchKeyboard) global._gnomeTouchKeyboard = {};
        if (!global._gnomeTouchKeyboard.signals) global._gnomeTouchKeyboard.signals = [];
        global._gnomeTouchKeyboard.signals.push(signal);
    }

    return button;
}

exports.createLanguageButton = createLanguageButton;

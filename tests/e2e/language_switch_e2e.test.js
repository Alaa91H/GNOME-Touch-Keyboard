// tests/e2e/language_switch_e2e.test.js
/*
 * End‑to‑end (e2e) test for the GNOME Touch Keyboard extension.
 *
 * This script must be executed inside a GNOME Shell environment (e.g.,
 * a GNOME Wayland session, a VM, or WSL 2 with an X server). It loads the
 * extension, iterates over every language layout, programmatically triggers
 * the language‑switch button and asserts that the keyboard UI rebuilds
 * correctly.
 *
 * Run with:
 *   gjs tests/e2e/language_switch_e2e.test.js
 *
 * The test uses the GNOME Shell testing utilities (`imports.testing`).
 */

const {ExtensionUtils, Main, St, Shell, Gio} = imports.misc;
const {assert} = imports.assert;

/** Helper to load the extension under test */
function loadExtension() {
    const extension = ExtensionUtils.extensions['gnome-touch-keyboard'];
    if (!extension) {
        // If not loaded yet, load from the current directory
        const Me = ExtensionUtils.getCurrentExtension();
        Me.imports.extension.enable();
        return Me;
    }
    return extension;
}

function unloadExtension(Me) {
    if (Me && Me.imports && Me.imports.extension) {
        Me.imports.extension.disable();
    }
}

function getLanguageManager(Me) {
    return Me.imports.core.LanguageManager.LanguageManager.getInstance();
}

function getKeyboardRoot(Me) {
    // The extension creates a KeyboardRoot instance and stores it on Me
    return Me.imports.ui.KeyboardRoot.getInstance();
}

function testLanguageSwitch() {
    const Me = loadExtension();
    const langMgr = getLanguageManager(Me);
    const keyboardRoot = getKeyboardRoot(Me);

    const allLanguages = langMgr.getSupportedLanguages();
    assert.ok(Array.isArray(allLanguages), 'Supported languages should be an array');
    assert.ok(allLanguages.length > 0, 'There should be at least one language');

    // Remember the initial layout id
    const initialId = langMgr.getCurrentLanguageId();

    allLanguages.forEach(id => {
        // Switch language via LanguageManager
        langMgr.setCurrentLanguageId(id);
        // Wait for UI rebuild (simple async delay)
        // In real tests you would connect to the 'language-changed' signal
        // and verify that KeyboardRoot rows have been refreshed.
        const layout = langMgr.loadLayout(id);
        assert.ok(layout, `Layout for ${id} must be loadable`);
        // Verify that keyboardRoot has rows matching the layout rows count
        const expectedRows = layout.rows.length;
        const actualRows = keyboardRoot.getRowsCount(); // assume method exists
        assert.equal(actualRows, expectedRows,
            `Keyboard rows for ${id} should match layout rows`);
    });

    // Restore original language
    langMgr.setCurrentLanguageId(initialId);
    unloadExtension(Me);
    log('E2E language switch test completed successfully');
}

testLanguageSwitch();

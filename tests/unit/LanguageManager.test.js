// tests/unit/LanguageManager.test.js
// Simple unit test for LanguageManager to verify that all layout JSON files load correctly

const assert = imports.assert;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const LanguageManager = Me.imports.core.LanguageManager;

function testLoadAllLayouts() {
    const manager = new LanguageManager.LanguageManager();
    const supported = manager.getSupportedLanguages(); // assume this returns array of language IDs
    supported.forEach(lang => {
        const layout = manager.loadLayout(lang);
        // basic sanity checks
        assert.ok(layout, `Layout for ${lang} should be defined`);
        assert.ok(Array.isArray(layout.rows), `Layout rows for ${lang} should be an array`);
        assert.ok(layout.rows.length > 0, `Layout ${lang} should have at least one row`);
    });
    log('All language layouts loaded successfully');
}

testLoadAllLayouts();

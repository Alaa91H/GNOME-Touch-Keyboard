// src/core/LanguageManager.js
// ES‑module implementation of LanguageManager with dependency injection and GObject signals.

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';

/**
 * LanguageManager loads JSON layout files, tracks the active language via
 * GSettings and emits a `language-changed` signal whenever the selection
 * changes.
 *
 * @param {Object} options
 * @param {Gio.File} options.layoutsDir   Directory containing layout JSON files.
 * @param {Gio.Settings} options.settings  GSettings schema instance for this extension.
 */
export const LanguageManager = GObject.registerClass(
{
    Signals: {
        'language-changed': {},
    },
},
class LanguageManager extends GObject.Object {
    _init({ layoutsDir, settings }) {
        super._init();
        this._settings = settings;
        this._layoutsDir = layoutsDir;
        this._available = {};
        this._loadLayouts();
        // Ensure a valid language is selected upon initialisation.
        const saved = this._settings.get_string('language-id');
        if (!this._available[saved]) {
            // Fallback to English if the stored id is missing.
            this.setActive('en');
        }
    }

    _loadLayouts() {
        // Enumerate *.json files inside the layouts directory.
        const enumerator = this._layoutsDir.enumerate_children(
            'standard::name,standard::type',
            Gio.FileQueryInfoFlags.NONE,
            null
        );
        let info;
        while ((info = enumerator.next_file(null)) !== null) {
            if (info.get_file_type() !== Gio.FileType.REGULAR) continue;
            const name = info.get_name();
            if (!name.endsWith('.json')) continue;
            const id = name.slice(0, -5); // strip .json extension
            try {
                const file = this._layoutsDir.get_child(name);
                const [ok, contents] = file.load_contents(null);
                if (ok) {
                    // Convert ByteArray to string safely.
                    const text = imports.byteArray.toString(contents);
                    const json = JSON.parse(text);
                    this._available[id] = json;
                }
            } catch (e) {
                // Log the error but continue loading other layouts.
                logError(e, `Failed to load layout ${name}`);
            }
        }
    }

    /** Return array of available language IDs. */
    getAvailableIds() {
        return Object.keys(this._available);
    }

    /** Return the currently active language ID stored in GSettings. */
    getActiveId() {
        return this._settings.get_string('language-id');
    }

    /** Return the layout JSON for the active language, falling back to English. */
    getActiveLayout() {
        const id = this.getActiveId();
        return this._available[id] || this._available['en'];
    }

    /** Set the active language ID. Emits `language-changed` on success. */
    setActive(id) {
        if (!this._available[id]) return false;
        this._settings.set_string('language-id', id);
        this.emit('language-changed');
        return true;
    }

    /** Cycle to the next available language. */
    cycle() {
        const ids = this.getAvailableIds();
        const cur = this.getActiveId();
        const idx = ids.indexOf(cur);
        const next = ids[(idx + 1) % ids.length];
        this.setActive(next);
    }
}
);

// Export a helper to create an instance with proper DI. Consumers should pass
// the directory and settings objects obtained from the extension controller.
export function createLanguageManager({ layoutsDir, settings }) {
    return new LanguageManager({ layoutsDir, settings });
}

// src/core/LanguageManager.js
// ES-module LanguageManager with dependency injection and GObject signals.
// Loads JSON layout files asynchronously (never blocks the Shell), tracks the
// active language via GSettings, and emits `language-changed` on selection
// changes.

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';

export const LanguageManager = GObject.registerClass(
{
    Signals: {
        'language-changed': {},
    },
},
class LanguageManager extends GObject.Object {
    /**
     * @param {Object} options
     * @param {Gio.File} options.layoutsDir  Directory containing layout JSON files.
     * @param {Gio.Settings} options.settings  GSettings instance for this extension.
     */
    _init({ layoutsDir, settings }) {
        super._init();
        this._settings = settings;
        this._layoutsDir = layoutsDir;
        this._available = {};
    }

    // Load and parse every *.json layout asynchronously. Must be awaited
    // before the keyboard is built. Safe to call once.
    async load() {
        const enumerator = await this._enumerateAsync();
        const tasks = [];
        let infos;
        while ((infos = await this._nextFilesAsync(enumerator, 50)).length > 0) {
            for (const info of infos) {
                if (info.get_file_type() !== Gio.FileType.REGULAR) continue;
                const name = info.get_name();
                if (!name.endsWith('.json')) continue;
                const id = name.slice(0, -5); // strip ".json"
                const child = this._layoutsDir.get_child(name);
                tasks.push(
                    this._readJsonAsync(child)
                        .then((json) => {
                            // us.json carries the legacy single-layout marker
                            // (id: "Default") and is not a `language-id`
                            // schema choice; skip it so it can't appear in
                            // the language list or get_settings warnings.
                            if (json?.id === 'Default') return;
                            this._available[id] = json;
                        })
                        .catch((e) => console.error(`[osk-pro] failed to load layout ${name}: ${e}`)));
            }
        }
        enumerator.close(null);
        await Promise.all(tasks);

        // Ensure a valid language is selected.
        const saved = this._settings.get_string('language-id');
        if (!this._available[saved]) {
            const fallback = this._available['en'] ? 'en' : this.getAvailableIds()[0];
            if (fallback) this.setActive(fallback);
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
        return this._available[id] || this._available['en'] || null;
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
        if (ids.length === 0) return;
        const idx = ids.indexOf(this.getActiveId());
        this.setActive(ids[(idx + 1) % ids.length]);
    }

    _enumerateAsync() {
        return new Promise((resolve, reject) => {
            this._layoutsDir.enumerate_children_async(
                'standard::name,standard::type',
                Gio.FileQueryInfoFlags.NONE,
                GLib.PRIORITY_DEFAULT, null,
                (dir, res) => {
                    try { resolve(dir.enumerate_children_finish(res)); }
                    catch (e) { reject(e); }
                });
        });
    }

    _nextFilesAsync(enumerator, count) {
        return new Promise((resolve, reject) => {
            enumerator.next_files_async(
                count, GLib.PRIORITY_DEFAULT, null,
                (en, res) => {
                    try { resolve(en.next_files_finish(res)); }
                    catch (e) { reject(e); }
                });
        });
    }

    _readJsonAsync(file) {
        return new Promise((resolve, reject) => {
            file.load_contents_async(null, (f, res) => {
                try {
                    const [ok, bytes] = f.load_contents_finish(res);
                    if (!ok) throw new Error('read returned false');
                    resolve(JSON.parse(new TextDecoder().decode(bytes)));
                } catch (e) {
                    reject(e);
                }
            });
        });
    }
}
);

// Create an instance with proper dependency injection. Consumers pass the
// layouts directory (Gio.File) and the Gio.Settings from the extension.
export function createLanguageManager({ layoutsDir, settings }) {
    return new LanguageManager({ layoutsDir, settings });
}

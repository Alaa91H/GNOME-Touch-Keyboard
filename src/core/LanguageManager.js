// src/core/LanguageManager.js
// Manages loading of language layout JSON files and persisting the active language via GSettings.

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Signals = imports.signals;

class LanguageManager {
    constructor() {
        // Enable signal methods on this instance
        Signals.addSignalMethods(this);
        this._settings = ExtensionUtils.getSettings();
        this._layoutsDir = Me.dir.get_child('resources').get_child('layouts');
        this._available = {};
        this._loadLayouts();
        // Ensure a valid language is selected
        const saved = this._settings.get_string('language-id');
        if (!this._available[saved]) {
            this.setActive('en');
        }
    }

    _loadLayouts() {
        // Scan the layouts directory for *.json files
        let files = this._layoutsDir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
        let info;
        while ((info = files.next_file(null)) !== null) {
            if (info.get_file_type() !== Gio.FileType.REGULAR) continue;
            let name = info.get_name();
            if (!name.endsWith('.json')) continue;
            let id = name.slice(0, -5); // strip .json
            try {
                let file = this._layoutsDir.get_child(name);
                let [ok, contents] = file.load_contents(null);
                if (ok) {
                    let json = JSON.parse(imports.byteArray.toString(contents));
                    this._available[id] = json;
                }
            } catch (e) {
                logError(e, `Failed to load layout ${name}`);
            }
        }
    }

    getAvailableIds() {
        return Object.keys(this._available);
    }

    getActiveId() {
        return this._settings.get_string('language-id');
    }

    getActiveLayout() {
        const id = this.getActiveId();
        return this._available[id] || this._available['en'];
    }

    setActive(id) {
        if (!this._available[id]) return false;
        this._settings.set_string('language-id', id);
        // Emit a custom signal so UI can refresh
        this.emit('language-changed');
        return true;
    }

    cycle() {
        const ids = this.getAvailableIds();
        const cur = this.getActiveId();
        const idx = ids.indexOf(cur);
        const next = ids[(idx + 1) % ids.length];
        this.setActive(next);
    }
}

function getLanguageManager() {
    if (!global._gnomeTouchKeyboard) global._gnomeTouchKeyboard = {};
    if (!global._gnomeTouchKeyboard.manager) {
        global._gnomeTouchKeyboard.manager = new LanguageManager();
    }
    return global._gnomeTouchKeyboard.manager;
}

var LanguageManager = LanguageManager;
var getLanguageManager = getLanguageManager;

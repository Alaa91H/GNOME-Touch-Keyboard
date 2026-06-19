// prefs.js — GTK4 + libadwaita preferences window. Out-of-shell process;
// uses GTK/Adw/Gdk, not St/Clutter. Imports defaults.js for the single
// source of truth.

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import { SCHEMA_ID, KEYS } from './src/settings/defaults.js';

export default class OskProPrefs extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings(SCHEMA_ID);
    const page = new Adw.PreferencesPage();
    const group = new Adw.PreferencesGroup({ title: 'GNOME Touch Keyboard' });

    for (const k of KEYS) {
      if (k.type === 'b') group.add(this._rowSwitch(settings, k.key, k.summary));
    }
    for (const k of KEYS) {
      if ((k.type === 'i' || k.type === 'd') && k.min != null && k.max != null) {
        group.add(this._rowSpin(settings, k.key, k.summary, k.min, k.max, k.type === 'd'));
      }
    }
    group.add(this._rowCombo(settings, 'theme-mode', 'Theme mode', ['auto', 'light', 'dark']));
    group.add(this._rowCombo(settings, 'layout-id', 'Layout', ['Default']));
    group.add(this._rowCombo(settings, 'position-mode', 'Position', ['bottom']));
    group.add(this._rowColor(settings, 'accent-color', 'Accent color'));

    page.add(group);
    window.add(page);
  }

  _rowSwitch(settings, key, title) {
    const row = new Adw.ActionRow({ title });
    const toggle = new Gtk.Switch({ active: settings.get_boolean(key), valign: Gtk.Align.CENTER });
    settings.bind(key, toggle, 'active', Gio.SettingsBindFlags.DEFAULT);
    row.add_suffix(toggle);
    row.activatable_widget = toggle;
    return row;
  }

  _rowSpin(settings, key, title, lo, hi, isDouble) {
    const row = new Adw.ActionRow({ title });
    const adj = new Gtk.Adjustment({ lower: lo, upper: hi, step_increment: 1 });
    const spin = new Gtk.SpinButton({ adjustment: adj, valign: Gtk.Align.CENTER });
    if (isDouble) {
      spin.digits = 2;
      spin.value = settings.get_double(key);
      spin.connect('value-changed', () => settings.set_double(key, spin.value));
    } else {
      spin.value = settings.get_int(key);
      spin.connect('value-changed', () => settings.set_int(key, spin.value));
    }
    row.add_suffix(spin);
    return row;
  }

  _rowCombo(settings, key, title, options) {
    const row = new Adw.ActionRow({ title });
    const strings = new Gtk.StringList();
    for (const o of options) strings.append(o);
    const dd = new Gtk.DropDown({ model: strings, valign: Gtk.Align.CENTER });
    dd.selected = Math.max(0, options.indexOf(settings.get_string(key)));
    dd.connect('notify::selected', () => settings.set_string(key, options[dd.selected]));
    row.add_suffix(dd);
    return row;
  }

  _rowColor(settings, key, title) {
    const row = new Adw.ActionRow({ title });
    const btn = new Gtk.ColorDialogButton({ valign: Gtk.Align.CENTER });
    const rgba = new Gdk.RGBA();
    if (rgba.parse(settings.get_string(key))) btn.rgba = rgba;
    btn.connect('notify::rgba', () => {
      const c = btn.rgba;
      const to2 = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
      settings.set_string(key, `#${to2(c.red)}${to2(c.green)}${to2(c.blue)}`);
    });
    row.add_suffix(btn);
    return row;
  }
}

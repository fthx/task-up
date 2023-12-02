import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';


export default class TaskUpPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        window._settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: 'Task Up extension',
            icon_name: 'dialog-information-symbolic',
        });
        window.add(page);


        const group1 = new Adw.PreferencesGroup();
        page.add(group1);

        const row_icons = new Adw.SwitchRow({
            title: 'Show icons',
        });
        group1.add(row_icons);
        window._settings.bind('show-icons', row_icons, 'active', Gio.SettingsBindFlags.DEFAULT);

        const row_titles = new Adw.SwitchRow({
            title: 'Show titles',
        });
        group1.add(row_titles);
        window._settings.bind('show-titles', row_titles, 'active', Gio.SettingsBindFlags.DEFAULT);

        const row_colored = new Adw.SwitchRow({
            title: 'Colored icons',
        });
        group1.add(row_colored);
        window._settings.bind('colored-icons', row_colored, 'active', Gio.SettingsBindFlags.DEFAULT);

        const row_symbolic = new Adw.SwitchRow({
            title: 'Symbolic icons',
        });
        group1.add(row_symbolic);
        window._settings.bind('symbolic-icons', row_symbolic, 'active', Gio.SettingsBindFlags.DEFAULT);

        const row_tooltip = new Adw.SwitchRow({
            title: 'Show tooltip',
        });
        group1.add(row_tooltip);
        window._settings.bind('show-tooltip', row_tooltip, 'active', Gio.SettingsBindFlags.DEFAULT);


        const group2 = new Adw.PreferencesGroup();
        page.add(group2);

        const adjustment_size = new Gtk.Adjustment({
            lower: 96,
            upper: 288,
            step_increment: 48,
        });

        const row_size = new Adw.SpinRow({
            title: 'Buttons default size (default: 192 px)',
            adjustment: adjustment_size
        });
        group2.add(row_size);
        window._settings.bind('buttons-size', row_size, 'value', Gio.SettingsBindFlags.DEFAULT);

        const adjustment_opacity = new Gtk.Adjustment({
            lower: 0,
            upper: 255,
            step_increment: 5,
        });

        const row_opacity = new Adw.SpinRow({
            title: 'Buttons not on active workspace opacity (default: 160)',
            adjustment: adjustment_opacity
        });
        group2.add(row_opacity);
        window._settings.bind('buttons-opacity', row_opacity, 'value', Gio.SettingsBindFlags.DEFAULT);

        const group3 = new Adw.PreferencesGroup();
        page.add(group3);

        const row_delay = new Adw.SwitchRow({
            title: 'Task bar refresh delay after action (default: ON)',
            subtitle: 'ON = fewer refreshes, medium reactivity\nOFF = more refreshes, high reactivity'
        });
        group3.add(row_delay);
        window._settings.bind('refresh-delay', row_delay, 'active', Gio.SettingsBindFlags.DEFAULT);
    }
}

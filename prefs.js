import Gio from 'gi://Gio';
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

        const group = new Adw.PreferencesGroup();
        page.add(group);

        const row_icons = new Adw.SwitchRow({
            title: 'Show icons',
        });
        group.add(row_icons);
        window._settings.bind('show-icons', row_icons, 'active', Gio.SettingsBindFlags.DEFAULT);

        const row_titles = new Adw.SwitchRow({
            title: 'Show titles',
        });
        group.add(row_titles);
        window._settings.bind('show-titles', row_titles, 'active', Gio.SettingsBindFlags.DEFAULT);

        const row_colored = new Adw.SwitchRow({
            title: 'Colored icons',
        });
        group.add(row_colored);
        window._settings.bind('colored-icons', row_colored, 'active', Gio.SettingsBindFlags.DEFAULT);

        const row_symbolic = new Adw.SwitchRow({
            title: 'Symbolic icons',
        });
        group.add(row_symbolic);
        window._settings.bind('symbolic-icons', row_symbolic, 'active', Gio.SettingsBindFlags.DEFAULT);

        const row_tooltip = new Adw.SwitchRow({
            title: 'Show tooltip',
        });
        group.add(row_tooltip);
        window._settings.bind('show-tooltip', row_tooltip, 'active', Gio.SettingsBindFlags.DEFAULT);
    }
}

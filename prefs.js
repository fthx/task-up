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

        const row_workspace = new Adw.SwitchRow({
            title: 'Show tasks on active workspace only',
        });
        group1.add(row_workspace);
        window._settings.bind('active-workspace', row_workspace, 'active', Gio.SettingsBindFlags.DEFAULT);

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

        const row_tooltip = new Adw.SwitchRow({
            title: 'Show tooltip on hover',
        });
        group1.add(row_tooltip);
        window._settings.bind('show-tooltip', row_tooltip, 'active', Gio.SettingsBindFlags.DEFAULT);

        const row_window = new Adw.SwitchRow({
            title: 'Raise window on hover',
        });
        group1.add(row_window);
        window._settings.bind('raise-window', row_window, 'active', Gio.SettingsBindFlags.DEFAULT);


        const group2 = new Adw.PreferencesGroup();
        page.add(group2);

        const row_border = new Adw.SwitchRow({
            title: 'Button border only on top',
        });
        group2.add(row_border);
        window._settings.bind('border-top', row_border, 'active', Gio.SettingsBindFlags.DEFAULT);

        const row_colored = new Adw.SwitchRow({
            title: 'Colored icons',
        });
        group2.add(row_colored);
        window._settings.bind('colored-icons', row_colored, 'active', Gio.SettingsBindFlags.DEFAULT);

        const row_symbolic = new Adw.SwitchRow({
            title: 'Symbolic icons',
        });
        group2.add(row_symbolic);
        window._settings.bind('symbolic-icons', row_symbolic, 'active', Gio.SettingsBindFlags.DEFAULT);

        const adjustment_size = new Gtk.Adjustment({
            lower: 96,
            upper: 384,
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

        const raise_delay = new Gtk.Adjustment({
            lower: 0,
            upper: 1000,
            step_increment: 50,
        });

        const row_raise = new Adw.SpinRow({
            title: 'Delay before raising window and/or tooltip on hover (default: 500 ms)',
            adjustment: raise_delay
        });
        group2.add(row_raise);
        window._settings.bind('raise-delay', row_raise, 'value', Gio.SettingsBindFlags.DEFAULT);
    }
}

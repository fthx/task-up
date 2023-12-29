//    Task Up
//    GNOME Shell extension
//    @fthx 2023


import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {AppMenu} from 'resource:///org/gnome/shell/ui/appMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';


const ICON_SIZE = 18; // px
const TOOLTIP_VERTICAL_PADDING = 4; // px
const REFRESH_DELAY = 300; // ms

const TaskButton = GObject.registerClass(
class TaskButton extends PanelMenu.Button {
    _init(window) {
        super._init();

        this._window = window;
        this._desaturate_effect = new Clutter.DesaturateEffect();

        this._box = new St.BoxLayout({style_class: 'panel-button'});

        this._icon = new St.Icon();
        this._icon.set_icon_size(ICON_SIZE);
        this._icon.set_fallback_gicon(null);
        this._box.add_child(this._icon);

        this._label = new St.Label({y_align: Clutter.ActorAlign.CENTER});
        this._label.set_text('  ' + this._window.get_title());
        this._box.add_child(this._label);

        this.add_child(this._box);

        this._menu = new AppMenu(this);
        this.setMenu(this._menu);
        Main.panel.menuManager.addMenu(this.menu);

        this._app = Shell.WindowTracker.get_default().get_window_app(this._window);
        if (this._app) {
            this._icon.set_gicon(this._app.get_icon());
            this.menu.setApp(this._app);
        }

        this._id = this._window;
    }
});

const WorkspaceSeparator = GObject.registerClass(
class WorkspaceSeparator extends PanelMenu.Button {
    _init() {
        super._init();

        this.set_track_hover(false);
        this.set_reactive(false);
        this.set_can_focus(false);

        this._box = new St.BoxLayout({style_class: 'panel-button'});

        this._label = new St.Label();
        this._label.set_text('│');
        this._box.add_child(this._label);
        this.add_child(this._box);

        this._label.add_style_class_name('workspace-separator');

        this._id = this;
    }
});

const TaskTooltip = GObject.registerClass(
class TaskTooltip extends St.BoxLayout {
    _init() {
        super._init({style_class: 'window-tooltip'});

        this._label = new St.Label({y_align: Clutter.ActorAlign.CENTER, text: ''});
        this.add_child(this._label);
        this.hide();

        Main.layoutManager.addChrome(this);
    }
});

export default class TaskUpExtension extends Extension {
    constructor(metadata) {
        super(metadata);
    }

    _pop_task_button(task_button) {
        task_button.disconnectObject(this);

        Main.panel.menuManager.removeMenu(task_button.menu);
        task_button.menu = null;

        delete Main.panel.statusArea[task_button._id];
        task_button.destroy();
        task_button = null;
    }

    _destroy_taskbar() {
        for (let task_button of this._task_list) {
            this._pop_task_button(task_button);
        }
        this._task_list = null;
    }

    _make_task_button(window) {
        if (window.is_skip_taskbar() || (window.get_window_type() == Meta.WindowType.MODAL_DIALOG)) {
            return;
        }

        if (window in Main.panel.statusArea) {
            return;
        }

        let task_button = new TaskButton(window);
        if (this._settings.get_boolean('show-titles')) {
            task_button.add_style_class_name('window-button-' + this._settings.get_int('buttons-size'));
        }
        task_button._icon.visible = this._settings.get_boolean('show-icons');
        task_button._label.visible = this._settings.get_boolean('show-titles');
        if (this._settings.get_boolean('symbolic-icons')) {
            task_button._icon.set_style_class_name('app-menu-icon');
        }
        if (!this._settings.get_boolean('colored-icons')) {
            task_button.add_effect(task_button._desaturate_effect);
        }

        if (window.has_focus()) {
            if (this._settings.get_boolean('border-top')) {
                task_button.add_style_class_name('window-focused-top');
            } else {
                task_button.add_style_class_name('window-focused');
            }
        } else {
            if (this._settings.get_boolean('border-top')) {
                if (this._settings.get_boolean('show-titles')) {
                    task_button.add_style_class_name('window-unfocused-top');
                } else {
                    task_button.add_style_class_name('window-unfocused-top-icon');
                }
            } else {
                task_button.add_style_class_name('window-unfocused');
            }
        }

        if (!this._is_on_active_workspace(window)) {
            task_button._icon.set_opacity(this._settings.get_int('buttons-opacity'));
            task_button._label.set_opacity(this._settings.get_int('buttons-opacity'));
        }

        this._task_list.push(task_button);

        Main.panel.addToStatusArea(task_button._id, task_button, -1, 'left');
        task_button.connectObject('button-press-event', (task_button, event) => this._on_button_click(task_button, event), this);
        task_button.connectObject('notify::hover', (task_button) => this._on_button_hover(task_button), this);
    }

    _make_workspace_separator() {
        let workspace_separator = new WorkspaceSeparator();
        this._task_list.push(workspace_separator);

        Main.panel.addToStatusArea(workspace_separator._id, workspace_separator, -1, 'left');
    }

    _make_taskbar() {
        this._destroy_taskbar();
        this._task_list = [];

        if (this._settings.get_boolean('active-workspace')) {
            let windows_list = global.workspace_manager.get_active_workspace().list_windows().sort(this._sort_windows);
            for (let window of windows_list) {
                this._make_task_button(window);
            }
        } else {
            let workspaces_number = global.workspace_manager.get_n_workspaces();
            for (let workspace_index = 0; workspace_index < workspaces_number; workspace_index++) {
                let windows_list = global.workspace_manager.get_workspace_by_index(workspace_index).list_windows().sort(this._sort_windows);
                if ((workspace_index > 0) && (!Meta.prefs_get_dynamic_workspaces() || (workspace_index < workspaces_number - 1))) {
                    this._make_workspace_separator(workspace_index);
                }
                for (let window of windows_list) {
                    this._make_task_button(window);
                }
            }
        }
    }

    _update_taskbar() {
        if (this._settings.get_boolean('refresh-delay')) {
            if (this._update_taskbar_timeout > 0) {
                GLib.source_remove(this._update_taskbar_timeout);
            }

            this._update_taskbar_timeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, REFRESH_DELAY, () => {
                this._make_taskbar();
                this._update_taskbar_timeout = 0;
            });
        } else {
            this._make_taskbar();
        }
    }

    _is_on_active_workspace(window) {
        return window.get_workspace() == global.workspace_manager.get_active_workspace();
    }

    _sort_windows(w1, w2) {
        return w1.get_id() - w2.get_id();
    }

    _on_button_click(task_button, event) {
        if (event.get_button() == Clutter.BUTTON_PRIMARY) {
            task_button.menu.close();
            if (task_button._window.has_focus()) {
                if (task_button._window.can_minimize() && !Main.overview.visible) {
                    task_button._window.minimize();
                }

            } else  {
                task_button._window.activate(global.get_current_time());
                task_button._window.focus(global.get_current_time());
            }
            Main.overview.hide();
        }

        if (event.get_button() == Clutter.BUTTON_MIDDLE) {
            task_button.menu.close();
            if (task_button._app.can_open_new_window()) {
                task_button._app.open_new_window(-1);
            }
            Main.overview.hide();
        }
    }

    _on_button_hover(task_button) {
        if (!task_button) {
            return;
        }

        if (this._settings.get_boolean('show-tooltip')) {
            if (task_button.get_hover()) {
                this._task_tooltip.set_position(task_button.get_transformed_position()[0], Main.layoutManager.primaryMonitor.y + Main.panel.height + TOOLTIP_VERTICAL_PADDING);
                this._task_tooltip._label.set_text(task_button._window.get_title());
                this._task_tooltip.show();
            } else {
                this._task_tooltip.hide();
            }
        }

        if (this._settings.get_boolean('raise-window')) {
            if (task_button.get_hover()) {
                this._raise_window_timeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._settings.get_int('raise-delay'), () => {
                    if (task_button && this._task_list.includes(task_button) && task_button.get_hover()) {
                        task_button._window.raise();
                        this._raise_window_timeout = 0;
                    }
                });
            } else {
                if (global.display.get_focus_window()) {
                    global.display.get_focus_window().raise();
                }
                this._raise_window_timeout = 0;
            }
        }
    }

    _show_places_icon(show) {
        let places_indicator = Main.panel.statusArea['places-menu'];
        if (places_indicator) {
            places_indicator.remove_child(places_indicator.get_first_child());
            if (show) {
                let places_icon = new St.Icon({icon_name: 'folder-symbolic', style_class: 'system-status-icon'});
                places_indicator.add_child(places_icon);
            } else {
                let places_label = new St.Label({text: _('Places'), y_expand: true, y_align: Clutter.ActorAlign.CENTER});
                places_indicator.add_child(places_label);
            }
        }
    }

    _connect_signals() {
        global.workspace_manager.connectObject(
            'active-workspace-changed', this._update_taskbar.bind(this),
            'notify::n-workspaces', this._update_taskbar.bind(this),
            this);
        Shell.WindowTracker.get_default().connectObject('tracked-windows-changed', this._update_taskbar.bind(this), this);
        global.display.connectObject('notify::focus-window', this._update_taskbar.bind(this), this);
        St.TextureCache.get_default().connectObject('icon-theme-changed', this._update_taskbar.bind(this), this);

        Main.extensionManager.connectObject('extension-state-changed', () => this._show_places_icon(true), this);

        this._settings.connectObject('changed', this._update_taskbar.bind(this), this);
    }

    _disconnect_signals() {
        this._settings.disconnectObject(this);

        global.workspace_manager.disconnectObject(this);
        Shell.WindowTracker.get_default().disconnectObject(this);
        global.display.disconnectObject(this);
        St.TextureCache.get_default().disconnectObject(this);

        Main.extensionManager.disconnectObject(this);
        Main.layoutManager.disconnectObject(this);
    }

    enable() {
        Main.panel._leftBox.add_style_class_name('leftbox-reduced-padding');

        Main.layoutManager.connectObject('startup-complete', () => this._show_places_icon(true), this);

        this._settings = this.getSettings();

        this._task_tooltip = new TaskTooltip();
        this._task_list = [];
        this._last_taskbar_call_time = 0;
        this._update_taskbar();
        this._connect_signals();
    }

    disable() {
        if (this._update_taskbar_timeout) {
            GLib.source_remove(this._update_taskbar_timeout);
            this._update_taskbar_timeout = null;
        }

        if (this._raise_window_timeout) {
            GLib.source_remove(this._raise_window_timeout);
            this._raise_window_timeout = null;
        }

        this._task_tooltip.destroy();
        this._task_tooltip = null;

        this._disconnect_signals();
        this._destroy_taskbar();
        this._last_taskbar_call_time = null;

        this._show_places_icon(false);

        Main.panel._leftBox.remove_style_class_name('leftbox-reduced-padding');

        this._settings = null;
    }
}

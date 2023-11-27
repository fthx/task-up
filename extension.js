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
const N_ = x => x;


const LOW_OPACITY = 160;
const ICON_SIZE = 20;
const TOOLTIP_VERTICAL_PADDING = 10;
const TASKBAR_REFRESH_DELAY = 300;

const TaskButton = GObject.registerClass(
class TaskButton extends PanelMenu.Button {
    _init(window) {
        super._init();

        this._box = new St.BoxLayout({style_class: 'panel-button'});

        this._icon = new St.Icon();
        this._icon.set_icon_size(ICON_SIZE);
        this._icon.set_fallback_gicon(null);
        this._box.add_child(this._icon);
        this.add_child(this._box);

        this._menu = new AppMenu(this);
        this.setMenu(this._menu);
        Main.panel.menuManager.addMenu(this.menu);

        this._window = window;
        this._app = Shell.WindowTracker.get_default().get_window_app(this._window);
        if (this._app) {
            this._icon.set_gicon(this._app.get_icon());
            this.menu.setApp(this._app);
        }
        this._id = 'task-button-' + this._window.get_id();
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
        Main.panel.menuManager.removeMenu(task_button.menu);
        task_button.menu = null;

        task_button.destroy();
        task_button = null;
    }

    _destroy_taskbar() {
        for (let task_button of this._task_list) {
            this._pop_task_button(task_button);
        }
        this._task_list = [];
    }

    _make_task_button(window) {
        if (window.is_skip_taskbar() || (window.get_window_type() == Meta.WindowType.MODAL_DIALOG)) {
            return;
        }

        let task_button = new TaskButton(window);
        this._task_list.push(task_button);

        if (window.has_focus()) {
            task_button._icon.add_style_class_name('window-focused');
        }

        if (!this._is_on_active_workspace(window)) {
            task_button._icon.set_opacity(LOW_OPACITY);
        }

        Main.panel.addToStatusArea(task_button._id, task_button, -1, 'left');
        task_button.connectObject('button-press-event', (widget, event) => this._on_button_click(widget, event, task_button), this);
        task_button.connectObject('notify::hover', (widget) => this._on_button_hover(widget), this);

    }

    _make_workspace_separator() {
        let workspace_separator = new WorkspaceSeparator();
        this._task_list.push(workspace_separator);

        Main.panel.addToStatusArea(workspace_separator._id, workspace_separator, -1, 'left');
    }

    _make_taskbar() {
        this._destroy_taskbar();

        this._workspaces_number = global.workspace_manager.get_n_workspaces();
        for (let workspace_index = 0; workspace_index < this._workspaces_number; workspace_index++) {
            this._windows_list = global.workspace_manager.get_workspace_by_index(workspace_index).list_windows().sort(this._sort_windows);
            if ((workspace_index > 0) && (!Meta.prefs_get_dynamic_workspaces() || (workspace_index < this._workspaces_number - 1))) {
                this._make_workspace_separator(workspace_index);
            }
            for (let window of this._windows_list) {
                this._make_task_button(window);
            }
        }
    }

    _update_taskbar() {
        if (this._update_taskbar_timeout > 0) {
            GLib.source_remove(this._update_taskbar_timeout);
        }

        this._update_taskbar_timeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, TASKBAR_REFRESH_DELAY, () => {
            this._make_taskbar();
            this._update_taskbar_timeout = 0;
        });
    }

    _is_on_active_workspace(window) {
        return window.get_workspace() == global.workspace_manager.get_active_workspace();
    }

    _sort_windows(w1, w2) {
        return w1.get_id() - w2.get_id();
    }

    _on_button_click(widget, event, task_button) {
        task_button.menu.close();

        if (event.get_button() == Clutter.BUTTON_PRIMARY) {
            if (task_button._window.has_focus()) {
                if (task_button._window.can_minimize() && !Main.overview.visible) {
                    task_button._window.minimize();
                }
            } else  {
                task_button._window.activate(global.get_current_time());
                Main.overview.hide();
            }
        }

        if (event.get_button() == Clutter.BUTTON_MIDDLE) {
            if (task_button._app.can_open_new_window()) {
                task_button._app.open_new_window(-1);
                Main.overview.hide();
            }
        }

        if (event.get_button() == Clutter.BUTTON_SECONDARY) {
            task_button.menu.open();
        }
    }

    _on_button_hover(task_button) {
        if (task_button.get_hover()) {
            this._task_tooltip.set_position(task_button.get_transformed_position()[0], Main.layoutManager.primaryMonitor.y + Main.panel.height + TOOLTIP_VERTICAL_PADDING);
            this._task_tooltip._label.set_text(task_button._window.get_title());
            this._task_tooltip.show();
        } else {
            this._task_tooltip.hide();
        }
    }

    _show_places_icon(show) {
        this._places_indicator = Main.panel.statusArea['places-menu'];
        if (this._places_indicator) {
            this._places_indicator.remove_child(this._places_indicator.get_first_child());
            if (show) {
                this._places_icon = new St.Icon({icon_name: 'folder-symbolic', style_class: 'system-status-icon'});
                this._places_indicator.add_child(this._places_icon);
            } else {
                this._places_label = new St.Label({text: _('Places'), y_expand: true, y_align: Clutter.ActorAlign.CENTER});
                this._places_indicator.add_child(this._places_label);
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
    }

    _disconnect_signals() {
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

        this._task_tooltip = new TaskTooltip();
        this._task_list = [];
        this._last_taskbar_call_time = 0;
        this._make_taskbar();
        this._connect_signals();
    }

    disable() {
        GLib.source_remove(this._update_taskbar_timeout);
        this._update_taskbar_timeout = 0;

        this._task_tooltip.destroy();
        this._task_tooltip = null;

        this._disconnect_signals();
        this._destroy_taskbar();

        this._show_places_icon(false);

        Main.panel._leftBox.remove_style_class_name('leftbox-reduced-padding');
    }
}

//    Task Up
//    GNOME Shell extension
//    @fthx 2024


import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as AppFavorites from 'resource:///org/gnome/shell/ui/appFavorites.js';
import { AppMenu } from 'resource:///org/gnome/shell/ui/appMenu.js';
import * as DND from 'resource:///org/gnome/shell/ui/dnd.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

const WORKSPACES_SCHEMA = 'org.gnome.desktop.wm.preferences';
const WORKSPACES_KEY = 'num-workspaces';

const ICON_SIZE = 18; // px
const TOOLTIP_VERTICAL_PADDING = 4; // px


const FavoritesMenu = GObject.registerClass(
class FavoritesMenu extends PanelMenu.Button {
    _init() {
        super._init(0.0);

        this._box = new St.BoxLayout({});
        this._icon = new St.Icon({icon_name: 'starred-symbolic', style_class: 'system-status-icon'});
        this._box.add_child(this._icon);
        this.add_child(this._box);

        this._populate();
        AppFavorites.getAppFavorites().connectObject('changed', this._populate.bind(this), this);

        this.connectObject('destroy', this._destroy.bind(this), this);
    }

    _populate() {
        if (this.menu) {
            this.menu.removeAll();
        }

        let favorites = AppFavorites.getAppFavorites().getFavorites();

        for (let index = 0; index < favorites.length; ++index) {
            let favorite = favorites[index];
            let icon = favorite.create_icon_texture(ICON_SIZE);

            let item = new PopupMenu.PopupImageMenuItem(favorite.get_name(), icon.get_gicon());

            this.menu.addMenuItem(item);
            item.connectObject('activate', () => favorite.open_new_window(-1));
        }
    }

    _destroy() {
        AppFavorites.getAppFavorites().disconnectObject(this);

        //delete Main.panel.statusArea['favorites-menu'];

        super.destroy();
    }
});

const WorkspaceButton = GObject.registerClass(
class WorkspaceButton extends PanelMenu.Button {
    _init(settings, workspace_index) {
        super._init();

        this._settings = settings;
        this._workspace_index = workspace_index;
        this._workspace = global.workspace_manager.get_workspace_by_index(this._workspace_index)

        this._box = new St.BoxLayout({style_class: 'panel-button'});
        this.add_style_class_name('workspace-button');
        this._text = (this._workspace_index + 1).toString();
        this._label = new St.Label({text: this._text, y_align: Clutter.ActorAlign.CENTER});
        this._box.add_child(this._label);

        this.add_child(this._box);

        this._update_visibility();

        this._index = [this._workspace_index, 0];
        this._id = 'workspace-button-' + this._workspace;
        if (!Main.panel.statusArea[this._id]) {
            Main.panel.addToStatusArea(this._id, this, this._new_position(), 'left');
        }

        this._delegate = this;

        global.workspace_manager.connectObject(
            'active-workspace-changed', this._update_visibility.bind(this),
            'workspace-removed', (workspace_manager, removed_workspace_index) => {
                this._on_workspace_removed(removed_workspace_index);
            },
            this);

        this.connectObject(
            'button-press-event', (widget, event) => this._on_click(event),
            'destroy', this._destroy.bind(this),
            this);
    }

    acceptDrop(source) {
        if (source instanceof TaskButton) {
            source._window.change_workspace_by_index(this._workspace_index, false);
            source._on_workspace_changed();
            source._window.activate(global.get_current_time());
            source._window.unminimize();

            return false;
        }
    }

    _new_position() {
        let position = 0;

        for (let bin of Main.panel._leftBox) {
            let button = bin.first_child;
            if (!button || !button._index || this._index > button._index) {
                position++;
            }
        }

        return position;
    }

    _on_click(event) {
        if (event.get_button() == Clutter.BUTTON_PRIMARY) {
            if (this._workspace_index == global.workspace_manager.get_active_workspace_index()) {
                Main.overview.toggle();
            } else {
                global.workspace_manager.get_workspace_by_index(this._workspace_index).activate(global.get_current_time());
                Main.overview.show();
            }
        }
    }

    _update_visibility() {
        if (this._workspace_index == global.workspace_manager.get_active_workspace_index() ) {
            this.set_opacity(255);
        } else {
            this.set_opacity(this._settings.get_int('buttons-opacity'));
        }
    }

    _on_workspace_removed(removed_workspace_index) {
        if (this._workspace_index == removed_workspace_index) {
            this._destroy();
        } else {
            this._workspace_index = this._workspace.index();
            this._text = (this._workspace_index + 1).toString();
            this._label.set_text(this._text);
            this._index = [this._workspace_index, 0];
        }
    }

    _destroy() {
        global.workspace_manager.disconnectObject(this);

        /*if (Main.panel.statusArea[this._id]) {
            delete Main.panel.statusArea[this._id];
        }*/

        super.destroy();
    }
});

const TaskButton = GObject.registerClass(
class TaskButton extends PanelMenu.Button {
    _init(settings, window) {
        super._init();

        this._settings = settings;
        this._window = window;
        this._workspace_index = this._window.get_workspace().index();

        this._desaturate_effect = new Clutter.DesaturateEffect();

        this._box = new St.BoxLayout({style_class: 'panel-button'});
        this._icon = new St.Icon();
        this._icon.set_icon_size(ICON_SIZE);
        this._icon.set_fallback_gicon(null);
        this._box.add_child(this._icon);
        this._label = new St.Label({y_align: Clutter.ActorAlign.CENTER});
        this._box.add_child(this._label);

        this.add_child(this._box);
        this.setMenu(new AppMenu(this));

        this._update_title();
        this._update_app();
        this._update_style();
        this._update_focus();
        this._update_visibility();

        this._task_tooltip = new TaskTooltip();

        this._id = 'task-button-' + this._window;
        this._index = [this._workspace_index, this._window.get_id()];
        if (!Main.panel.statusArea[this._id]) {
            Main.panel.addToStatusArea(this._id, this, this._new_position(), 'left');
        }

        this._delegate = this;
        this._draggable = DND.makeDraggable(this, {dragActorOpacity: this._settings.get_int('buttons-opacity')});

        global.display.connectObject('notify::focus-window', this._update_focus.bind(this), this);
        global.workspace_manager.connectObject('active-workspace-changed', this._update_visibility.bind(this), this);
        this._window.connectObject(
            'notify::title', this._update_title.bind(this),
            'notify::wm-class', this._update_app.bind(this),
            'notify::gtk-application-id', this._update_app.bind(this),
            'notify::skip-taskbar', this._update_visibility.bind(this),
            'unmanaging', this._destroy.bind(this),
            'workspace-changed', this._on_workspace_changed.bind(this),
            this);

        this.connectObject(
            'button-press-event', (widget, event) => this._on_click(event),
            'notify::hover', this._on_hover.bind(this),
            'destroy', this._destroy.bind(this),
            this);
    }

    _on_workspace_changed() {
        if (!this._window || !this._window.get_workspace()) {
            return;
        }

        this._workspace_index = this._window.get_workspace().index();
        this._index = [this._workspace_index, this._window.get_id()];

        Main.panel._addToPanelBox(this._id, this, this._new_position(), Main.panel._leftBox)
    }

    _new_position() {
        let position = 0;

        for (let bin of Main.panel._leftBox) {
            let button = bin.first_child;
            if (!button || !button._index || this._index > button._index) {
                position++;
            }
        }

        return position;
    }

    _on_click(event) {
        if (event.get_button() == Clutter.BUTTON_PRIMARY) {
            this.menu.close();

            if (this._window.has_focus()) {
                if (this._window.can_minimize() && !Main.overview.visible) {
                    this._window.minimize();
                }
            } else  {
                this._window.activate(global.get_current_time());
                this._window.focus(global.get_current_time());
            }

            Main.overview.hide();
        }

        if (event.get_button() == Clutter.BUTTON_MIDDLE) {
            this.menu.close();

            if (this._app.can_open_new_window()) {
                this._app.open_new_window(-1);
            }

            Main.overview.hide();
        }
    }

    _on_hover() {
        if (!this._window) {
            return;
        }

        if (this.get_hover()) {
            this._raise_window_timeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._settings.get_int('raise-delay'), () => {
                if (this.get_hover()) {
                    if (this._settings.get_boolean('show-tooltip')) {
                        this._task_tooltip.set_position(this.get_transformed_position()[0], Main.layoutManager.primaryMonitor.y + Main.panel.height + TOOLTIP_VERTICAL_PADDING);
                        this._task_tooltip._label.set_text(this._window.get_title());
                        this._task_tooltip.show();
                    }

                    if (this._settings.get_boolean('raise-window')) {
                        this._window.raise();
                    }

                    this._raise_window_timeout = 0;
                }
            });
        } else {
            if (this._settings.get_boolean('show-tooltip')) {
                this._task_tooltip.hide();
            }

            if (this._settings.get_boolean('raise-window')) {
                if (global.display.get_focus_window()) {
                    global.display.get_focus_window().raise();
                }
            }

            this._raise_window_timeout = 0;
        }
    }

    _update_title() {
        this._label.set_text('  ' + this._window.get_title());
    }

    _update_app() {
        this._app = Shell.WindowTracker.get_default().get_window_app(this._window);

        if (this._app) {
            this._icon.set_gicon(this._app.get_icon());
            this.menu.setApp(this._app);
        }
    }

    _update_style() {
        if (this._settings.get_boolean('show-titles')) {
            this.add_style_class_name('window-button-' + this._settings.get_int('buttons-size'));
        }
        this._icon.visible = this._settings.get_boolean('show-icons');
        this._label.visible = this._settings.get_boolean('show-titles');

        if (this._settings.get_boolean('symbolic-icons')) {
            this._icon.set_style_class_name('app-menu-icon');
        }
        if (!this._settings.get_boolean('colored-icons')) {
            this.add_effect(this._desaturate_effect);
        }
    }

    _update_focus() {
        if (this._window.has_focus()) {
            if (this._settings.get_boolean('border-top')) {
                this.remove_style_class_name('window-unfocused-top');
                this.remove_style_class_name('window-unfocused-top-icon');
                this.add_style_class_name('window-focused-top');
            } else {
                this.remove_style_class_name('window-unfocused');
                this.add_style_class_name('window-focused');
            }
        } else {
            if (this._settings.get_boolean('border-top')) {
                this.remove_style_class_name('window-focused-top');
                if (this._settings.get_boolean('show-titles')) {
                    this.add_style_class_name('window-unfocused-top');
                } else {
                    this.add_style_class_name('window-unfocused-top-icon');
                }
            } else {
                this.remove_style_class_name('window-focused');
                this.add_style_class_name('window-unfocused');
            }
        }
    }

    _update_visibility() {
        this.visible = !this._window.is_skip_taskbar();

        let active_workspace = global.workspace_manager.get_active_workspace()
        let window_is_on_active_workspace = this._window.located_on_workspace(active_workspace);

        if (this._settings.get_boolean('active-workspace')) {
            this.visible = window_is_on_active_workspace;
        }

        if (window_is_on_active_workspace) {
            this.set_opacity(255);
        } else {
            this.set_opacity(this._settings.get_int('buttons-opacity'));
        }
    }

    _destroy() {
        if (this._raise_window_timeout) {
            GLib.source_remove(this._raise_window_timeout);
            this._raise_window_timeout = null;
        }

        global.display.disconnectObject(this);
        global.workspace_manager.disconnectObject(this);
        this._window.disconnectObject(this);

        if (this._task_tooltip) {
            this._task_tooltip.destroy();
        }
        this._task_tooltip = null;

        this._desaturate_effect = null;

        /*if (Main.panel.statusArea[this._id]) {
            delete Main.panel.statusArea[this._id];
        }
        this.menu = null;*/

        super.destroy();
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

const TaskBar = GObject.registerClass(
class TaskBar extends GObject.Object {
    _init(settings) {
        this._settings = settings;

        Main.panel._leftBox.add_style_class_name('leftbox-reduced-padding');

        this._show_places_icon(true);

        this._favorites_menu = new FavoritesMenu();
        Main.panel.addToStatusArea('favorites-menu', this._favorites_menu, 1, 'left');

        this._make_taskbar();
        this._connect_signals();
    }

    _make_task_button(window) {
        if (!window || window.is_skip_taskbar() || window.get_window_type() == Meta.WindowType.MODAL_DIALOG) {
            return;
        }

        new TaskButton(this._settings, window);
    }

    _make_workspace_button(workspace_index) {
        new WorkspaceButton(this._settings, workspace_index);
    }

    _destroy_taskbar() {
        for (let bin of Main.panel._leftBox.get_children()) {
            let button = bin.first_child;

            if (button instanceof TaskButton || button instanceof WorkspaceButton) {
                button._destroy();
                button = null;
            }
        }
    }

    _make_taskbar() {
        this._destroy_taskbar();

        this._show_activities(this._settings.get_boolean('show-activities'));
        this._show_favorites(this._settings.get_boolean('show-favorites'));

        let workspaces_number = global.workspace_manager.get_n_workspaces();

        for (let workspace_index = 0; workspace_index < workspaces_number; workspace_index++) {
            let workspace = global.workspace_manager.get_workspace_by_index(workspace_index);

            if (this._settings.get_boolean('active-workspace') && workspace != global.workspace_manager.get_active_workspace()) {
                continue;
            }

            if (!this._settings.get_boolean('active-workspace')) {
                this._make_workspace_button(workspace_index);
            }

            let windows_list = workspace.list_windows();

            for (let window of windows_list) {
                this._make_task_button(window);
            }
        }
    }

    _show_places_icon(show) {
        let places_indicator = Main.panel.statusArea['places-menu'];

        if (places_indicator) {
            places_indicator.remove_child(places_indicator.first_child);

            if (show) {
                let places_icon = new St.Icon({icon_name: 'folder-symbolic', style_class: 'system-status-icon'});
                places_indicator.add_child(places_icon);
            } else {
                let places_label = new St.Label({text: _('Places'), y_expand: true, y_align: Clutter.ActorAlign.CENTER});
                places_indicator.add_child(places_label);
            }
        }
    }

    _show_activities(show) {
        let activities_indicator = Main.panel.statusArea['activities'];

        if (activities_indicator) {
            activities_indicator.visible = show;
        }
    }

    _show_favorites(show) {
        if (this._favorites_menu) {
            this._favorites_menu.visible = show;
        }
    }

    _connect_signals() {
        global.display.connectObject('window-created', (display, window) => this._make_task_button(window), this);
        global.workspace_manager.connectObject('workspace-added', (workspace_manager, workspace_index) => this._make_workspace_button(workspace_index), this);

        Main.extensionManager.connectObject('extension-state-changed', () => this._show_places_icon(true), this);
        this._wm_settings = new Gio.Settings({schema: WORKSPACES_SCHEMA});
        this._wm_settings.connectObject(`changed::${WORKSPACES_KEY}`, this._make_taskbar.bind(this), this);

        this._settings.connectObject('changed', this._make_taskbar.bind(this), this);
    }

    _disconnect_signals() {
        this._settings.disconnectObject(this);
        this._wm_settings.disconnectObject(this);

        Main.extensionManager.disconnectObject(this);
        global.display.disconnectObject(this);
        global.workspace_manager.disconnectObject(this);
    }

    _destroy() {
        this._disconnect_signals();
        this._destroy_taskbar();

        this._favorites_menu._destroy();

        this._show_places_icon(false);
        Main.panel._leftBox.remove_style_class_name('leftbox-reduced-padding');

        this._show_activities(true);

        this._settings = null;
    }
});

export default class TaskUpExtension extends Extension {
    constructor(metadata) {
        super(metadata);
    }

    enable() {
        this._taskbar = new TaskBar(this.getSettings());
    }

    disable() {
        this._taskbar._destroy();
        this._taskbar = null;
    }
}

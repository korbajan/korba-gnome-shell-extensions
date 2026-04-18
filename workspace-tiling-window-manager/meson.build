e = 'workspace-tiling-window-manager'
uuid = e + uuid_suffix

conf = configuration_data()
conf.set('extension_id', e)
conf.set('uuid', uuid)
conf.set('gschemaname', 'org.gnome.shell.extensions.' + e)
conf.set('gettext_domain', meson.project_name())
conf.set('shell_current', shell_version)
conf.set('url', 'https://github.com/korbajan/korba-gnome-extensions')

metadata = configure_file(
  input: 'metadata.json.in',
  output: 'metadata.json',
  configuration: conf,
)

install_data(
  ['extension.js', 'prefs.js', metadata],
  install_dir: join_paths(extensiondir, uuid),
)

install_data(
  'org.gnome.shell.extensions.' + e + '.gschema.xml',
  install_dir: schemadir,
)

install_data(
  [
    'lib/layoutProvider.js',
    'lib/dwindleLayout.js',
    'lib/tilingManager.js',
    'lib/workspaceTiler.js',
    'lib/keybindingRow.js',
    'lib/utils.js',
  ],
  install_dir: join_paths(extensiondir, uuid, 'lib'),
)

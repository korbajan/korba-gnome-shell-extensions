project(
  'korba-gnome-extensions',
  version: '1.0',
  meson_version: '>= 1.1.0',
  license: 'GPL-2.0-or-later',
)

gnome = import('gnome')

datadir = get_option('datadir')
extensiondir = join_paths(datadir, 'gnome-shell', 'extensions')
schemadir = join_paths(datadir, 'glib-2.0', 'schemas')

uuid_suffix = '@korbajan.github.com'

shell_ver_result = run_command('gnome-shell', '--version', check: false)
if shell_ver_result.returncode() == 0
  shell_version = shell_ver_result.stdout().strip().split(' ')[-1].split('.')[0]
else
  shell_version = 'any'
endif

extensions = [
  'spatial-window-navigator',
]

foreach e : extensions
  subdir(e)
endforeach

gnome.post_install(glib_compile_schemas: true)

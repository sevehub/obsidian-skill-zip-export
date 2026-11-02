# Skill Zip Export

Exports a note as a Claude skill zip, with `SKILL.md` built from the note properties and the `scripts`, `references`, and `assets` subfolders included.

## Features

- Command **Export active note as Claude skill (zip)** creates `<name>.zip` containing `<name>/SKILL.md` and the optional subfolders.
- `name` and `description` are taken from the note properties; the note body becomes the skill instructions. Other properties (for example `model` and `temperature`) are not exported.
- New notes created directly in the configured skills folder receive the full subtree automatically.
- The destination of the zip can be a vault folder or any absolute path on disk.

## Requirements

- Obsidian desktop (version 1.5.0 or later). Mobile is not supported, because child processes are used.
- Windows: PowerShell (`Compress-Archive`), included with Windows.
- Linux and macOS: `bash` and `zip`. The `zip` tool is included with macOS and can be installed on most Linux distributions (for example `sudo apt install zip`).

## Installation

**Community plugins** (once listed): Settings, Community plugins, Browse, search for "Skill Zip Export", Install, Enable.

**Manual:** copy `main.js` and `manifest.json` from the latest release into `<vault>/.obsidian/plugins/skill-zip-export/`, reload Obsidian, and enable the plugin.

## Usage

### Note format

```markdown
---
name: my-skill
description: Does X when the user asks for Y. Use when Z.
---

Instructions of the skill. Additional files are referenced by relative
path, for example references/api.md.
```

- `name`: lowercase letters, numbers, and hyphens (other characters are converted; the file name is used if the property is missing).
- `description`: required, at most 1024 characters. It states what the skill does and when it applies.
- The note body must not be empty.

### Folder layout

```
Skills/my-skill/
  my-skill.md
  scripts/
  references/
  assets/
```

Resulting archive:

```
my-skill.zip
  my-skill/
    SKILL.md
    scripts/
    references/
    assets/
```

Only `scripts`, `references`, and `assets` next to the note are included. Files that Obsidian does not display (for example `.py` or `.ps1`) must be added through the file system; they are copied correctly.

### Automatic subtree

When a new note is created directly inside the skills folder, the plugin creates a folder named after the note, adds the three subfolders, and moves the note into the new folder. An empty note receives empty `name` and `description` properties. The folder keeps the note name at the time of creation; renaming the note later does not rename the folder, and the skill name is always read from the `name` property.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| Skills folder | `Skills` | Vault folder watched for new notes. Empty disables the automatic subtree. |
| Output folder | `Downloads` | Vault-relative folder or absolute path (for example `C:\Users\Name\skills` or `/home/name/skills`). |

## Upload to Claude

Settings, Capabilities, Skills, Upload skill (the wording may differ between versions).

## Limitations

- Desktop only.
- Older builds of Windows PowerShell 5.1 can write backslashes in archive paths; if an upload fails for this reason, replace `Compress-Archive` in `main.js` with `tar.exe -a -c -f`.

## License

MIT


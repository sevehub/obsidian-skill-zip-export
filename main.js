const {
  Plugin,
  PluginSettingTab,
  Setting,
  Notice,
  TFile,
  normalizePath,
} = require("obsidian");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");

const DEFAULTS = { outputFolder: "Downloads", skillsFolder: "Skills" };
const SUBFOLDERS = ["scripts", "references", "assets"];

// Zips <parentDir>/<folderName> into zipPath, keeping folderName as the archive root.
function zipFolder(parentDir, folderName, zipPath) {
  return new Promise((resolve, reject) => {
    const done = (err, stdout, stderr) =>
      err ? reject(new Error((stderr || err.message).trim())) : resolve();
    if (process.platform === "win32") {
      execFile(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "Compress-Archive -LiteralPath $env:SKILL_SRC -DestinationPath $env:SKILL_ZIP -Force",
        ],
        {
          env: {
            ...process.env,
            SKILL_SRC: path.join(parentDir, folderName),
            SKILL_ZIP: zipPath,
          },
        },
        done
      );
    } else {
      execFile(
        "bash",
        ["-c", 'cd "$1" && zip -rq "$2" "$3"', "bash", parentDir, zipPath, folderName],
        done
      );
    }
  });
}

module.exports = class SkillZipPlugin extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULTS, await this.loadData());
    this.addSettingTab(new SkillZipSettings(this.app, this));
    this.addCommand({
      id: "export-skill-zip",
      name: "Export active note as Claude skill (zip)",
      callback: () => this.exportSkill(),
    });
    // Registered after layout is ready, otherwise existing files fire "create" at startup.
    this.app.workspace.onLayoutReady(() => {
      this.registerEvent(this.app.vault.on("create", (f) => this.scaffold(f)));
    });
  }

  // New note directly inside the skills folder -> <note>/<note>.md plus subfolders.
  async scaffold(file) {
    if (!(file instanceof TFile) || file.extension !== "md") return;
    if (!this.settings.skillsFolder.trim()) return;
    const root = normalizePath(this.settings.skillsFolder);
    if (!file.parent || file.parent.path !== root) return;

    const dir = `${root}/${file.basename}`;
    if (this.app.vault.getAbstractFileByPath(dir)) return;

    const empty = (await this.app.vault.read(file)) === "";
    await this.app.vault.createFolder(dir);
    for (const sub of SUBFOLDERS) {
      await this.app.vault.createFolder(`${dir}/${sub}`);
    }
    await this.app.fileManager.renameFile(file, `${dir}/${file.name}`);

    if (empty) {
      await this.app.vault.modify(
        this.app.vault.getAbstractFileByPath(`${dir}/${file.name}`),
        "---\nname: \ndescription: \n---\n\n"
      );
    }
  }

  async exportSkill() {
    const file = this.app.workspace.getActiveFile();
    if (!file) return new Notice("No active note.");

    const cache = this.app.metadataCache.getFileCache(file);
    const fm = (cache && cache.frontmatter) || {};
    const raw = await this.app.vault.read(file);
    const end =
      cache && cache.frontmatterPosition ? cache.frontmatterPosition.end.offset : 0;
    const body = raw.slice(end).trim();

    const name = String(fm.name || file.basename)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64);
    const description = String(fm.description || "").replace(/\s+/g, " ").trim();

    if (!name) return new Notice("Skill name is empty.");
    if (!description) return new Notice("Property 'description' is required.");
    if (description.length > 1024) return new Notice("Description exceeds 1024 characters.");
    if (!body) return new Notice("Note body is empty.");

    const skillMd = `---\nname: ${name}\ndescription: ${JSON.stringify(description)}\n---\n\n${body}\n`;

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "skill-"));
    try {
      const base = this.app.vault.adapter.getBasePath();
      const dir = path.join(tmp, name);
      fs.mkdirSync(dir);
      fs.writeFileSync(path.join(dir, "SKILL.md"), skillMd, "utf8");

      // Additional material next to the note.
      const noteDir = path.join(base, path.dirname(file.path));
      for (const sub of SUBFOLDERS) {
        const src = path.join(noteDir, sub);
        if (fs.existsSync(src)) {
          fs.cpSync(src, path.join(dir, sub), { recursive: true });
        }
      }

      // Destination: absolute path, or folder relative to the vault.
      const outDir = path.isAbsolute(this.settings.outputFolder)
        ? this.settings.outputFolder
        : path.join(base, this.settings.outputFolder);
      fs.mkdirSync(outDir, { recursive: true });
      const zipPath = path.join(outDir, `${name}.zip`);
      fs.rmSync(zipPath, { force: true });

      await zipFolder(tmp, name, zipPath);
      new Notice(`Skill exported: ${zipPath}`);
    } catch (e) {
      console.error(e);
      new Notice(`Export failed: ${e.message}`, 8000);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
};

class SkillZipSettings extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    this.containerEl.empty();

    new Setting(this.containerEl)
      .setName("Skills folder")
      .setDesc("New notes created directly in this vault folder receive a skill subtree.")
      .addText((t) =>
        t.setValue(this.plugin.settings.skillsFolder).onChange(async (v) => {
          this.plugin.settings.skillsFolder = v.trim();
          await this.plugin.saveData(this.plugin.settings);
        })
      );

    new Setting(this.containerEl)
      .setName("Output folder")
      .setDesc("Vault-relative folder or absolute path that receives the zip files.")
      .addText((t) =>
        t.setValue(this.plugin.settings.outputFolder).onChange(async (v) => {
          this.plugin.settings.outputFolder = v.trim() || DEFAULTS.outputFolder;
          await this.plugin.saveData(this.plugin.settings);
        })
      );
  }
}

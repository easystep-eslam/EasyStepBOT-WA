// check-commands.js

// Usage: node check-commands.js

const fs = require("fs");

const path = require("path");

const ROOT = __dirname;

const COMMANDS_DIR = path.join(ROOT, "commands");

function walkJsFiles(dir) {

  let out = [];

  if (!fs.existsSync(dir)) return out;

  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {

    const p = path.join(dir, ent.name);

    if (ent.isDirectory()) out = out.concat(walkJsFiles(p));

    else if (ent.isFile() && ent.name.endsWith(".js")) out.push(p);

  }

  return out;

}

function rel(p) {

  return path.relative(ROOT, p).replace(/\\/g, "/");

}

function hintForMissingModule(modName, filePath) {

  // Some common wrong paths used in commands

  const r = rel(filePath);

  const depthFromCommands = (() => {

    // commands/<cat>/<file>.js -> depth=2, commands/<file>.js -> depth=1

    const parts = r.split("/");

    const idx = parts.indexOf("commands");

    if (idx === -1) return 0;

    return Math.max(0, parts.length - (idx + 1) - 1); // folders after commands before file

  })();

  const up = "../".repeat(depthFromCommands + 1); // from commands/... to project root

  const suggestions = [];

  // If it tried "../lib/lang" inside commands/general/foo.js, likely should be "../../lib/lang"

  if (modName.includes("lib/lang")) {

    suggestions.push(`جرّب بدلها: require('${up}lib/lang')`);

  }

  if (modName.includes("lib/isAdmin")) {

    suggestions.push(`جرّب بدلها: require('${up}lib/isAdmin')`);

  }

  if (modName.includes("settings")) {

    suggestions.push(`جرّب بدلها: require('${up}settings')`);

  }

  if (modName.includes("registry")) {

    suggestions.push(`ملف registry.js مش موجود غالباً — يا إما تضيفه أو تشيل الاعتماد عليه.`);

  }

  if (modName.includes("stickercrop")) {

    suggestions.push(`ملف stickercrop.js مش موجود غالباً — يا إما تضيفه أو تعطل أمر igs.`);

  }

  if (!suggestions.length) return null;

  return suggestions.join(" | ");

}

function classifyError(err) {

  const msg = String(err?.message || err);

  if (err?.code === "MODULE_NOT_FOUND" || msg.includes("Cannot find module")) return "MODULE_NOT_FOUND";

  if (msg.includes("Unexpected end of input")) return "SYNTAX_UNEXPECTED_END";

  if (msg.includes("Invalid or unexpected token")) return "SYNTAX_INVALID_TOKEN";

  if (msg.includes("Unexpected identifier")) return "SYNTAX_UNEXPECTED_IDENTIFIER";

  if (msg.includes("SyntaxError")) return "SYNTAX_ERROR";

  return "OTHER";

}

function pickExec(cmd) {

  return cmd?.exec || cmd?.execute || cmd?.run || null;

}

function safeRequire(filePath) {

  delete require.cache[require.resolve(filePath)];

  return require(filePath);

}

function main() {

  if (!fs.existsSync(COMMANDS_DIR)) {

    console.error("❌ commands/ folder not found:", COMMANDS_DIR);

    process.exit(1);

  }

  const files = walkJsFiles(COMMANDS_DIR);

  console.log(`📦 Scanning commands: ${files.length} file(s)\n`);

  let ok = 0;

  let bad = 0;

  const failed = [];

  for (const f of files) {

    const short = rel(f);

    try {

      const cmd = safeRequire(f);

      if (!cmd || !cmd.name) {

        // not fatal, but warn

        console.log(`⚠️  SKIP (no name): ${short}`);

        continue;

      }

      const execFn = pickExec(cmd);

      if (typeof execFn !== "function") {

        console.log(`⚠️  SKIP (no exec): ${short}  (name=${cmd.name})`);

        continue;

      }

      ok++;

      console.log(`✅ OK: ${short}  (name=${cmd.name})`);

    } catch (err) {

      bad++;

      const type = classifyError(err);

      const msg = String(err?.message || err);

      // Try to detect missing module name from error message

      let missing = null;

      const m = msg.match(/Cannot find module '([^']+)'/);

      if (m) missing = m[1];

      const hint = missing ? hintForMissingModule(missing, f) : null;

      failed.push({

        file: short,

        type,

        message: msg,

        missing,

        hint,

        stack: String(err?.stack || "").split("\n").slice(0, 8).join("\n"),

      });

      console.log(`❌ FAIL: ${short}`);

      console.log(`   ↳ ${type}: ${msg}`);

      if (missing) console.log(`   ↳ missing: ${missing}`);

      if (hint) console.log(`   ↳ hint: ${hint}`);

      console.log("");

    }

  }

  console.log("\n==================== SUMMARY ====================");

  console.log(`✅ Loaded: ${ok}`);

  console.log(`❌ Failed: ${bad}`);

  console.log("=================================================\n");

  if (failed.length) {

    // Write report file for easy copy

    const reportPath = path.join(ROOT, "check-commands-report.txt");

    const lines = [];

    for (const x of failed) {

      lines.push(`FILE: ${x.file}`);

      lines.push(`TYPE: ${x.type}`);

      if (x.missing) lines.push(`MISSING: ${x.missing}`);

      if (x.hint) lines.push(`HINT: ${x.hint}`);

      lines.push(`MESSAGE: ${x.message}`);

      lines.push(`STACK:\n${x.stack}`);

      lines.push("-------------------------------------------------\n");

    }

    fs.writeFileSync(reportPath, lines.join("\n"), "utf8");

    console.log(`📝 Report saved: ${rel(reportPath)}`);

    console.log("افتحه وشوف كل ملف واقع + السبب.");

  }

}

main();
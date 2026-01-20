const fs = require("fs");

const path = require("path");

function loadCommands() {

  const commands = new Map();

  const commandsPath = path.join(__dirname, "../commands");

  const files = fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"));

  for (const file of files) {

    const filePath = path.join(commandsPath, file);

    delete require.cache[require.resolve(filePath)];

    const cmd = require(filePath);

    if (!cmd?.name || (!cmd.execute && !cmd.exec)) continue;
    commands.set(cmd.name, cmd);

    if (Array.isArray(cmd.aliases)) {

      for (const alias of cmd.aliases) {

        commands.set(alias, cmd);

      }

    }

    console.log(`✅ Loaded command: ${cmd.name}`);

  }

  return commands;

}

module.exports = loadCommands;
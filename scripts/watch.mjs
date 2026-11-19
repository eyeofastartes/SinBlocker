import { watch } from "node:fs";
import { cp, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = new URL("../src/", import.meta.url);
const extension = new URL("../extension/", import.meta.url);

async function copyUi() {
  for (const filename of await readdir(source)) {
    if (/\.(html|js)$/.test(filename)) {
      await cp(new URL(filename, source), new URL(filename, extension));
    }
  }
}

await copyUi();
const watcher = watch(source, () => {
  copyUi().catch((error) => {
    console.error(error);
    process.exitCode = 1;
    watcher.close();
    tailwind.kill();
  });
});
const tailwind = spawn(process.execPath, [
  "node_modules/@tailwindcss/cli/dist/index.mjs",
  "-i", "src/input.css", "-o", "extension/main.css", "--watch=always",
], { cwd: root, stdio: "inherit" });
tailwind.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
  watcher.close();
});
tailwind.on("exit", (code) => {
  watcher.close();
  process.exitCode = code || 0;
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    watcher.close();
    tailwind.kill(signal);
  });
}

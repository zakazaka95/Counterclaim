import { existsSync } from 'node:fs';
export const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || 'C:/Users/yyzar/.codex/toolchains/motion-studio/browser-cache/remotion-149/chrome-headless-shell-win64/chrome-headless-shell.exe';
if (!existsSync(browserExecutable)) throw new Error('Set REMOTION_BROWSER_EXECUTABLE to a compatible Chrome Headless Shell. See README.');

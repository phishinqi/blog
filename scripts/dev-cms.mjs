// One command for local writing.
//
// The editor runs inside the dev server and edits the working tree directly through the browser,
// so there is no second process to start: v7-cms needs no local proxy.
import { spawn } from 'node:child_process';

const child = spawn(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['dev'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
console.log('\n写作后台 / Editor: http://localhost:4321/admin/  (Ctrl+C 结束 / to stop)\n');

const stop = () => {
  if (!child.killed) child.kill();
};
child.on('exit', (code) => {
  process.exitCode = code ?? 0;
});
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

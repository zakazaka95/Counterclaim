import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';

export class AgentProcess {
  constructor() {
    this.pending = new Map();
    this.child = fork(new URL('./participant-worker.mjs', import.meta.url), [], {stdio: ['ignore', 'ignore', 'ignore', 'ipc']});
    this.child.on('message', (message) => {
      const item = this.pending.get(message.id);
      if (!item) return;
      clearTimeout(item.timer); this.pending.delete(message.id);
      if (message.error) item.reject(new Error(message.error.message)); else item.resolve(message.result);
    });
    this.child.on('exit', () => {
      for (const item of this.pending.values()) { clearTimeout(item.timer); item.reject(new Error('Demo participant process exited.')); }
      this.pending.clear();
    });
  }
  call(method, args = {}) {
    return new Promise((resolve, reject) => {
      const id = randomUUID();
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('Yellow ' + method + ' timed out; read the live session before retrying.')); }, 20000);
      this.pending.set(id, {resolve, reject, timer});
      this.child.send({id, method, args});
    });
  }
  async disconnect() { try { await this.call('disconnect'); } finally { this.child.disconnect(); } }
}

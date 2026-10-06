import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ATLAS_NAME = 'refinery-decal-trim-atlas.png';
const ATLAS_PATH = resolve(process.cwd(), 'public/assets/models/environments', ATLAS_NAME);

class NodeGlbXMLHttpRequest {
  constructor() {
    this.readyState = 0;
    this.status = 0;
    this.statusText = '';
    this.response = null;
    this.responseText = '';
    this.responseType = '';
    this.responseURL = '';
    this.timeout = 0;
    this.withCredentials = false;
    this.onreadystatechange = null;
    this.onload = null;
    this.onloadend = null;
    this.onerror = null;
    this.ontimeout = null;
    this.onprogress = null;
    this._url = '';
    this._listeners = new Map();
  }

  open(_method, url) {
    this._url = String(url);
    this.responseURL = this._url;
    this.readyState = 1;
    this._emit('readystatechange');
  }

  setRequestHeader() {}
  getResponseHeader() { return null; }
  getAllResponseHeaders() { return ''; }
  overrideMimeType() {}
  abort() {}

  addEventListener(type, listener) {
    const listeners = this._listeners.get(type) ?? new Set();
    listeners.add(listener);
    this._listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this._listeners.get(type)?.delete(listener);
  }

  _emit(type, event = {}) {
    const payload = { target: this, currentTarget: this, type, ...event };
    const handler = this[`on${type}`];
    if (typeof handler === 'function') handler.call(this, payload);
    for (const listener of this._listeners.get(type) ?? []) listener.call(this, payload);
  }

  async send() {
    try {
      if (!this._url.endsWith(ATLAS_NAME)) {
        throw new Error(`Unexpected Node GLB external request: ${this._url}`);
      }
      const data = await readFile(ATLAS_PATH);
      this.status = 200;
      this.statusText = 'OK';
      this.readyState = 4;
      if (this.responseType === 'arraybuffer') {
        this.response = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        this.responseText = '';
      } else {
        this.responseText = data.toString('utf8');
        this.response = this.responseText;
      }
      this._emit('progress', { lengthComputable: true, loaded: data.byteLength, total: data.byteLength });
      this._emit('readystatechange');
      this._emit('load');
      this._emit('loadend');
    } catch (error) {
      this.status = 404;
      this.statusText = 'Not Found';
      this.readyState = 4;
      this._emit('readystatechange');
      this._emit('error', { error });
      this._emit('loadend');
    }
  }
}

if (typeof globalThis.XMLHttpRequest === 'undefined') {
  globalThis.XMLHttpRequest = NodeGlbXMLHttpRequest;
}

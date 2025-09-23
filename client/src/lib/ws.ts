
type Listener = (data: any) => void;

class WSBus {
  ws?: WebSocket;
  listeners: Record<string, Listener[]> = {};
  private _connecting = false;

  connect() {
    // idempotent: don't create multiple connections
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    if (this._connecting) return;
    this._connecting = true;
    const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host.replace(':5173', ':3001');
    this.ws = new WebSocket(url);
    this.ws.onopen = () => { this._connecting = false; };
    this.ws.onmessage = (ev) => {
      try {
        const { event, data } = JSON.parse(ev.data);
        (this.listeners[event] || []).forEach(fn => fn(data));
      } catch {}
    };
    this.ws.onclose = () => {
      this._connecting = false;
      setTimeout(() => this.connect(), 1000);
    };
  }

  on(event: string, fn: Listener) {
    const arr = this.listeners[event] || (this.listeners[event] = []);
    if (!arr.includes(fn)) arr.push(fn);
    // return unsubscribe
    return () => {
      this.listeners[event] = (this.listeners[event] || []).filter(x => x !== fn);
    };
  }
}

export const bus = new WSBus();

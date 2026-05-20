# SHOPIFY REMOTE DOM — TABLET OF CAVE-MAN

## OOGA: PROBLEM

Cave-man have shop. Cave-man want other cave-man (third-party) put button in shop. But other cave-man code DANGEROUS — maybe steal banana, maybe break fire, maybe touch shaman customer data.

Solution: put other cave-man in SEPARATE CAVE (Web Worker, iframe). Other cave no can touch real DOM. Real DOM live in MAIN CAVE.

But other cave still want make button, list, card. How??

**Shopify Remote DOM** = bridge between two cave. Other cave PRETEND make DOM. Main cave HEAR pretend, build REAL DOM. Two cave talk by throwing rocks (`postMessage`).

---

## OOGA: HOW WORK

```
+----------------------+        rocks         +----------------------+
|   SANDBOX CAVE       |  <---------------->  |   HOST CAVE          |
|   (Worker / iframe)  |  mutation messages   |   (main page)        |
|                      |                      |                      |
|  Fake DOM tree       |   appendChild        |  RemoteReceiver      |
|  RemoteElement       |   setAttribute       |  + tree mirror       |
|  RemoteText          |   removeChild        |                      |
|                      |   dispatchEvent <--  |  Real DOM elements   |
|  Other cave-man      |                      |  (button, card,...)  |
|  code run here       |                      |  user click here     |
+----------------------+                      +----------------------+
```

Four big rock:

1. **Remote tree** — fake DOM in worker. Look like real DOM (have `appendChild`, `setAttribute`, `addEventListener`) but no paint pixel.
2. **RemoteConnection** — pipe to throw rock between cave. Use `postMessage` under hood.
3. **Mutation message** — every time fake DOM change, worker throw rock: `["INSERT_CHILD", parentId, childNode, index]`, `["UPDATE_PROPERTY", id, key, value]`, `["REMOVE_CHILD", parentId, index]`.
4. **RemoteReceiver** — in host cave. Catch rock. Keep mirror tree. Tell renderer (React, vanilla, Preact) "make real button here".

Event go BACKWARD same way. User finger poke real button → host catch click → host throw rock back to worker → worker call callback on fake node. Same pipe, other direction.

---

## CORE CODE — TWO CAVE TALK

### Worker cave (sandbox) — pretend make DOM

```js
// worker.js
import {
  RemoteRootElement,
  RemoteElement,
  createRemoteElement,
} from '@remote-dom/core/elements';
import { RemoteMutationObserver } from '@remote-dom/core/elements';

// 1. Define fake element kinds matching what host knows
const RemoteButton = createRemoteElement({
  properties: { label: { type: String } },
  events: { press: {} },
});
customElements.define('ui-button', RemoteButton);

// 2. Make root that watches mutations
const root = document.createElement('remote-root');
const observer = new RemoteMutationObserver(root);

// 3. Open pipe to host cave via postMessage rocks
observer.connect({
  mutate(records) {
    self.postMessage({ type: 'mutate', records });
  },
  call(id, method, args) {
    // host call function on remote node (e.g. event listener)
  },
});

// 4. Use fake DOM like real DOM — but it just sends rocks
const button = document.createElement('ui-button');
button.label = 'EAT BANANA';
button.addEventListener('press', () => {
  console.log('OOGA BOOGA, banana eaten in worker cave');
});
root.appendChild(button);
// ^ each line above => postMessage to host with mutation record
```

### Host cave (main page) — catch rock, make real fire

```js
// host.js
import { DOMRemoteReceiver } from '@remote-dom/core/receivers';

// 1. Spawn worker cave
const worker = new Worker('worker.js', { type: 'module' });

// 2. Map fake element name -> real custom element / component
class RealButton extends HTMLElement {
  static get remoteProperties() { return ['label']; }
  connectedCallback() {
    this.innerHTML = `<button>${this.label ?? ''}</button>`;
    this.querySelector('button').onclick = () => {
      // fire event back to remote node
      this.dispatchEvent(new CustomEvent('press'));
    };
  }
}
customElements.define('ui-button', RealButton);

// 3. Receiver mirrors remote tree into real DOM
const receiver = new DOMRemoteReceiver();
receiver.connect(document.getElementById('app'));

// 4. Wire pipe: worker rock -> receiver
worker.addEventListener('message', (event) => {
  if (event.data.type === 'mutate') {
    receiver.connection.mutate(event.data.records);
  }
});

// 5. Wire pipe back: host event -> worker
//    receiver.connection.call(remoteId, 'press', [eventObj])
//    becomes: worker.postMessage({ type: 'call', ... })
```

That all. Big secret of Remote DOM = **two cave, one pipe, rocks both ways**.

---

## "REMOTE DOM RUN ON WORKER, SO NEED HOST APP MECHANISM TOO?"

YES. Three thing host MUST do, or remote tree just lonely fake tree in worker cave:

### 1. **Receiver** — catch mutation rock and keep mirror
Host run `RemoteReceiver` (or `DOMRemoteReceiver`, or framework one like `@remote-dom/react`). Every postMessage from worker = one tree edit. Receiver apply edit to mirror tree.

```js
const receiver = new DOMRemoteReceiver();
worker.onmessage = (e) => receiver.connection.mutate(e.data.records);
```

### 2. **Component map / element registry** — translate fake to real
Worker say `<ui-button>`. Host must know: "ui-button = THIS real component". Without map, host see ghost. With map:

```js
// vanilla — custom elements registered with same tag name
customElements.define('ui-button', MyRealButton);

// or React flavor
import { createRemoteComponentRenderer } from '@remote-dom/react/host';
const components = new Map([
  ['ui-button', createRemoteComponentRenderer(MyReactButton)],
]);
<RemoteRootRenderer receiver={receiver} components={components} />
```

### 3. **Event bridge back to worker** — finger poke must travel home
When user click real button, host serialize event info and call back to remote node. Receiver already give you `connection.call(id, method, args)` — that method post rock back to worker, worker look up node by id, fire local listener.

```js
// in host's RealButton
btn.onclick = (e) => this.dispatchEvent(new CustomEvent('press', { detail: { x: e.clientX } }));
// receiver sees dispatchEvent on a remote element, posts to worker:
//   { type: 'call', id: 42, method: 'press', args: [{ x: 17 }] }
// worker resolves node 42, runs the addEventListener callback
```

### Bonus rock: **transport** — what carry the rocks
For Worker = `postMessage` + `onmessage`. For iframe = `window.postMessage` + `MessageChannel` port. For server (Shopify UI extensions) = WebSocket. Remote DOM no care — just give it `{ send, listen }` shape, it work.

---

## SHAMAN WISDOM (summary)

- Remote DOM = **sandbox builds fake DOM, host renders real DOM, postMessage carries diffs**.
- Worker side = `RemoteRootElement` + `RemoteMutationObserver`.
- Host side = `RemoteReceiver` + **component map** + **event bridge** + **transport**.
- Without host part, worker is just talking to wall. Both cave needed.
- Why bother? Untrusted third-party code can build UI safely. Same model power Shopify Checkout UI Extensions, App Bridge, and React Native–style "render in JS, native does paint".

OOGA. End tablet.

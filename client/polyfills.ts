
globalThis.Buffer = require('buffer').Buffer
// globalThis.process = { browser: true }
const processObj = {
    browser: true,
    env: {},
}
Reflect.defineProperty(globalThis, 'process', { value: processObj })

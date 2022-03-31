// Webpack did not want to import this from worker-provider in index.tsx
// it does not recognise the import - no idea why!
export const webWorker = new Worker(new URL("./worker.ts", import.meta.url));

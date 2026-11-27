/**
 * Transformers.js Web Worker
 *
 * Runs model inference off the main thread so the UI stays responsive.
 * The @browser-ai/transformers-js handler manages model loading,
 * streaming, and communication with the main thread.
 */

import { TransformersJSWorkerHandler } from '@browser-ai/transformers-js';

const handler = new TransformersJSWorkerHandler();
self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg);
};

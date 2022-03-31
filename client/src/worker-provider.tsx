import React, { createContext, PropsWithChildren } from "react";
import * as Comlink from "comlink";
import { webWorker } from './web-worker';

const WorkerContext = createContext(null);

type WorkerProviderProps = PropsWithChildren<Record<string, unknown>>;

const worker = Comlink.wrap(webWorker);

const WorkerProvider = (props: WorkerProviderProps) => {
  return (
    <WorkerContext.Provider value={worker}>
      {props.children}
    </WorkerContext.Provider>
  );
};

export { WorkerContext };
export default WorkerProvider;

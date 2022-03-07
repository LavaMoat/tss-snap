import React, { createContext, PropsWithChildren } from "react";
import * as Comlink from "comlink";

const WorkerContext = createContext(null);
export { WorkerContext };

type WorkerProviderProps = PropsWithChildren<Record<string, unknown>>;

const worker = Comlink.wrap(
  new Worker(new URL("./worker.ts", import.meta.url))
);

const WorkerProvider = (props: WorkerProviderProps) => {
  return (
    <WorkerContext.Provider value={worker}>
      {props.children}
    </WorkerContext.Provider>
  );
};

export default WorkerProvider;

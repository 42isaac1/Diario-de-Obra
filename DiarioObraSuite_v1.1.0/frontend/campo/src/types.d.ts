declare namespace JSX { interface IntrinsicElements { [elemName: string]: any } }
declare namespace React {
  type SetStateAction<T> = T | ((prev: T) => T);
  type Dispatch<T> = (value: T) => void;
  type ChangeEvent<T = any> = any;
  type FormEvent<T = any> = any;
  type MouseEvent<T = any> = any;
  function useState<T>(initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>];
  function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  function useMemo<T>(factory: () => T, deps: any[]): T;
  function useRef<T>(initial: T): { current: T };
  function createElement(type: any, props: any, ...children: any[]): any;
  const Fragment: any;
}
declare const React: {
  useState: typeof React.useState;
  useEffect: typeof React.useEffect;
  useMemo: typeof React.useMemo;
  useRef: typeof React.useRef;
  createElement: typeof React.createElement;
  Fragment: typeof React.Fragment;
};
declare const ReactDOM: { createRoot(element: Element): { render(node: any): void } };
declare const PDFLib: any;
declare const JSZip: any;

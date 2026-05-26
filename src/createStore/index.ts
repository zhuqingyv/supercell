import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { shallow } from "zustand/shallow";

type ImmerStoreApi<T> = Omit<ReturnType<typeof create<T>> & StoreApi<T>, "setState"> & {
    setState: (nextStateOrUpdater: T | Partial<T> | ((state: T) => void), replace?: boolean) => void;
};

type SelectorWatchOptions<U> = {
    equalityFn?: (a: U, b: U) => boolean;
    fireImmediately?: boolean;
};

function buildStoreInterface<T extends object, A extends object>(
    useStateBase: ReturnType<typeof create<T>>,
    storeApi: ImmerStoreApi<T>,
    actions: A,
) {
    const useActions = () => actions;

    function useSelector<U>(selectorFn: (state: T) => U): { state: U; actions: A } {
        // 使用 useRef 稳定 selector 引用，避免每次渲染创建新函数导致 Zustand 重新 subscribe。
        // Immer middleware 每次产生新对象引用，所以必须配合 shallow equality（Zustand 默认用 ===）。
        const selectorRef = useRef(selectorFn);
        selectorRef.current = selectorFn;

        const selectedState = useStateBase(
            (state) => selectorRef.current(state),
            // Zustand store hook signature: useStore(store, selector, equalityFn?)
            // 传入 shallow 做值比较而非引用比较，immer 产生新引用时也能正确去重。
            shallow as any,
        );

        return useMemo(() => ({ state: selectedState, actions }), [selectedState]);
    }

    function useSelectorWatch<U>(
        selector: (state: T) => U,
        callback: (next: U, prev: U) => void,
        options?: SelectorWatchOptions<U>,
    ) {
        const selectorRef = useRef(selector);
        const callbackRef = useRef(callback);
        const optionsRef = useRef(options);
        const prevSelectedRef = useRef<U>(selector(storeApi.getState()));
        const rafIdRef = useRef<number>(0);

        // 同步最新值到 ref，用 useLayoutEffect 避免 React Compiler 的 render 阶段 ref 写入限制
        useLayoutEffect(() => {
            selectorRef.current = selector;
            callbackRef.current = callback;
            optionsRef.current = options;
        });

        useEffect(() => {
            const initialSelected = selectorRef.current(storeApi.getState());
            prevSelectedRef.current = initialSelected;

            if (optionsRef.current?.fireImmediately === true) {
                callbackRef.current(initialSelected, initialSelected);
            }

            return storeApi.subscribe((nextState) => {
                if (rafIdRef.current) {
                    cancelAnimationFrame(rafIdRef.current);
                }
                rafIdRef.current = requestAnimationFrame(() => {
                    const nextSelected = selectorRef.current(nextState);
                    const equalityFn = optionsRef.current?.equalityFn ?? shallow;
                    const prevSelected = prevSelectedRef.current;

                    if (!equalityFn(nextSelected, prevSelected)) {
                        prevSelectedRef.current = nextSelected;
                        callbackRef.current(nextSelected, prevSelected);
                    }
                    rafIdRef.current = 0;
                });
            });
        }, []);

        useEffect(() => {
            // selector 变化时重置 prev，避免用旧 selector 输出做对比导致误触发
            prevSelectedRef.current = selectorRef.current(storeApi.getState());
        }, [selector]);
    }

    return { setState: storeApi.setState, getState: storeApi.getState, useActions, useSelector, useSelectorWatch } as {
        setState: typeof storeApi.setState;
        getState: () => T;
        useActions: () => A;
        useSelector: typeof useSelector;
        useSelectorWatch: typeof useSelectorWatch;
    };
}

export const createLocalStore = <T extends object, A extends object>(
    key: string,
    initState: T,
    actionsGenerator?: (api: ImmerStoreApi<T>) => A,
) => {
    const useStateBase = create<T>()(
      persist(immer(() => initState), {
        name: key,
        // 节流 localStorage 写入，避免 streaming 时高频序列化
        throttle: 1000,
        // 只持久化必要字段，isLoading 等运行时状态不写入
        partialize: (state) => {
          const { isLoading, ...rest } = state as any;
          return rest;
        },
      }),
    );
    const storeApi = useStateBase as unknown as ImmerStoreApi<T>;
    const actions = actionsGenerator ? actionsGenerator(storeApi) : ({} as A);
    return buildStoreInterface(useStateBase as unknown as ReturnType<typeof create<T>>, storeApi, actions);
};

export const createStore = <T extends object, A extends object>(
    initState: T,
    actionsGenerator?: (api: ImmerStoreApi<T>) => A,
) => {
    const useStateBase = create<T>()(immer(() => initState));
    const storeApi = useStateBase as unknown as ImmerStoreApi<T>;
    const actions = actionsGenerator ? actionsGenerator(storeApi) : ({} as A);
    return buildStoreInterface(useStateBase as unknown as ReturnType<typeof create<T>>, storeApi, actions);
};

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { useShallow } from "zustand/react/shallow";
import { shallow } from "zustand/shallow";
import type { UseBoundStore, StoreApi } from "zustand";

type ImmerStoreApi<T> = Omit<StoreApi<T>, "setState"> & {
    setState: (nextStateOrUpdater: T | Partial<T> | ((state: T) => void), replace?: boolean) => void;
};

type SelectorWatchOptions<U> = {
    equalityFn?: (a: U, b: U) => boolean;
    fireImmediately?: boolean;
};

function buildStoreInterface<T extends object, A extends object>(
    useStateBase: UseBoundStore<StoreApi<T>>,
    storeApi: ImmerStoreApi<T>,
    actions: A,
) {
    const useActions = () => actions;

    function useSelector<U>(selector: (state: T) => U): { state: U; actions: A } {
        const selectedState = useStateBase(useShallow(selector));
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
                const nextSelected = selectorRef.current(nextState);
                const equalityFn = optionsRef.current?.equalityFn ?? shallow;
                const prevSelected = prevSelectedRef.current;

                if (!equalityFn(nextSelected, prevSelected)) {
                    prevSelectedRef.current = nextSelected;
                    callbackRef.current(nextSelected, prevSelected);
                }
            });
        }, []);

        useEffect(() => {
            // selector 变化时重置 prev，避免用旧 selector 输出做对比导致误触发
            prevSelectedRef.current = selectorRef.current(storeApi.getState());
        }, [selector]);
    }

    function useStore<U = T>(selector?: (state: T) => U): { state: U; actions: A } {
        const finalSelector = selector ?? ((s: T) => s as unknown as U);
        return useSelector(finalSelector);
    }

    return {
        useState: useStateBase,
        useActions,
        useSelector,
        useSelectorWatch,
        useStore,
        getState: storeApi.getState,
        setState: storeApi.setState,
    };
}

export const createLocalStore = <T extends object, A extends object>(
    key: string,
    initState: T,
    actionsGenerator?: (api: ImmerStoreApi<T>) => A,
) => {
    const useStateBase = create<T>()(persist(immer(() => initState), { name: key }));
    const storeApi = useStateBase as unknown as ImmerStoreApi<T>;
    const actions = actionsGenerator ? actionsGenerator(storeApi) : ({} as A);
    return buildStoreInterface(useStateBase as unknown as UseBoundStore<StoreApi<T>>, storeApi, actions);
};

export const createStore = <T extends object, A extends object>(
    initState: T,
    actionsGenerator?: (api: ImmerStoreApi<T>) => A,
) => {
    const useStateBase = create<T>()(immer(() => initState));
    const storeApi = useStateBase as unknown as ImmerStoreApi<T>;
    const actions = actionsGenerator ? actionsGenerator(storeApi) : ({} as A);
    return buildStoreInterface(useStateBase as unknown as UseBoundStore<StoreApi<T>>, storeApi, actions);
};

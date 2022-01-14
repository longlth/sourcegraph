const incrementedLocalStorageKeys = new Map<string, number>()

export function usePersistentCadence(localStorageKey: string, cadence: number): boolean {
    if (!incrementedLocalStorageKeys.has(localStorageKey)) {
        const pageViewCount = parseInt(localStorage.getItem(localStorageKey) || '', 10) || 0
        localStorage.setItem(localStorageKey, (pageViewCount + 1).toString())
        incrementedLocalStorageKeys.set(localStorageKey, pageViewCount)
        return pageViewCount % cadence === 0
    }

    const pageViewCount = incrementedLocalStorageKeys.get(localStorageKey) || 0
    return pageViewCount % cadence === 0
}

export function reset(): void {
    incrementedLocalStorageKeys.clear()
}

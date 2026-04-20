import { DecorationManager } from './decorationManager.js';

class FakeEmitter {
    constructor() {
        this._handlers = new Map();
        this._nextId = 1;
    }

    connect(signal, handler) {
        const id = this._nextId++;
        if (!this._handlers.has(signal)) this._handlers.set(signal, new Map());
        this._handlers.get(signal).set(id, handler);
        return id;
    }

    disconnect(id) {
        for (const map of this._handlers.values()) map.delete(id);
    }

    get liveHandlerCount() {
        let count = 0;
        for (const map of this._handlers.values()) count += map.size;
        return count;
    }
}

describe('DecorationManager lifecycle (Constitution III)', () => {
    let display;
    let manager;

    beforeEach(() => {
        display = new FakeEmitter();
        manager = new DecorationManager(null, { display });
    });

    it('starts with zero signal handles', () => {
        expect(manager.getSignalHandleCount()).toBe(0);
    });

    it('registers listeners on enable()', () => {
        manager.enable();
        expect(manager.getSignalHandleCount()).toBeGreaterThan(0);
        expect(display.liveHandlerCount).toBe(manager.getSignalHandleCount());
    });

    it('drains all signal handles on disable()', () => {
        manager.enable();
        manager.disable();
        expect(manager.getSignalHandleCount()).toBe(0);
        expect(display.liveHandlerCount).toBe(0);
    });

    it('can be re-enabled after disable without leaking', () => {
        manager.enable();
        const countAfterFirst = manager.getSignalHandleCount();
        manager.disable();
        manager.enable();
        expect(manager.getSignalHandleCount()).toBe(countAfterFirst);
        expect(display.liveHandlerCount).toBe(countAfterFirst);
    });

    it('calls registry.disableAll() exactly once during disable()', () => {
        manager.enable();
        let disableAllCalls = 0;
        const origDisableAll = manager._registry.disableAll.bind(manager._registry);
        manager._registry.disableAll = () => {
            disableAllCalls++;
            origDisableAll();
        };
        manager.disable();
        expect(disableAllCalls).toBe(1);
    });
});

import { WindowRegistry } from './windowRegistry.js';

function makeWindow(decorated = true) {
    return {
        get_decorated: () => decorated,
        set_decorated: jasmine.createSpy('set_decorated'),
        get_frame_rect: () => ({ x: 100, y: 50, width: 800, height: 600 }),
    };
}

describe('WindowRegistry', () => {
    let registry;

    beforeEach(() => {
        registry = new WindowRegistry();
    });

    describe('attach()', () => {
        it('creates a record with userOverrode=false', () => {
            const win = makeWindow(true);
            registry.attach(win);
            const record = registry.get(win);
            expect(record).toBeDefined();
            expect(record.userOverrode).toBe(false);
        });

        it('captures originalDecorated from the window', () => {
            const win = makeWindow(true);
            registry.attach(win);
            expect(registry.get(win).originalDecorated).toBe(true);
        });

        it('captures originalDecorated=false when window is undecorated', () => {
            const win = makeWindow(false);
            registry.attach(win);
            expect(registry.get(win).originalDecorated).toBe(false);
        });

        it('captures originalFrameRect', () => {
            const win = makeWindow(true);
            registry.attach(win);
            const rect = registry.get(win).originalFrameRect;
            expect(rect).toEqual({ x: 100, y: 50, width: 800, height: 600 });
        });

        it('initialises signalHandles as empty array', () => {
            const win = makeWindow();
            registry.attach(win);
            expect(registry.get(win).signalHandles).toEqual([]);
        });
    });

    describe('toggleOverride()', () => {
        it('flips userOverrode from false to true', () => {
            const win = makeWindow();
            registry.attach(win);
            registry.toggleOverride(win);
            expect(registry.get(win).userOverrode).toBe(true);
        });

        it('flips userOverrode from true to false', () => {
            const win = makeWindow();
            registry.attach(win);
            registry.toggleOverride(win);
            registry.toggleOverride(win);
            expect(registry.get(win).userOverrode).toBe(false);
        });

        it('is a no-op for unregistered windows', () => {
            const win = makeWindow();
            expect(() => registry.toggleOverride(win)).not.toThrow();
        });
    });

    describe('applyDefaultPolicy()', () => {
        it('calls the callback for windows without an override', () => {
            const win = makeWindow();
            registry.attach(win);
            const cb = jasmine.createSpy('cb');
            registry.applyDefaultPolicy('hidden', cb);
            expect(cb).toHaveBeenCalledWith(win, 'hidden');
        });

        it('skips windows where userOverrode=true (FR-021)', () => {
            const win = makeWindow();
            registry.attach(win);
            registry.toggleOverride(win);
            const cb = jasmine.createSpy('cb');
            registry.applyDefaultPolicy('hidden', cb);
            expect(cb).not.toHaveBeenCalled();
        });

        it('applies to multiple non-overridden windows', () => {
            const win1 = makeWindow();
            const win2 = makeWindow();
            registry.attach(win1);
            registry.attach(win2);
            registry.toggleOverride(win1);
            const cb = jasmine.createSpy('cb');
            registry.applyDefaultPolicy('visible', cb);
            expect(cb).toHaveBeenCalledTimes(1);
            expect(cb).toHaveBeenCalledWith(win2, 'visible');
        });
    });

    describe('detach()', () => {
        it('removes the record', () => {
            const win = makeWindow();
            registry.attach(win);
            registry.detach(win);
            expect(registry.get(win)).toBeUndefined();
        });

        it('calls disconnect on stored signal handles', () => {
            const win = makeWindow();
            registry.attach(win);
            const obj = { disconnect: jasmine.createSpy('disconnect') };
            registry.get(win).signalHandles.push({ obj, id: 42 });
            registry.detach(win);
            expect(obj.disconnect).toHaveBeenCalledWith(42);
        });

        it('is a no-op for unregistered windows', () => {
            expect(() => registry.detach(makeWindow())).not.toThrow();
        });
    });

    describe('disableAll()', () => {
        it('restores original decorated state for each window (FR-011)', () => {
            const win1 = makeWindow(true);
            const win2 = makeWindow(false);
            registry.attach(win1);
            registry.attach(win2);
            registry.disableAll();
            expect(win1.set_decorated).toHaveBeenCalledWith(true);
            expect(win2.set_decorated).toHaveBeenCalledWith(false);
        });

        it('clears the registry after disable', () => {
            const win = makeWindow();
            registry.attach(win);
            registry.disableAll();
            expect(registry.get(win)).toBeUndefined();
        });

        it('disconnects signal handles', () => {
            const win = makeWindow();
            registry.attach(win);
            const obj = { disconnect: jasmine.createSpy('disconnect') };
            registry.get(win).signalHandles.push({ obj, id: 7 });
            registry.disableAll();
            expect(obj.disconnect).toHaveBeenCalledWith(7);
        });
    });

    describe('forEach()', () => {
        it('iterates over all records', () => {
            const win1 = makeWindow();
            const win2 = makeWindow();
            registry.attach(win1);
            registry.attach(win2);
            const seen = [];
            registry.forEach((w, _r) => seen.push(w));
            expect(seen.length).toBe(2);
        });
    });
});

import { shouldManage } from './windowFilter.js';

const WindowType = {
    NORMAL: 0,
    DESKTOP: 1,
    DOCK: 2,
    DIALOG: 3,
    MODAL_DIALOG: 4,
    TOOLBAR: 5,
    MENU: 6,
    UTILITY: 7,
    SPLASHSCREEN: 8,
    DROPDOWN_MENU: 9,
    POPUP_MENU: 10,
    TOOLTIP: 11,
    NOTIFICATION: 12,
    COMBO: 13,
    DND: 14,
    OVERRIDE_OTHER: 15,
};

function makeWindow(opts = {}) {
    return {
        get_window_type: () => opts.type ?? WindowType.NORMAL,
        is_override_redirect: () => opts.overrideRedirect ?? false,
        fullscreen: opts.fullscreen ?? false,
        get_wm_class: () => opts.wmClass ?? 'SomeApp',
    };
}

describe('windowFilter.shouldManage()', () => {
    describe('returns true for managed window types', () => {
        it('accepts a regular NORMAL window', () => {
            expect(shouldManage(makeWindow({ type: WindowType.NORMAL }))).toBe(true);
        });
    });

    describe('returns false for excluded window types', () => {
        const excluded = [
            ['DIALOG', WindowType.DIALOG],
            ['MODAL_DIALOG', WindowType.MODAL_DIALOG],
            ['DOCK', WindowType.DOCK],
            ['DESKTOP', WindowType.DESKTOP],
            ['TOOLBAR', WindowType.TOOLBAR],
            ['MENU', WindowType.MENU],
            ['UTILITY', WindowType.UTILITY],
            ['SPLASHSCREEN', WindowType.SPLASHSCREEN],
            ['DROPDOWN_MENU', WindowType.DROPDOWN_MENU],
            ['POPUP_MENU', WindowType.POPUP_MENU],
            ['TOOLTIP', WindowType.TOOLTIP],
            ['NOTIFICATION', WindowType.NOTIFICATION],
            ['COMBO', WindowType.COMBO],
            ['DND', WindowType.DND],
        ];

        excluded.forEach(([name, type]) => {
            it(`rejects ${name}`, () => {
                expect(shouldManage(makeWindow({ type }))).toBe(false);
            });
        });
    });

    describe('returns false for special states', () => {
        it('rejects override-redirect windows', () => {
            expect(shouldManage(makeWindow({ overrideRedirect: true }))).toBe(false);
        });

        it('rejects fullscreen windows', () => {
            expect(shouldManage(makeWindow({ fullscreen: true }))).toBe(false);
        });
    });

    describe('returns false for prefs window (FR-010)', () => {
        it('rejects gjs-based prefs window by wm_class', () => {
            expect(shouldManage(makeWindow({ wmClass: 'gjs' }))).toBe(false);
        });

        it('rejects gnome-shell-extension-prefs by wm_class', () => {
            expect(
                shouldManage(
                    makeWindow({
                        wmClass: 'org.gnome.Shell.Extensions.AdvancedWindowDecoration.Prefs',
                    }),
                ),
            ).toBe(false);
        });

        it('rejects any window whose wm_class contains "advanced-window-decoration"', () => {
            expect(shouldManage(makeWindow({ wmClass: 'advanced-window-decoration' }))).toBe(false);
        });
    });
});

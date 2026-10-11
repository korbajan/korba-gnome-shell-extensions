import { clampThickness, parseRgba, formatRgba } from './settingsClamp.js';

describe('clampThickness()', () => {
    it('clamps negative values to 0', () => {
        expect(clampThickness(-1)).toBe(0);
        expect(clampThickness(-100)).toBe(0);
    });

    it('passes zero through unchanged', () => {
        expect(clampThickness(0)).toBe(0);
    });

    it('passes mid-range values unchanged', () => {
        expect(clampThickness(1)).toBe(1);
        expect(clampThickness(16)).toBe(16);
        expect(clampThickness(32)).toBe(32);
    });

    it('clamps values above 32 to 32', () => {
        expect(clampThickness(33)).toBe(32);
        expect(clampThickness(1000)).toBe(32);
    });

    it('rounds non-integers down', () => {
        expect(clampThickness(4.9)).toBe(4);
    });
});

describe('parseRgba()', () => {
    const fallback = { r: 0.5, g: 0.5, b: 0.5, a: 0.8 };

    it('parses a valid rgba string', () => {
        const result = parseRgba('rgba(53,132,228,1.00)', fallback);
        expect(result.r).toBeCloseTo(53 / 255, 4);
        expect(result.g).toBeCloseTo(132 / 255, 4);
        expect(result.b).toBeCloseTo(228 / 255, 4);
        expect(result.a).toBeCloseTo(1.0, 4);
    });

    it('parses rgba with spaces', () => {
        const result = parseRgba('rgba(128, 128, 128, 0.80)', fallback);
        expect(result.r).toBeCloseTo(128 / 255, 4);
        expect(result.a).toBeCloseTo(0.8, 4);
    });

    it('returns fallback for fully invalid string', () => {
        const result = parseRgba('not-a-color', fallback);
        expect(result).toEqual(fallback);
    });

    it('returns fallback for empty string', () => {
        const result = parseRgba('', fallback);
        expect(result).toEqual(fallback);
    });

    it('returns fallback for out-of-range components', () => {
        const result = parseRgba('rgba(300,0,0,1.0)', fallback);
        expect(result).toEqual(fallback);
    });

    it('returns fallback for alpha out of range', () => {
        const result = parseRgba('rgba(128,128,128,1.5)', fallback);
        expect(result).toEqual(fallback);
    });
});

describe('formatRgba()', () => {
    it('serializes an rgba object to the canonical string', () => {
        const rgba = { r: 53 / 255, g: 132 / 255, b: 228 / 255, a: 1.0 };
        const str = formatRgba(rgba);
        expect(str).toMatch(/^rgba\(\d+,\d+,\d+,[0-9.]+\)$/);
    });

    it('round-trips through parseRgba → formatRgba', () => {
        const original = 'rgba(53,132,228,1.00)';
        const parsed = parseRgba(original, null);
        const formatted = formatRgba(parsed);
        const reparsed = parseRgba(formatted, null);
        expect(reparsed.r).toBeCloseTo(parsed.r, 4);
        expect(reparsed.g).toBeCloseTo(parsed.g, 4);
        expect(reparsed.b).toBeCloseTo(parsed.b, 4);
        expect(reparsed.a).toBeCloseTo(parsed.a, 4);
    });
});

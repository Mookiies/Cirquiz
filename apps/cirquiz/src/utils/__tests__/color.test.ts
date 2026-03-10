import { darkenHex, hexWithOpacity, lightenHex } from '../color';

describe('hexWithOpacity', () => {
  it('appends full alpha for opacity 1', () => {
    expect(hexWithOpacity('#ff0000', 1)).toBe('#ff0000ff');
  });

  it('appends zero alpha for opacity 0', () => {
    expect(hexWithOpacity('#ff0000', 0)).toBe('#ff000000');
  });

  it('appends correct alpha for opacity 0.5', () => {
    // Math.round(0.5 * 255) = 128 = 0x80
    expect(hexWithOpacity('#abcdef', 0.5)).toBe('#abcdef80');
  });

  it('clamps opacity above 1', () => {
    expect(hexWithOpacity('#ffffff', 2)).toBe('#ffffffff');
  });

  it('clamps opacity below 0', () => {
    expect(hexWithOpacity('#ffffff', -1)).toBe('#ffffff00');
  });

  it('strips an existing alpha channel from an 8-digit hex', () => {
    expect(hexWithOpacity('#ff000088', 1)).toBe('#ff0000ff');
  });
});

describe('darkenHex', () => {
  it('darkens a color by the default amount', () => {
    // #ffffff → each channel: 255 - round(255*0.18) = 255 - 46 = 209 = 0xd1
    expect(darkenHex('#ffffff')).toBe('#d1d1d1');
  });

  it('darkens a color by a custom amount', () => {
    // #ffffff, amount=1 → each channel clamps to 0
    expect(darkenHex('#ffffff', 1)).toBe('#000000');
  });

  it('clamps channels to 0 rather than going negative', () => {
    expect(darkenHex('#010101', 0.5)).toBe('#000000');
  });

  it('only darkens the specified channels', () => {
    // #ff0000, amount=0.5 → r: 255-128=127=0x7f, g: 0, b: 0
    expect(darkenHex('#ff0000', 0.5)).toBe('#7f0000');
  });

  it('returns a 6-digit hex with leading #', () => {
    const result = darkenHex('#123456');
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('lightenHex', () => {
  it('lightens a color by the default amount', () => {
    // #000000 → each channel: 0 + round(255*0.18) = 46 = 0x2e
    expect(lightenHex('#000000')).toBe('#2e2e2e');
  });

  it('lightens a color by a custom amount', () => {
    // #000000, amount=1 → each channel clamps to 255
    expect(lightenHex('#000000', 1)).toBe('#ffffff');
  });

  it('clamps channels to 255 rather than overflowing', () => {
    expect(lightenHex('#fefefe', 0.5)).toBe('#ffffff');
  });

  it('only lightens the specified channels', () => {
    // #0000ff, amount=0.5 → r: 128=0x80, g: 128=0x80, b: min(255,255+128)=255
    expect(lightenHex('#0000ff', 0.5)).toBe('#8080ff');
  });

  it('returns a 6-digit hex with leading #', () => {
    const result = lightenHex('#abcdef');
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
  });
});

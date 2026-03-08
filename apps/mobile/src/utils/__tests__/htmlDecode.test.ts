import { htmlDecode } from '../htmlDecode';

describe('htmlDecode', () => {
  it('decodes &amp;', () => {
    expect(htmlDecode('&amp;')).toBe('&');
  });

  it('decodes &lt;', () => {
    expect(htmlDecode('&lt;')).toBe('<');
  });

  it('decodes &gt;', () => {
    expect(htmlDecode('&gt;')).toBe('>');
  });

  it('decodes numeric entity &#39;', () => {
    expect(htmlDecode('&#39;')).toBe("'");
  });

  it('decodes hex entity &#x2F;', () => {
    expect(htmlDecode('&#x2F;')).toBe('/');
  });

  it('decodes multiple entities in one string', () => {
    expect(htmlDecode('&lt;b&gt;Hello &amp; World&#39;s&lt;/b&gt;')).toBe("<b>Hello & World's</b>");
  });

  it('passes plain text through unchanged', () => {
    expect(htmlDecode('Hello World')).toBe('Hello World');
  });

  it('handles empty string', () => {
    expect(htmlDecode('')).toBe('');
  });
});

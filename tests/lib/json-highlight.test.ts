import { describe, expect, it } from 'vitest';
import { highlightJson } from '@/lib/json-highlight';

describe('highlightJson', () => {
  it('wraps strings, numbers, booleans, and null in span classes', () => {
    const html = highlightJson({ name: 'Alice', age: 30, active: true, ref: null });
    expect(html).toContain('<span class="cs-json-key">"name":</span>');
    expect(html).toContain('<span class="cs-json-string">"Alice"</span>');
    expect(html).toContain('<span class="cs-json-number">30</span>');
    expect(html).toContain('<span class="cs-json-bool">true</span>');
    expect(html).toContain('<span class="cs-json-null">null</span>');
  });

  it('escapes HTML in string values so the host page cannot be tag-injected', () => {
    const html = highlightJson({ note: '<img src=x onerror=alert(1)>' });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('handles nested arrays and objects', () => {
    const html = highlightJson({
      items: [
        { id: 1, label: 'one' },
        { id: 2, label: 'two' },
      ],
    });
    expect(html).toContain('<span class="cs-json-key">"items":</span>');
    expect(html).toContain('<span class="cs-json-key">"label":</span>');
    expect(html).toContain('<span class="cs-json-string">"one"</span>');
    expect(html).toContain('<span class="cs-json-number">2</span>');
  });

  it('returns an empty string for values JSON.stringify drops (functions, undefined)', () => {
    expect(highlightJson(undefined)).toBe('');
    expect(highlightJson(() => 1)).toBe('');
  });
});

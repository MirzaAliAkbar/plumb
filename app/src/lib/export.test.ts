import { describe, it, expect } from 'vitest';
import { toSemanticHtml } from './export';
import type { Block, BlockKind, DocumentAnalysis, Line } from './types';

function line(text: string, size = 10): Line {
  return {
    runs: [{ str: text, x: 72, y: 100, w: text.length * size * 0.5, h: size, font: 'F1', size }],
    x0: 72,
    x1: 72 + text.length * size * 0.5,
    y: 100,
    text,
    size,
  };
}

function block(kind: BlockKind, text: string, size = 10, confidence = 0.95): Block {
  return { kind, lines: [line(text, size)], order: 1, confidence, column: 0 };
}

function doc(blocks: Block[], extra: Partial<DocumentAnalysis> = {}): DocumentAnalysis {
  return {
    fileName: 'paper.pdf',
    pageCount: 1,
    pages: [
      {
        pageIndex: 0,
        width: 612,
        height: 792,
        columns: 2,
        blocks,
        suppressed: [],
        confidence: 0.9,
      },
    ],
    confidence: 0.9,
    ...extra,
  };
}

const body = (html: string) => html.split('<body>')[1].split('</body>')[0];

describe('toSemanticHtml', () => {
  it('emits a complete, language-tagged document with the file name as h1', () => {
    const html = toSemanticHtml(doc([block('paragraph', 'Some text.')]), 'paper.pdf');
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<html lang="en">');
    expect(body(html)).toContain('<h1>paper.pdf</h1>');
    expect(html).toContain('</html>');
  });

  it('never skips a heading level: the first heading is h2 under the h1 title', () => {
    // A subheading emitted as h3 straight after h1 breaks outline navigation,
    // which is how most screen-reader users move through a document.
    const html = toSemanticHtml(
      doc([block('heading', 'Introduction', 12), block('paragraph', 'Body.')]),
      'paper.pdf',
    );
    expect(html).toContain('<h2>Introduction</h2>');
    expect(html).not.toContain('<h3>');
  });

  it('distinguishes section headings from sub-headings by font size', () => {
    const html = toSemanticHtml(
      doc([
        block('heading', 'Results', 20),
        block('paragraph', 'Body.'),
        block('heading', 'Subjects', 12),
        block('heading', 'Method', 20),
      ]),
      'paper.pdf',
    );
    expect(html).toContain('<h2>Results</h2>');
    expect(html).toContain('<h3>Subjects</h3>');
    expect(html).toContain('<h2>Method</h2>');
  });

  it('groups consecutive list items into a single list, splitting on interruption', () => {
    const html = toSemanticHtml(
      doc([
        block('list-item', '• first'),
        block('list-item', '• second'),
        block('paragraph', 'Interrupt.'),
        block('list-item', '• third'),
      ]),
      'paper.pdf',
    );
    const lists = html.match(/<ul>[\s\S]*?<\/ul>/g) ?? [];
    expect(lists).toHaveLength(2);
    expect(lists[0]).toContain('<li>• first</li>');
    expect(lists[0]).toContain('<li>• second</li>');
    expect(lists[1]).toContain('<li>• third</li>');
  });

  it('renders captions as figure captions and code as pre/code', () => {
    const html = toSemanticHtml(
      doc([block('caption', 'Figure 1: A plot.'), block('code', 'const x = 1;')]),
      'paper.pdf',
    );
    expect(html).toContain('<figure><figcaption>Figure 1: A plot.</figcaption></figure>');
    expect(html).toContain('<pre><code>const x = 1;</code></pre>');
  });

  it('marks low-confidence blocks without relying on colour', () => {
    const html = toSemanticHtml(
      doc([block('paragraph', 'Doubtful.', 10, 0.4), block('paragraph', 'Sure.', 10, 0.9)]),
      'paper.pdf',
    );
    expect(html).toContain('<p data-low-confidence="true">Doubtful.</p>');
    expect(html).toContain('<p>Sure.</p>');
  });

  it('escapes text so document content can never inject markup', () => {
    const html = toSemanticHtml(
      doc([block('paragraph', '<script>alert("x")</script> & <b>')]),
      'paper.pdf',
    );
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
  });

  it('escapes the source file name in the title as well as the body', () => {
    const html = toSemanticHtml(doc([]), 'a<b>&"c".pdf');
    expect(html).toContain('<h1>a&lt;b&gt;&amp;&quot;c&quot;.pdf</h1>');
    expect(html).toContain('<title>a&lt;b&gt;&amp;&quot;c&quot;.pdf — accessible reading copy</title>');
  });

  it('skips empty blocks instead of emitting empty paragraphs', () => {
    const html = toSemanticHtml(
      doc([block('paragraph', 'Real.'), block('paragraph', '   ')]),
      'paper.pdf',
    );
    expect(body(html)).not.toContain('<p></p>');
    expect(html).toContain('<p>Real.</p>');
  });

  it('labels each page section and reports page count', () => {
    const html = toSemanticHtml(doc([block('paragraph', 'One.')], { pageCount: 3 }), 'paper.pdf');
    expect(html).toContain('<section aria-label="Page 1">');
    expect(html).toContain('3 pages');
  });

  it('uses the singular for a single-page document', () => {
    const html = toSemanticHtml(doc([block('paragraph', 'One.')], { pageCount: 1 }), 'paper.pdf');
    expect(html).toContain('1 page,');
  });
});

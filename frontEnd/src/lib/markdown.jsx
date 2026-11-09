import React from 'react';

/**
 * Tiny, safe Markdown renderer for job descriptions.
 * Supports: ## / ### headings, - or * bullets, 1. numbered lists, paragraphs,
 * **bold**, *italic*, `code` and [links](https://…). Builds React elements (never innerHTML),
 * so employer-written text can't inject markup. Plain text without Markdown still reads fine.
 */

function inline(text, keyPrefix) {
  const out = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^\s)]+)\))/g;
  let last = 0;
  let match;
  let i = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${i++}`;
    if (token.startsWith('**')) out.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith('`')) out.push(<code key={key}>{token.slice(1, -1)}</code>);
    else if (token.startsWith('[')) {
      const label = token.slice(1, token.indexOf(']('));
      out.push(<a key={key} href={match[2]} target="_blank" rel="noreferrer nofollow">{label}</a>);
    } else out.push(<em key={key}>{token.slice(1, -1)}</em>);
    last = match.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text = '', className = 'jb-md' }) {
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let list = null;
  let para = [];

  const flushPara = () => {
    if (para.length) blocks.push({ type: 'p', text: para.join(' ') });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (!line) { flushPara(); flushList(); continue; }
    if (heading) { flushPara(); flushList(); blocks.push({ type: heading[1].length === 3 ? 'h4' : 'h3', text: heading[2] }); continue; }
    if (bullet || numbered) {
      flushPara();
      const type = bullet ? 'ul' : 'ol';
      if (!list || list.type !== type) { flushList(); list = { type, items: [] }; }
      list.items.push((bullet || numbered)[1]);
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();

  return (
    <div className={className}>
      {blocks.map((block, i) => {
        if (block.type === 'ul' || block.type === 'ol') {
          const Tag = block.type;
          return <Tag key={i}>{block.items.map((item, j) => <li key={j}>{inline(item, `${i}-${j}`)}</li>)}</Tag>;
        }
        const Tag = block.type;
        return <Tag key={i}>{inline(block.text, String(i))}</Tag>;
      })}
    </div>
  );
}

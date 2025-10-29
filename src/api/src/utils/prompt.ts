type ContextItem = {
  text: string;
  source: {
    paper_id: string;
    paper_title?: string;
    section?: string;
    page?: number;
    chunk_index?: number;
  };
};

export function assemblePrompt(
  question: string,
  context: ContextItem[]
): string {
  const header = [
    '<context>',
    ...context.map((c, idx) =>
      [
        `<chunk>`,
        `<meta paper_id="${c.source.paper_id}" paper_title="${escapeXml(
          c.source.paper_title || ''
        )}" section="${escapeXml(c.source.section || '')}" page="${
          c.source.page ?? ''
        }"/>`,
        escapeXml(c.text),
        '</chunk>',
      ].join('\n')
    ),
    '</context>',
    '',
    'You are a research assistant. Answer the question using ONLY the provided context.',
    'Cite sources explicitly in the form [paper_title, section, page].',
    'If the answer is not covered by the context, say you are uncertain.',
    '',
    `<question>${escapeXml(question)}</question>`,
  ].join('\n');
  return header;
}

export function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

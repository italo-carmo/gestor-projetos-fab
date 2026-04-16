export type JsonSseHandler = (event: string, data: any) => void;

function parseSseBlock(block: string, onEvent: JsonSseHandler) {
  const normalized = block.replace(/\r/g, '');
  if (!normalized.trim()) return;

  let eventName = 'message';
  const dataLines: string[] = [];

  for (const line of normalized.split('\n')) {
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim() || 'message';
      continue;
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) return;

  try {
    onEvent(eventName, JSON.parse(dataLines.join('\n')));
  } catch {
    // Ignora eventos malformados sem derrubar a leitura do stream.
  }
}

export async function consumeJsonSseStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onEvent: JsonSseHandler,
) {
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      if (buffer.trim()) {
        parseSseBlock(buffer, onEvent);
      }
      return;
    }

    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

    let separatorIndex = buffer.indexOf('\n\n');
    while (separatorIndex !== -1) {
      const block = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      parseSseBlock(block, onEvent);
      separatorIndex = buffer.indexOf('\n\n');
    }
  }
}

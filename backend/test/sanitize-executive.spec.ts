import { sanitizeForExecutive } from '../src/common/executive';

describe('sanitizeForExecutive', () => {
  it('removes PII fields recursively', () => {
    const input = {
      name: 'Alice',
      email: 'a@b.com',
      phone: '999',
      commanderName: 'Cmd',
      nested: {
        contato: '123',
        safe: 'ok',
      },
      items: [
        { name: 'Bob', value: 1 },
        { contact: 'xx', value: 2 },
      ],
    };

    const result = sanitizeForExecutive(input) as any;
    expect(result.name).toBeUndefined();
    expect(result.email).toBeUndefined();
    expect(result.phone).toBeUndefined();
    expect(result.commanderName).toBeUndefined();
    expect(result.nested.contato).toBeUndefined();
    expect(result.nested.safe).toBe('ok');
    expect(result.items[0].name).toBeUndefined();
    expect(result.items[0].value).toBe(1);
  });
});


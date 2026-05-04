import { PostosController } from './postos.controller';
import { PERMISSION_METADATA_KEY } from '../rbac/require-permission.decorator';

describe('PostosController', () => {
  const prisma = {
    posto: {
      findMany: jest.fn(),
    },
  } as any;

  const controller = new PostosController(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('mantem listagem administrativa protegida por permissao de postos', () => {
    const metadata = Reflect.getMetadata(
      PERMISSION_METADATA_KEY,
      PostosController.prototype.list,
    );

    expect(metadata).toEqual({
      resource: 'postos',
      action: 'view',
      scope: undefined,
    });
  });

  it('expoe opcoes autenticadas sem exigir permissao administrativa', () => {
    const metadata = Reflect.getMetadata(
      PERMISSION_METADATA_KEY,
      PostosController.prototype.options,
    );

    expect(metadata).toBeUndefined();
  });

  it('lista opcoes de postos ordenadas pelo cadastro', async () => {
    prisma.posto.findMany.mockResolvedValue([
      { id: 'posto-1', code: 'CAP', name: 'Capitao', sortOrder: 10 },
    ]);

    await expect(controller.options()).resolves.toEqual({
      items: [{ id: 'posto-1', code: 'CAP', name: 'Capitao', sortOrder: 10 }],
    });
    expect(prisma.posto.findMany).toHaveBeenCalledWith({
      orderBy: { sortOrder: 'asc' },
    });
  });
});

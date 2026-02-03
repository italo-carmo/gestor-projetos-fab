import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('RBAC import + Meetings generate tasks (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('imports RBAC matrix (TI)', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'ti@smif.local', password: 'Admin123' });

    const token = login.body.accessToken;
    expect(token).toBeDefined();

    const exportResp = await request(app.getHttpServer())
      .get('/admin/rbac/export')
      .set('Authorization', `Bearer ${token}`);

    expect(exportResp.status).toBe(200);

    const importResp = await request(app.getHttpServer())
      .post('/admin/rbac/import?mode=merge')
      .set('Authorization', `Bearer ${token}`)
      .send(exportResp.body);

    expect(importResp.status).toBe(200);
  });

  it('generates tasks from meeting (CIPAVD)', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'cipavd@smif.local', password: 'Admin123' });

    const token = login.body.accessToken;
    expect(token).toBeDefined();

    const templates = await request(app.getHttpServer())
      .get('/task-templates')
      .set('Authorization', `Bearer ${token}`);

    const localities = await request(app.getHttpServer())
      .get('/localities')
      .set('Authorization', `Bearer ${token}`);

    expect(templates.status).toBe(200);
    expect(localities.status).toBe(200);

    const templateId = templates.body.items?.[0]?.id;
    const localityId = localities.body.items?.[0]?.id;

    const meeting = await request(app.getHttpServer())
      .post('/meetings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        datetime: new Date().toISOString(),
        scope: 'NATIONAL',
        status: 'PLANNED',
        agenda: 'E2E teste',
      });

    expect(meeting.status).toBe(201);

    const generate = await request(app.getHttpServer())
      .post(`/meetings/${meeting.body.id}/generate-tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        templateId,
        priority: 'MEDIUM',
        localities: [
          { localityId, dueDate: new Date(Date.now() + 86400000).toISOString() },
        ],
      });

    expect(generate.status).toBe(201);
  });
});


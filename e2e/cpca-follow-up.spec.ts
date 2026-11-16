import { expect, test } from '@playwright/test';

test('acompanhamento mostra o prazo da etapa e sinaliza datas ausentes', async ({page}) => {
  await page.route('**/*', async route => {
    if (!['xhr', 'fetch'].includes(route.request().resourceType())) return route.continue();
    const path = new URL(route.request().url()).pathname;
    let body: any = {items: [], total: 0};
    if (path.endsWith('/auth/me')) body = {id:'test', name:'Teste', roles:[{id:'ti',name:'TI'}], permissions:[{resource:'*',action:'*',scope:'NATIONAL'}]};
    else if (path.endsWith('/localities')) body=[];
    else if (path.endsWith('/cpca-cases/stats')) body = {
      summary:{totalCases:2, openCases:2, followUpOver30Days:1, followUpWithoutStartDate:1},
      kpiDetails:{followUpOver30Days:[{caseId:'synthetic',caseNumber:'CASO-TESTE',status:'INVESTIGATION',followUpDays:35,openDays:100,idleDays:1}]},
    };
    await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('/dashboard/cpca');
  await expect(page.getByText('Acompanhamento > 30 dias',{exact:true})).toBeVisible();
  await expect(page.getByText(/Desde a entrada em acompanhamento.*1 sem data de entrada/)).toBeVisible();
  await page.getByRole('button', {name:/Acompanhamento > 30 dias/}).click();
  await expect(page.getByRole('dialog').getByText('Em acompanhamento: 35 dias')).toBeVisible();
  await expect(page.getByRole('dialog').getByText(/desde a última entrada nessa etapa/)).toBeVisible();
});

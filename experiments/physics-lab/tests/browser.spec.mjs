import {test,expect} from '@playwright/test';

test('Rapier and Jolt complete the same wall benchmark and export measured JSON',async({page},testInfo)=>{
  const exceptions=[];
  page.on('pageerror',e=>exceptions.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('Pronto para medir',{timeout:60000});
  await page.getByLabel('Cenário').selectOption('wall');
  await page.getByRole('button',{name:/Comparar os dois motores/}).click();
  await expect(page.getByRole('status')).toContainText('Benchmark concluído',{timeout:125000});
  const reports=JSON.parse(await page.locator('#results').innerText());
  expect(reports).toHaveLength(2);
  expect(reports.map(r=>r.engine)).toEqual(['Rapier','Jolt']);
  expect(reports[0].config).toEqual(reports[1].config);
  for(const report of reports){
    expect(report.metrics.steps).toBe(480);
    expect(Number.isFinite(report.metrics.avgStepMs)).toBe(true);
    expect(Number.isFinite(report.observations.distance)).toBe(true);
  }
  expect(reports[1].observations.nodes).toBe(36);
  expect(reports[1].observations.maxCompressionPercent).toBeGreaterThanOrEqual(0);
  expect(exceptions).toEqual([]);
  await testInfo.attach('physics-comparison.json',{body:Buffer.from(JSON.stringify(reports,null,2)),contentType:'application/json'});
  await testInfo.attach('jolt-soft-body-wall',{body:await page.screenshot(),contentType:'image/png'});
  console.log('PHYSICS_BENCHMARK '+JSON.stringify(reports.map(r=>({engine:r.engine,scenario:r.scenario,avgStepMs:r.metrics.avgStepMs,p95StepMs:r.metrics.p95StepMs,distance:r.observations.distance,maxCompressionPercent:r.observations.maxCompressionPercent}))));
});

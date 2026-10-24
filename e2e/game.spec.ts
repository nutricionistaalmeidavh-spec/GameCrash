import {test,expect} from '@playwright/test';

test('carrega cena WebGL, permite selecionar carro e cenário e gera screenshot',async ({page},testInfo)=>{
  const consoleErrors:string[]=[];
  page.on('pageerror',err=>consoleErrors.push(err.message));
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden({timeout:30000});
  await expect(page.locator('#fatal')).toBeHidden();
  await expect(page.locator('#vehicles button')).toHaveCount(3);
  await expect(page.locator('#scenarios button')).toHaveCount(3);
  await page.getByRole('button',{name:/SUV TITAN/}).click();
  await page.getByRole('button',{name:/BLOCOS/}).click();
  await expect(page.locator('[data-vehicle="suv"]')).toHaveClass(/selected/);
  await expect(page.locator('[data-scenario="blocks"]')).toHaveClass(/selected/);
  await testInfo.attach('ready-screen',{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
  expect(consoleErrors).toEqual([]);
});
test('inicia simulação com motor de física e reinicia sem erros',async ({page},testInfo)=>{
  const consoleErrors:string[]=[];
  page.on('pageerror',err=>consoleErrors.push(err.message));
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden({timeout:30000});
  await page.locator('#start').click();
  await expect(page.locator('body')).toHaveAttribute('data-phase','running');
  await expect.poll(async()=>Number(await page.locator('#speed').textContent()),{timeout:15000}).toBeGreaterThan(5);
  await testInfo.attach('running-screen',{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
  await page.locator('#start').click();
  await expect(page.locator('body')).toHaveAttribute('data-phase','running');
  expect(consoleErrors).toEqual([]);
});

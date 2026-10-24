import {test,expect} from '@playwright/test';

test('abre a cena 3D, troca carro e cenário e dirige', async ({page}, testInfo) => {
  const failures:string[]=[];
  page.on('pageerror',error=>failures.push(error.message));
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden({timeout:30_000});
  await expect(page.locator('#fatal')).toBeHidden();
  await expect(page.locator('#vehicles button')).toHaveCount(3);
  await expect(page.locator('#scenarios button')).toHaveCount(3);
  await page.locator('#vehicles button').nth(2).click();
  await expect(page.locator('#vehicles button').nth(2)).toHaveAttribute('aria-pressed','true');
  await page.locator('#scenarios button').nth(1).click();
  await expect(page.locator('#scenarios button').nth(1)).toHaveAttribute('aria-pressed','true');
  await page.locator('#start').click();
  await expect(page.locator('body')).toHaveClass(/running/);
  await expect.poll(async()=>Number(await page.locator('#speed').textContent()), {timeout:20_000}).toBeGreaterThan(5);
  await page.locator('#camera').click();
  await expect(page.locator('#fatal')).toBeHidden();
  await testInfo.attach('game-running', {body:await page.screenshot(),contentType:'image/png'});
  expect(failures).toEqual([]);
});

test('conclui o teste de colisão e permite tentar novamente',async({page},testInfo)=>{
  const failures:string[]=[];
  page.on('pageerror',e=>failures.push(e.message));
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden({timeout:30_000});
  await page.locator('#start').click();
  await expect(page.locator('#result-wrap')).toBeVisible({timeout:48_000});
  await expect(page.locator('#impact-speed')).not.toHaveText('—');
  await testInfo.attach('impact-report',{body:await page.screenshot(),contentType:'image/png'});
  await page.locator('#retry').click();
  await expect(page.locator('#result-wrap')).toBeHidden();
  await expect(page.locator('body')).toHaveClass(/running/);
  expect(failures).toEqual([]);
});

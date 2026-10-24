import {test,expect} from '@playwright/test';

test('carrega a cena WebGL no desktop e no WebKit iPhone',async({page},testInfo)=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden({timeout:30_000});
  await expect(page.locator('#fatal')).toBeHidden();
  await expect(page.locator('#vehicles button')).toHaveCount(3);
  await expect(page.locator('#scenarios button')).toHaveCount(3);
  await page.getByRole('button',{name:/SUV TITAN/}).click();
  await page.getByRole('button',{name:/BLOCOS/}).click();
  await expect(page.locator('[data-vehicle="suv"]')).toHaveClass(/selected/);
  await expect(page.locator('[data-scenario="blocks"]')).toHaveClass(/selected/);
  await testInfo.attach('selection-screen',{body:await page.screenshot(),contentType:'image/png'});
  expect(errors).toEqual([]);
});

test('dirige e mede deslocamento real na pista',async({page},testInfo)=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden({timeout:30_000});
  await page.locator('#camera').click();
  await page.locator('#start').click();
  await expect(page.locator('body')).toHaveAttribute('data-phase','running');
  // Velocidade instantânea pode voltar a 0 no impacto antes de a asserção
  // amostrar o HUD. Deslocamento acumulado é o sinal correto da simulação.
  await expect.poll(async()=>{
    const text=await page.locator('#distance').textContent();
    return Number(text?.match(/\d+/)?.[0]??0);
  },{timeout:20_000}).toBeGreaterThan(5);
  await testInfo.attach('driving-screen',{body:await page.screenshot(),contentType:'image/png'});
  expect(errors).toEqual([]);
});

test('mostra o resultado do impacto e permite reiniciar',async({page},testInfo)=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden({timeout:30_000});
  await page.locator('#start').click();
  await expect(page.locator('#result-wrap')).toBeVisible({timeout:45_000});
  await expect(page.locator('#impact-speed')).not.toHaveText('—');
  await testInfo.attach('impact-result',{body:await page.screenshot(),contentType:'image/png'});
  await page.locator('#retry').click();
  await expect(page.locator('#result-wrap')).toBeHidden();
  await expect(page.locator('body')).toHaveAttribute('data-phase','running');
  expect(errors).toEqual([]);
});

import {test,expect} from '@playwright/test';

test('carrega a cena WebGL no desktop e no WebKit iPhone',async({page},testInfo)=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden({timeout:30_000});
  await expect(page.locator('#fatal')).toBeHidden();
  await expect(page.locator('#vehicles button')).toHaveCount(3);
  await expect(page.locator('#scenarios button')).toHaveCount(4);
  await expect(page.getByRole('button',{name:'Acelerar'})).toHaveCount(1);
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
  await expect(page.locator('#speed')).toHaveText('000');
  // QA can hold the same virtual accelerator gesture used on mobile Safari.
  await page.locator('#accelerate').dispatchEvent('pointerdown',{pointerId:7,pointerType:'touch'});
  await expect(page.locator('#accelerate')).toHaveAttribute('aria-pressed','true');
  await expect.poll(async()=>{
    const text=await page.locator('#distance').textContent();
    return Number(text?.match(/\d+/)?.[0]??0);
  },{timeout:20_000}).toBeGreaterThan(5);
  await page.locator('#accelerate').dispatchEvent('pointerup',{pointerId:7,pointerType:'touch'});
  await expect(page.locator('#accelerate')).toHaveAttribute('aria-pressed','false');
  await testInfo.attach('driving-screen',{body:await page.screenshot(),contentType:'image/png'});
  expect(errors).toEqual([]);
});

test('mostra o resultado do impacto e permite reiniciar',async({page},testInfo)=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden({timeout:30_000});
  await page.locator('#start').click();
  await expect(page.locator('#speed')).toHaveText('000');
  await page.locator('#accelerate').dispatchEvent('pointerdown',{pointerId:8,pointerType:'touch'});
  await expect(page.locator('#result-wrap')).toBeVisible({timeout:45_000});
  await page.locator('#accelerate').dispatchEvent('pointerup',{pointerId:8,pointerType:'touch'});
  await expect(page.locator('#impact-speed')).not.toHaveText('—');
  await testInfo.attach('impact-result',{body:await page.screenshot(),contentType:'image/png'});
  await page.locator('#retry').click();
  await expect(page.locator('#result-wrap')).toBeHidden();
  await expect(page.locator('body')).toHaveAttribute('data-phase','running');
  expect(errors).toEqual([]);
});

test('acelerador manual freia e solta corretamente no WebKit iPhone',async({page})=>{
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden({timeout:30_000});
  await page.locator('#start').click();
  await expect(page.locator('#speed')).toHaveText('000');
  const pedal=page.getByRole('button',{name:'Acelerar'});
  await expect(pedal).toBeVisible();
  await pedal.dispatchEvent('pointerdown',{pointerId:14,pointerType:'touch'});
  await expect.poll(async()=>Number(await page.locator('#speed').textContent()),{timeout:20_000}).toBeGreaterThan(10);
  await expect(pedal).toHaveAttribute('aria-pressed','true');
  await pedal.dispatchEvent('pointerup',{pointerId:14,pointerType:'touch'});
  await expect(pedal).toHaveAttribute('aria-pressed','false');
});

test('turbo a 600 km/h e seleção do desafio de 120 lombadas',async({page})=>{
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden({timeout:30_000});
  await expect(page.locator('#scenarios button')).toHaveCount(4);
  await expect(page.getByRole('slider',{name:'Velocidade máxima'})).toHaveValue('600');
  await page.getByRole('button',{name:/120 LOMBADAS/}).click();
  await expect(page.locator('#bumps-stat')).toBeVisible();
  await expect(page.locator('#bumps-count')).toHaveText('000/120');
  await page.locator('#start').click();
  await page.locator('#accelerate').dispatchEvent('pointerdown',{pointerId:50,pointerType:'touch'});
  await expect.poll(async()=>Number(await page.locator('#speed').textContent()),{timeout:25_000}).toBeGreaterThan(60);
  await expect.poll(async()=>Number((await page.locator('#bumps-count').textContent())?.split('/')[0]),{timeout:30_000}).toBeGreaterThan(0);
  await page.locator('#accelerate').dispatchEvent('pointerup',{pointerId:50,pointerType:'touch'});
});

import {test,expect} from '@playwright/test';

test('carrega a cena WebGL no desktop e no WebKit iPhone',async({page},testInfo)=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden({timeout:30_000});
  await page.locator('[data-vehicle="sedan"]').click();
  await expect(page.locator('#fatal')).toBeHidden();
  await expect(page.locator('#vehicles button')).toHaveCount(14);
  await expect(page.locator('#scenarios button')).toHaveCount(4);
  await expect(page.locator('#sceneries button')).toHaveCount(4);
  await expect(page.locator('#accelerate')).toHaveCount(1);
  await page.getByRole('button',{name:/VOLKSWAGEN GOL/}).click();
  await page.locator('[data-scenery="brasilia-eixo-monumental"]').click();
  await page.getByRole('button',{name:/BLOCOS/}).click();
  await expect(page.locator('[data-vehicle="gol"]')).toHaveClass(/selected/);
  await expect(page.locator('[data-scenario="blocks"]')).toHaveClass(/selected/);
  await testInfo.attach('selection-screen',{body:await page.screenshot(),contentType:'image/png'});
  expect(errors).toEqual([]);
});

test('dirige e mede deslocamento real na pista',async({page},testInfo)=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden({timeout:30_000});
  await page.locator('[data-vehicle="sedan"]').click();
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
  test.setTimeout(150_000); // Software WebGL advances fewer physics frames per wall-clock second.
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden({timeout:30_000});
  await page.locator('[data-vehicle="sedan"]').click();
  await page.locator('#start').click();
  await expect(page.locator('#speed')).toHaveText('000');
  await page.locator('#accelerate').dispatchEvent('pointerdown',{pointerId:8,pointerType:'touch'});
  await expect(page.locator('#result-wrap')).toBeVisible({timeout:90_000});
  await page.locator('#accelerate').dispatchEvent('pointerup',{pointerId:8,pointerType:'touch'});
  await expect(page.locator('#impact-speed')).not.toHaveText('—');
  await expect.poll(async()=>Number((await page.locator('#deformation-energy').textContent())?.replace(/[^\d]/g,''))).toBeGreaterThan(0);
  await page.locator('#inspect').click();
  await expect(page.locator('#result-wrap')).toBeHidden();
  await expect(page.locator('#report')).toBeEnabled();
  await expect(page.locator('#slow-motion')).toBeVisible();
  await page.locator('#slow-motion').click();await expect(page.locator('#slow-motion')).toHaveText('1×');
  await page.locator('#slow-motion').click();await expect(page.locator('#slow-motion')).toHaveText('0,1×');
  await page.locator('#slow-motion').click();await expect(page.locator('#slow-motion')).toHaveText('PAUSADO');
  const viewport=page.viewportSize()!;
  await page.mouse.move(viewport.width*.5,viewport.height*.5);await page.mouse.down();
  await page.mouse.move(viewport.width*.7,viewport.height*.48,{steps:6});await page.mouse.up();
  await testInfo.attach('physical-wreck-inspection',{body:await page.screenshot({path:testInfo.outputPath('physical-wreck.png')}),contentType:'image/png'});
  await page.locator('#report').click();await expect(page.locator('#result-wrap')).toBeVisible();
  await testInfo.attach('impact-result',{body:await page.screenshot(),contentType:'image/png'});
  await page.locator('#retry').click();
  await expect(page.locator('#result-wrap')).toBeHidden();
  await expect(page.locator('body')).toHaveAttribute('data-phase','running');
  expect(errors).toEqual([]);
});

test('acelerador manual freia e solta corretamente no WebKit iPhone',async({page})=>{
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden({timeout:30_000});
  await page.locator('[data-vehicle="sedan"]').click();
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
  await page.locator('[data-vehicle="sedan"]').click();
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

test('garagem recolhe, pedais ficam acessíveis e reiniciar funciona durante a corrida',async({page},testInfo)=>{
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden();await page.locator('[data-vehicle="sedan"]').click();
  await page.locator('#start').click();
  await expect(page.locator('.bottom-panel')).toBeHidden();
  const pedal=page.locator('#accelerate');
  await expect(pedal).toBeVisible();
  // A real pointer gesture must hit the accelerator, rather than dispatching through an overlay.
  const box=await pedal.boundingBox();if(!box)throw new Error('Acelerador fora da tela');
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await expect(pedal).toHaveAttribute('aria-pressed','true');
  await expect.poll(async()=>Number(await page.locator('#speed').textContent())).toBeGreaterThan(25);
  await page.mouse.up();
  await page.locator('#brake').dispatchEvent('pointerdown',{pointerId:82,pointerType:'touch'});
  await expect.poll(async()=>Number(await page.locator('#speed').textContent())).toBeLessThan(5);
  await page.locator('#brake').dispatchEvent('pointerup',{pointerId:82,pointerType:'touch'});
  await page.locator('#restart').click();
  await expect(page.locator('body')).toHaveAttribute('data-phase','running');
  await expect(page.locator('#speed')).toHaveText('000');
  await testInfo.attach('gameplay-full-screen',{body:await page.screenshot({path:testInfo.outputPath('gameplay.png')}),contentType:'image/png'});
  await page.locator('#garage').click();
  await expect(page.locator('body')).toHaveAttribute('data-phase','ready');
  await expect(page.locator('.bottom-panel')).toBeVisible();
});

test('multitoque e cancelamento não deixam o acelerador preso',async({page})=>{
  await page.goto('/');await expect(page.locator('#loading')).toBeHidden();await page.locator('[data-vehicle="sedan"]').click();await page.locator('#start').click();
  await page.locator('#accelerate').dispatchEvent('pointerdown',{pointerId:91,pointerType:'touch'});
  await page.locator('#right').dispatchEvent('pointerdown',{pointerId:92,pointerType:'touch'});
  await expect(page.locator('#accelerate')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#right')).toHaveClass(/pressed/);
  await page.locator('#right').dispatchEvent('pointercancel',{pointerId:92,pointerType:'touch'});
  await expect(page.locator('#right')).not.toHaveClass(/pressed/);
  await expect(page.locator('#accelerate')).toHaveAttribute('aria-pressed','true');
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await expect(page.locator('#accelerate')).toHaveAttribute('aria-pressed','false');
});

test('controles cabem no celular em retrato e paisagem',async({page},testInfo)=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');await expect(page.locator('#loading')).toBeHidden();await page.locator('[data-vehicle="sedan"]').click();
  await page.locator('[data-vehicle="gol"]').click();
  await page.locator('#start').click();
  for(const viewport of [{width:390,height:844},{width:844,height:390}]){
    await page.setViewportSize(viewport);
    for(const id of ['left','right','brake','accelerate','garage','restart','camera','mute']){
      await expect(page.locator('#'+id)).toBeVisible();
      expect(await page.locator('#'+id).evaluate(el=>{
        const b=el.getBoundingClientRect();
        return b.x>=0&&b.y>=0&&b.right<=innerWidth&&b.bottom<=innerHeight&&document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)===el;
      })).toBe(true);
    }
    await testInfo.attach('mobile-'+viewport.width,{body:await page.screenshot({path:testInfo.outputPath('mobile-'+viewport.width+'.png')}),contentType:'image/png'});
  }
});

test('Concept detalhado carrega, sofre colisão e pode ser recarregado',async({page},testInfo)=>{
  test.setTimeout(180_000);
  // Software WebGL in CI needs a smaller render target for the full PBR model.
  if(testInfo.project.name==='chromium-desktop')await page.setViewportSize({width:640,height:480});
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden();
  await expect(page.locator('#game')).toHaveAttribute('data-model','concept');
  await expect(page.locator('#model-status')).toContainText('modelo detalhado pronto');
  await testInfo.attach('concept-garage',{body:await page.screenshot(),contentType:'image/png'});
  await page.locator('#start').click();
  await expect(page.locator('#game')).toHaveAttribute('data-model','concept');
  await page.locator('#accelerate').dispatchEvent('pointerdown',{pointerId:48,pointerType:'touch'});
  await expect(page.locator('#result-wrap')).toBeVisible({timeout:120_000});
  await page.locator('#accelerate').dispatchEvent('pointerup',{pointerId:48,pointerType:'touch'});
  await expect.poll(async()=>Number((await page.locator('#deformation-energy').textContent())?.replace(/[^\d]/g,''))).toBeGreaterThan(0);
  await page.locator('#inspect').click();
  await testInfo.attach('concept-crash',{body:await page.screenshot(),contentType:'image/png'});
  await page.locator('#garage').click();
  await expect(page.locator('#game')).toHaveAttribute('data-model','concept');
  expect(errors).toEqual([]);
});

test('o acelerador entra direto a 200 km/h e as primeiras lombadas não encerram o teste',async({page})=>{
  test.setTimeout(150_000);
  await page.goto('/');
  await expect(page.locator('#loading')).toBeHidden({timeout:30_000});
  await page.locator('[data-vehicle="sedan"]').click();
  await page.locator('[data-scenario="speedbumps"]').click();
  await page.locator('#start').click();
  const pedal=page.locator('#accelerate');
  await pedal.dispatchEvent('pointerdown',{pointerId:149,pointerType:'touch'});
  // HUD updates asynchronously but physics speed is applied on pointer press.
  await expect.poll(async()=>Number(await page.locator('#speed').textContent()),{timeout:20_000}).toBeGreaterThanOrEqual(190);
  await expect.poll(async()=>Number((await page.locator('#bumps-count').textContent())?.split('/')[0]),{timeout:90_000}).toBeGreaterThanOrEqual(3);
  await expect(page.locator('body')).toHaveAttribute('data-phase','running');
  await expect(page.locator('#result-wrap')).toBeHidden();
  await pedal.dispatchEvent('pointerup',{pointerId:149,pointerType:'touch'});
});

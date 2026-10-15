/* Visual/interaction regression for the procedural WebGL scene. No account required. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.LAB_TEST_URL||'http://localhost:5174';
const shots=process.env.LAB_SCREENSHOT_DIR;
const parts=['part-gpu','part-cpu','part-ram','part-ssd','part-mobo','part-cooler','part-psu','pc-case'];
(async()=>{
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1080}});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 let checks=0;const check=(ok,label)=>{assert.ok(ok,label);console.log('PASS',label);checks++;};
 const f=()=>page.frameLocator('#hardwareFrame'),root=()=>f().locator('#hardware-viewer');
 const wait=()=>page.waitForTimeout(1200);
 const shot=async name=>{if(shots){fs.mkdirSync(shots,{recursive:true});await f().locator('.hardware-card').screenshot({path:shots+'/'+name+'.png'});}};
 try{
 await page.goto(base+'/pc-lab-assets/index.html');await f().locator('[data-ready=true]').waitFor();
 for(const part of parts){
  await page.locator('#btn-'+part).click();await f().locator(`[data-part="${part}"]`).waitFor();await wait();
  check(Number(await root().getAttribute('data-triangles'))>1000,part+' has volumetric geometry');
  await shot(part+'-assembled');
  const before=await root().getAttribute('data-angle');await f().locator('#stage').press('ArrowRight');await page.waitForTimeout(400);
  check(before!==await root().getAttribute('data-angle'),part+' rotates using keyboard');
  await f().locator('#explode').click();await wait();check(await root().getAttribute('data-dissect')==='true',part+' opens its internal assemblies');await shot(part+'-exploded');
  await f().locator('#theme').click();await page.waitForTimeout(300);await shot(part+'-light');await f().locator('#theme').click();
  await f().locator('[data-layer="0"]').click();check(await f().locator('[data-layer="0"]').getAttribute('aria-pressed')==='true',part+' isolates a layer');
  await f().locator('[data-layer="0"]').click();
  await f().locator('#xray').click();check((await f().locator('#xray').getAttribute('class')).includes('active'),part+' supports transparency');await f().locator('#xray').click();
 }
 check((await page.evaluate(()=>snapshot())).inspected_parts.length===8,'3D interactions award all eight inspections');
 await page.locator('#tabExplore').click();await wait();await shot('whole-pc');
 for(const part of parts){
  await page.locator('#btn-'+part).click();await f().locator(`[data-extracted="${part}"]`).waitFor();check(true,part+' is extracted from tab 2');
  await f().locator('#returnPC').click();await f().locator('[data-part="all"]').waitFor();
 }
 const canvas=f().locator('canvas');const rect=await canvas.boundingBox();
 // Drag the actual WebGL canvas, not a synthetic state update.
 const angle=await root().getAttribute('data-angle');await page.mouse.move(rect.x+rect.width*.5,rect.y+rect.height*.5);await page.mouse.down();await page.mouse.move(rect.x+rect.width*.7,rect.y+rect.height*.6,{steps:12});await page.mouse.up();await page.waitForTimeout(400);
 check(angle!==await root().getAttribute('data-angle'),'Pointer drag freely rotates the computer');
 await f().locator('#resetView').click();await wait();
 // Scan visible central points until a physical component is hit; no engine hooks.
 for(const [x,y]of[[.5,.53],[.47,.65],[.47,.43],[.46,.57]]){if(await root().getAttribute('data-extracted'))break;await canvas.click({position:{x:rect.width*x,y:rect.height*y}});await wait();}
 check(!!await root().getAttribute('data-extracted'),'Ray casting extracts a component clicked on the computer');
 await f().locator('#returnPC').click();await f().locator('#explode').click();await wait();await shot('whole-pc-exploded');
 await page.locator('#tabBuilder').click();await wait();
 await f().locator('[data-slot="part-psu"]').press('Enter');await page.waitForFunction(()=>snapshot().resume.installed.includes('part-psu'));check((await page.evaluate(()=>snapshot())).resume.installed.includes('part-psu'),'3D slot placement is keyboard accessible');
 await wait();check(await f().locator('#readout').textContent()==='1 / 8 компонентов','Builder counter excludes the fixed case');
 const buildRect=await canvas.boundingBox();
 for(const [x,y]of[[.48,.44],[.43,.45],[.5,.5],[.4,.55]]){if((await page.evaluate(()=>snapshot())).resume.installed.includes('part-mobo'))break;await canvas.click({position:{x:buildRect.width*x,y:buildRect.height*y}});await page.waitForTimeout(300);}
 check((await page.evaluate(()=>snapshot())).resume.installed.includes('part-mobo'),'Actual 3D slot click installs the motherboard');
 for(let i=0;i<6;i++)await page.getByRole('button',{name:/Автошаг сборки/}).click();
 await f().getByText('8 / 8 компонентов',{exact:true}).waitFor();check(true,'Finished 3D builder reports exactly eight placements');
 await page.locator('#tabPartLab').click();await page.locator('#btn-part-gpu').click();await wait();
 await f().locator('#explode').click();await wait();
 for(const width of[390,320]){await page.setViewportSize({width,height:1000});await wait();await shot('mobile-'+width);check(await page.frames().find(f=>f.url().includes('pc-lab-viewer.html')).evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'3D card fits '+width+'px');}
 await page.setViewportSize({width:1440,height:1080});await wait();
 await f().locator('#layers button').nth(1).click();await f().locator('#topView').click();await f().locator('#zoomIn').click();await f().locator('#zoomIn').click();await wait();await shot('gpu-board-closeup');
 // A settled visible scene should stop drawing, rather than consume a continuous RAF loop.
 await page.waitForTimeout(1800);const frame=await root().getAttribute('data-frame');await page.waitForTimeout(700);check(frame===await root().getAttribute('data-frame'),'Rendering stops while the scene is idle');
 check(Number(await root().getAttribute('data-calls'))<180,'Geometry is batched into a bounded number of draw calls');
 check(errors.length===0,'No JavaScript errors: '+errors.join('; '));
 // Force WebGL construction failure and verify the usable original diagram path.
 const closeContext=await browser.newContext({viewport:{width:1280,height:1000},deviceScaleFactor:4,reducedMotion:'reduce'});
 const closePage=await closeContext.newPage();await closePage.goto(base+'/pc-lab-assets/index.html');const closeFrame=closePage.frameLocator('#hardwareFrame');await closeFrame.locator('[data-ready=true]').waitFor();
 for(const part of ['part-cpu','part-ssd','part-ram']){await closePage.locator('#btn-'+part).click();await closeFrame.locator(`[data-part="${part}"]`).waitFor();await closeFrame.locator('#explode').click();await closeFrame.locator('[data-layer="0"]').click();await closeFrame.locator(part==='part-cpu'?'#bottomView':part==='part-ssd'?'#topView':'#frontView').click();await closeFrame.locator('#zoomIn').click();await closePage.waitForTimeout(300);if(shots)await closeFrame.locator('.hardware-card').screenshot({path:shots+'/'+part+'-4x.png'});}
 await closeContext.close();
 const fallback=await context.newPage();await fallback.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:get.call(this,type,...args);};});
 await fallback.goto(base+'/pc-lab-assets/index.html');await fallback.locator('#hardwareFallback:not([hidden])').waitFor();await fallback.locator('#btn-part-gpu').click();await fallback.locator('#btnDissectPart').click();check(await fallback.locator('#singlePartSvg').isVisible(),'No-WebGL fallback remains interactive');await fallback.close();
 console.log(`${checks} hardware checks passed`);
 }finally{await browser.close();}
})();

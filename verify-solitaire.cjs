const {chromium}=require('C:/Users/91926/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Users/91926/AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe'});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:8080');await page.evaluate(()=>document.fonts.ready);
 assert.equal(await page.locator('html').getAttribute('lang'),'en');
 for(const [width,height] of [[320,740],[390,844],[768,1024],[1280,720],[1366,768]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(100);
  for(let i=0;i<3;i++)await page.locator('#stock').click();
  const layout=await page.evaluate(()=>{const rect=e=>e.getBoundingClientRect();return {width:innerWidth,scroll:document.documentElement.scrollWidth,columns:[...document.querySelectorAll('.column')].map(e=>({left:rect(e).left,right:rect(e).right,width:rect(e).width})),buttons:[...document.querySelectorAll('.topbar button')].map(e=>rect(e).height),boardTop:rect(document.querySelector('.board')).top,wasteRight:rect(document.querySelector('.waste')).right,foundationLeft:rect(document.querySelector('.foundation')).left};});
  assert.equal(layout.scroll,width);assert.equal(layout.columns.length,7);assert(layout.columns.every(c=>c.left>=0&&c.right<=width));assert(layout.buttons.every(h=>h>=44));assert(layout.wasteRight<layout.foundationLeft);console.log(JSON.stringify(layout));
  await page.screenshot({path:`solitaire-${width}.png`,fullPage:true});
 }
 await page.locator('#new-game').click();assert.equal(await page.locator('#stock-count').textContent(),'24');await page.locator('#stock').click();assert.equal(await page.locator('#stock-count').textContent(),'23');assert.equal(await page.locator('#moves').textContent(),'1 move');await page.locator('#undo').click();assert.equal(await page.locator('#stock-count').textContent(),'24');
 for(let i=0;i<24;i++)await page.locator('#stock').click();assert.equal(await page.locator('#stock-count').textContent(),'0');await page.locator('#stock').click();assert.equal(await page.locator('#stock-count').textContent(),'24');
 const rules=await page.evaluate(()=>{const card=(rank,suit)=>({...createDeck().find(c=>c.rank===rank&&c.suit===suit),faceUp:true});state.tableau=[[],[card('8','clubs')],[],[],[],[],[]];state.foundations=[[],[],[],[]];return [canMoveToTableau([card('K','hearts')],0),!canMoveToTableau([card('Q','hearts')],0),canMoveToTableau([card('7','hearts')],1),!canMoveToTableau([card('7','spades')],1),canMoveToFoundation([card('A','hearts')],0),!canMoveToFoundation([card('2','hearts')],0),isValidSequence([card('8','clubs'),card('7','hearts')])];});assert(rules.every(Boolean));
 await page.evaluate(()=>{startGame();document.activeElement.blur();});await page.keyboard.press('Tab');assert(await page.evaluate(()=>document.activeElement!==document.body));
 await page.evaluate(()=>{state.foundations=suits.map(s=>createDeck().filter(c=>c.suit===s.id));checkWin();});assert(await page.locator('#win-dialog').isVisible());assert.match(await page.locator('#win-summary').textContent(),/^Finished in/);await page.locator('#play-again').click();assert.equal(await page.locator('#stock-count').textContent(),'24');
 assert.equal(errors.length,0);console.log('PASS: draw-one, undo, stock recycle, Klondike validators, keyboard focus, English win dialog and restart. No JavaScript errors.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

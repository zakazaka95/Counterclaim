import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { browserExecutable } from './runtime.mjs';
const out = path.resolve('out/styleframes');
await mkdir(out, {recursive:true});
const browser = await puppeteer.launch({executablePath:browserExecutable,headless:true});
try {
  const page = await browser.newPage();
  await page.setViewport({width:1920,height:1080,deviceScaleFactor:1});
  await page.goto(pathToFileURL(path.resolve('styleframes.html')).href, {waitUntil:'networkidle0'});
  await page.evaluate(async()=>{await document.fonts.ready; await Promise.all([...document.images].map(i=>i.decode()));});
  for (const name of ['opening','evidence','close']) {
    const element = await page.$('#'+name);
    await element.screenshot({path:path.join(out,name+'.png')});
    console.log(path.join(out,name+'.png'));
  }
} finally { await browser.close(); }

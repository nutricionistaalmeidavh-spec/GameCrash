import {defineConfig,devices} from '@playwright/test';
import {fileURLToPath} from 'node:url';
export default defineConfig({
  testDir:'./tests',testMatch:'**/browser.spec.mjs',timeout:150000,
  expect:{timeout:30000},
  use:{baseURL:'http://127.0.0.1:4174',trace:'retain-on-failure',screenshot:'only-on-failure'},
  projects:[
    {name:'chromium-desktop',use:{...devices['Desktop Chrome'],viewport:{width:1024,height:720}}},
    {name:'webkit-iphone',use:{...devices['iPhone 13']}}
  ],
  webServer:{
    command:'npm run dev -- --port 4174 --host 127.0.0.1',
    cwd:fileURLToPath(new URL('.',import.meta.url)),
    url:'http://127.0.0.1:4174',
    reuseExistingServer:!process.env.CI,timeout:90000
  },
  reporter:[['list'],['html',{outputFolder:'playwright-report',open:'never'}]]
});

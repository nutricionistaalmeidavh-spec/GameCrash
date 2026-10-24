import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
  testDir:'./e2e',
  timeout:45_000,
  expect:{timeout:25_000},
  retries:process.env.CI?1:0,
  reporter:process.env.CI?[['github'],['html',{open:'never'}]]:'list',
  use:{baseURL:'http://127.0.0.1:4173',trace:'retain-on-failure',screenshot:'on'},
  projects:[
    {name:'chromium-desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:900}}},
    {name:'webkit-iphone',use:{...devices['iPhone 13']}}
  ],
  webServer:{
    command:'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
    url:'http://127.0.0.1:4173',
    reuseExistingServer:!process.env.CI,
    timeout:30_000
  }
});

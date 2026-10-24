import {defineConfig,devices} from '@playwright/test';

export default defineConfig({
  testDir:'./e2e',
  timeout:70_000,
  expect:{timeout:30_000},
  retries:process.env.CI?1:0,
  workers:process.env.CI?1:undefined,
  reporter:process.env.CI?[['github'],['html',{open:'never'}]]:'list',
  use:{
    baseURL:'http://127.0.0.1:4173',
    trace:'retain-on-failure',
    screenshot:'only-on-failure',
    video:'retain-on-failure'
  },
  projects:[
    {name:'chromium-desktop',use:{
      ...devices['Desktop Chrome'],
      viewport:{width:1440,height:900},
      launchOptions:{args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']}
    }},
    {name:'webkit-iphone',use:{...devices['iPhone 13'],browserName:'webkit'}}
  ],
  webServer:{
    command:'npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url:'http://127.0.0.1:4173',
    reuseExistingServer:!process.env.CI,
    timeout:60_000
  }
});

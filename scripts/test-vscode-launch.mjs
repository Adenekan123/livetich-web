import { _electron as electron } from 'playwright-core';
import path from 'path';

async function test() {
  console.log('Testing Electron launch with VS Code...');
  const app = await electron.launch({
    executablePath: 'C:\\Users\\User\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe',
    args: [
      '--no-sandbox',
      '--disable-gpu',
      '--extensionDevelopmentPath=C:\\Users\\User\\OneDrive\\Documents\\netplus\\livetich-vscode',
      '--user-data-dir=' + path.resolve('./temp-vscode-user-data'),
    ],
  });
  console.log('VS Code launched successfully!');
  const window = await app.firstWindow();
  console.log('Got first window title:', await window.title());
  await window.screenshot({ path: 'temp-vscode-window.png' });
  console.log('Captured screenshot to temp-vscode-window.png');
  await app.close();
  console.log('Closed app.');
}

test().catch(console.error);

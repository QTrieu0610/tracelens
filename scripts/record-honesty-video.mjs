import { chromium } from 'playwright';
import { startTestServer } from '../tests/test-server.mjs';
import { mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const recordsDir = resolve(repoRoot, 'records');
const artifactDir = 'C:/Users/vderf/.gemini/antigravity-cli/brain/d9bf7fb8-cbbe-4fed-9b52-62a9f7615b17';

mkdirSync(recordsDir, { recursive: true });

async function run() {
  console.log('1. Starting local Vite test server on port 5188...');
  const server = await startTestServer(5188);
  console.log(`Test server running at ${server.url}`);

  console.log('2. Launching Playwright Chrome with video recording (1280x720)...');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    recordVideo: {
      dir: recordsDir,
      size: { width: 1280, height: 720 },
    },
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  try {
    console.log('3. Navigating to TraceLens...');
    await page.goto(server.url);
    await page.waitForTimeout(2000);

    console.log('4. Navigating to Trace Explorer tab...');
    await page.getByTestId('nav-tab-explorer').click();
    await page.waitForTimeout(2000);

    console.log('5. Selecting Run: False Completion Claim (run-demo-honesty-fcc-001)...');
    const select = page.getByLabel('Select execution run');
    await select.selectOption({ value: 'run-demo-honesty-fcc-001' });
    await page.waitForTimeout(2500);

    // Screenshot 1: Discrepancy detected
    const shot1 = resolve(recordsDir, 'step1-fcc-detected.png');
    await page.screenshot({ path: shot1 });
    console.log(`Saved screenshot 1 to ${shot1}`);

    console.log('6. Demonstrating Click-to-Focus: Clicking "Jump to #3 ->"...');
    const jumpButton = page.getByText(/Jump to #3/);
    await jumpButton.hover();
    await page.waitForTimeout(1200);
    await jumpButton.click();
    await page.waitForTimeout(2000);

    // Click Output tab in StepInspector to see the exact runner failure
    console.log('7. Inspecting failure details in StepInspector (Output tab)...');
    await page.getByRole('button', { name: 'Output', exact: true }).click();
    await page.waitForTimeout(2500);

    // Screenshot 2: Jumped to failure
    const shot2 = resolve(recordsDir, 'step2-jumped-to-failure.png');
    await page.screenshot({ path: shot2 });
    console.log(`Saved screenshot 2 to ${shot2}`);

    // Inspect Step 4 (Agent Final Summary) claiming success
    console.log('8. Inspecting Step #4 to demonstrate agent sycophancy claim...');
    await page.getByTestId('step-item-step-04').click();
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: 'Thought', exact: true }).click();
    await page.waitForTimeout(2500);

    // Import Live AGY Stream Log
    console.log('9. Importing real live AGY execution trace (scratch/agy-project-run.jsonl)...');
    await page.getByTestId('open-import-modal-btn').click();
    await page.waitForTimeout(1200);
    const agyLogPath = resolve(repoRoot, 'scratch/agy-project-run.jsonl');
    await page.locator('input[type=file]').setInputFiles(agyLogPath);
    await page.waitForTimeout(3000);

    // Screenshot 3: Honest Pass on AGY live run
    const shot3 = resolve(recordsDir, 'step3-agy-honest-pass.png');
    await page.screenshot({ path: shot3 });
    console.log(`Saved screenshot 3 to ${shot3}`);

    // Inspect the test step of the live AGY run
    console.log('10. Inspecting live AGY test runner step...');
    const testStep = page.locator('[data-testid^="step-item-"]').filter({ hasText: /weather/i });
    if (await testStep.count() > 0) {
      await testStep.first().click();
      await page.waitForTimeout(1500);
      const outBtn = page.getByRole('button', { name: 'Output', exact: true });
      if (await outBtn.count() > 0) {
        await outBtn.click();
        await page.waitForTimeout(2500);
      }
    } else {
      await page.waitForTimeout(2000);
    }

    console.log('11. Finishing video recording...');
    await page.waitForTimeout(2000);
  } finally {
    const rawVideo = await page.video();
    const rawVideoPath = rawVideo ? await rawVideo.path() : null;

    await context.close();
    await browser.close();
    await server.close();

    if (rawVideoPath && existsSync(rawVideoPath)) {
      console.log(`Raw WebM video saved: ${rawVideoPath}`);

      const mp4Path = resolve(recordsDir, 'honesty-audit-demo.mp4');
      console.log(`12. Converting to MP4 via FFmpeg: ${mp4Path}...`);
      
      const conv = spawnSync('ffmpeg', [
        '-y',
        '-i', rawVideoPath,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '22',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        mp4Path
      ], { stdio: 'inherit' });

      if (conv.status === 0) {
        console.log(`MP4 Video successfully created at: ${mp4Path}`);
        
        // Copy to artifact directory
        if (existsSync(artifactDir)) {
          const destVideo = resolve(artifactDir, 'honesty-audit-demo.mp4');
          copyFileSync(mp4Path, destVideo);
          if (existsSync(resolve(recordsDir, 'step1-fcc-detected.png'))) {
            copyFileSync(resolve(recordsDir, 'step1-fcc-detected.png'), resolve(artifactDir, 'step1-fcc-detected.png'));
          }
          if (existsSync(resolve(recordsDir, 'step2-jumped-to-failure.png'))) {
            copyFileSync(resolve(recordsDir, 'step2-jumped-to-failure.png'), resolve(artifactDir, 'step2-jumped-to-failure.png'));
          }
          if (existsSync(resolve(recordsDir, 'step3-agy-honest-pass.png'))) {
            copyFileSync(resolve(recordsDir, 'step3-agy-honest-pass.png'), resolve(artifactDir, 'step3-agy-honest-pass.png'));
          }
          console.log(`Copied video and screenshots to artifact directory: ${artifactDir}`);
        }
      } else {
        console.error('FFmpeg conversion exited with non-zero code.');
      }
    }
  }
}

run().catch(err => {
  console.error('Failed to record video:', err);
  process.exit(1);
});

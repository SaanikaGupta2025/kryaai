const { chromium } = require('playwright');

(async () => {
  let browser;
  try {
    // Launch browser in headed mode for debugging
    console.log('Launching browser...');
    browser = await chromium.launch({ 
      headless: false,
      args: [
        '--use-fake-ui-for-media-stream',
        '--disable-web-security',
        '--no-sandbox'
      ]
    });
    
    // Create a new context with permissions
    console.log('Creating browser context...');
    const context = await browser.newContext({
      permissions: ['microphone', 'camera'],
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });

    // Enable request logging
    context.on('request', request => 
      console.log(`Request: ${request.method()} ${request.url()}`)
    );
    context.on('response', response => 
      console.log(`Response: ${response.status()} ${response.url()}`)
    );

    // Create a new page
    console.log('Creating new page...');
    const page = await context.newPage();

    // Automatically dismiss dialogs (like the "Open Zoom Meetings?" prompt)
    page.on('dialog', dialog => {
        console.log(`Dialog appeared: ${dialog.message()}`);
        dialog.dismiss();
        console.log('Dialog dismissed.');
    });

    // Set default timeout
    page.setDefaultTimeout(60000);

    // Navigate to the Zoom meeting URL
    const zoomURL = 'https://us05web.zoom.us/j/82901723778?pwd=nNIqXEuHzqis2KmuhgWZ5pY70X0Xaq.1&_x_zm_tcld=1';
    console.log('Navigating to Zoom meeting...');
    // Use a short timeout for goto, just to initiate navigation
    await page.goto(zoomURL, { timeout: 15000 }).catch(e => {
      console.log('Navigation may have timed out, proceeding anyway...');
    });

    // Add a small wait to allow any immediate dialogs to be dismissed and page to settle
    console.log('Waiting briefly after navigation for dialog dismissal...');
    await page.waitForTimeout(3000);

    // Immediately look for join options without waiting for full page load
    console.log('Looking for join options...');

    const joinBrowserSelector = 'text=Join from Your Browser';
    const havingIssuesSelector = ':text-matches("Having issues\\? Join from your browser", "i")';
    
    let joinLink;
    try {
        joinLink = await Promise.race([
            page.waitForSelector(joinBrowserSelector, { state: 'visible', timeout: 45000 }),
            page.waitForSelector(havingIssuesSelector, { state: 'visible', timeout: 45000 })
        ]);

        const joinLinkText = await joinLink.innerText();
        console.log(`Found join link: ${joinLinkText}, clicking...`);
        await joinLink.click();

    } catch (error) {
        console.error('❌ Failed to find browser join link within timeout.');
        throw new Error('Browser join links not found.');
    }

    // Wait for navigation or for the next page to load after clicking the join link
    console.log('Waiting for the next page to load after clicking join link...');
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 });

    // Fill in name (This part should be consistent once we are on the browser join page)
    console.log('Entering display name...');
    await page.waitForSelector('input#inputname', { timeout: 30000 });
    await page.fill('input#inputname', 'PromiseAI Bot');

    // Agree to terms and click join
    console.log('Accepting terms and joining...');
    // Check if the terms checkbox is visible before clicking
    const termsCheckbox = page.locator('input#term');
    if (await termsCheckbox.isVisible()) {
        await termsCheckbox.click();
    } else {
        console.log('Terms checkbox not visible, skipping.');
    }
    
    await page.click('button.joinBtn');

    console.log('✅ Bot should be joining the meeting!');

    // Keep the browser open for debugging - comment this out for headless mode
    // await new Promise(() => {}); // This keeps the script running

  } catch (error) {
    console.error('An error occurred:', error);
    if (browser) {
      await browser.close();
    }
  }
})(); 
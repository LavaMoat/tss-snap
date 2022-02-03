import { test, expect } from '@playwright/test';

const TEST_URL = process.env.TEST_URL || "http://localhost:8080";

test('create key shares', async ({ context, page }) => {
  /*
  context.on('page', async newPage => {
    clients.push(newPage);
    if (clients.length == 3) {

      console.log("Got enough clients...");

      await Promise.all(clients.map((page) => {
        page.waitForLoadState();
      }));

      await Promise.all(clients.map((page) => {
        page.waitForSelector("div.connected");
      }));

      await page.pause();

      // FIXME: remove this
      //await page.waitForTimeout(1000);

      // Initiate the keygen session, this event is broadcast
      // to all connected clients to each tab will update their state
      const startSession = page.locator('#create-keygen-session');
      await startSession.click();

    }
  })
  */

  await page.goto(TEST_URL);
  const button = page.locator('form.group input[type="submit"]');
  await button.click();
  await page.waitForURL(/keygen\/.*$/);
  const url = page.url();

  const link = page.locator(`a[href="${url}"]`);


  // Initiate the keygen session, this event is broadcast
  // to all connected clients to each tab will update their state
  // but waiting for this doesn't seem to work in playwright
  // so we have to extract the sessionId and manually join.
  const startSession = page.locator('#create-keygen-session');
  await startSession.click();

  const sessionId = await page.locator('span.session-id').innerText();

  // Open two more clients in tabs
  // to join the group
  await link.click();
  await context.waitForEvent('page');
  await link.click();
  await context.waitForEvent('page');

  const clients = context.pages();

  const client1 = page;
  const client2 = clients[1];
  const client3 = clients[2];

  const joinSession = async (page) => {
    const input = page.locator("#keygen-session-id");
    input.fill(sessionId);
    const submit = page.locator(".join-keygen-session");
    await submit.click();
  }

  joinSession(client2);
  joinSession(client3);

  page.bringToFront();

  await page.pause();
});

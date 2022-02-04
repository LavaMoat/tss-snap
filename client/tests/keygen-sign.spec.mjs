import { test, expect } from "@playwright/test";

const TEST_URL = process.env.TEST_URL || "http://localhost:8080";

test("create key shares and sign message", async ({ context, page }) => {
  await page.goto(TEST_URL);
  const button = page.locator('form.group input[type="submit"]');
  await button.click();
  await page.waitForURL(/keygen\/.*$/);
  const url = page.url();

  const link = page.locator(`a[href="${url}"]`);

  // Open two more clients in tabs
  // to join the group
  await link.click();
  await context.waitForEvent("page");
  await link.click();
  await context.waitForEvent("page");

  const clients = context.pages();
  const client1 = page;
  const client2 = clients[1];
  const client3 = clients[2];

  await Promise.all(
    clients.map((page) => {
      return page.waitForSelector("div.connected");
    })
  );

  // Initiate the keygen session, this event is broadcast
  // to all connected clients to each tab will update their state
  // but waiting for this doesn't seem to work in playwright
  // so we have to extract the sessionId and manually join.
  const startSession = page.locator(".create-keygen-session");
  await startSession.click();

  await page.bringToFront();

  const sessionSignup = async (page) => {
    const button = page.locator(".keygen-signup");
    await button.click();
  };

  // Start session on each page
  await Promise.all(
    clients.map((page) => {
      return sessionSignup(page);
    })
  );

  // When keygen completes they will navigate
  // to the sign view
  await Promise.all(
    clients.map((page) => {
      return page.waitForSelector("h3.address");
    })
  );

  // Get address of the first client.
  const address = await client1.locator("h3.address").innerText();
  const expected = [address, address, address];

  const addresses = await Promise.all(
    clients.map((page) => {
      return client1.locator("h3.address").innerText();
    })
  );

  expect(addresses).toStrictEqual(expected);

  // Generate a proposal for the message to sign
  const message = page.locator('form > textarea[name="message"]');
  const submit = page.locator('form > input[type="submit"]');
  await message.fill("Test message");
  await submit.click();

  // Wait for the message proposal notification
  // to be received by all clients
  await Promise.all(
    clients.map((page) => {
      return page.waitForSelector(".proposal");
    })
  );

  // Two clients sign the proposal
  async function signMessage(page) {
    const signProposal = page.locator(".proposal .sign-proposal");
    await signProposal.click();
  };
  await signMessage(client1);
  await signMessage(client2);

  // TODO: ensure non-participant sees the signed message

  const expectedSignedAddresses = [address, address];
  const signedAddresses = await Promise.all(
    [client1, client2].map((page) => {
      return page.locator('.proposal .address').innerText();
    })
  );

  expect(signedAddresses).toStrictEqual(expectedSignedAddresses);

  await page.pause();
});

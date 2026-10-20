import { expect, test } from "@playwright/test";
import { apiE2EConfigurationError } from "./environment";
import { expectRpcDenied, loadFixtureState, rpc, signIn } from "./supabase-api";

const configurationError = apiE2EConfigurationError();
test.skip(Boolean(configurationError), configurationError || "");

const sessions = async () => ({
  client: await signIn(process.env.E2E_CLIENT_EMAIL!, process.env.E2E_CLIENT_PASSWORD!),
  craftsman: await signIn(process.env.E2E_CRAFTSMAN_EMAIL!, process.env.E2E_CRAFTSMAN_PASSWORD!),
  admin: await signIn(process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!),
});

test("isolated API fixtures preserve Client, Craftsman, and Admin role isolation", async () => {
  const { client, craftsman, admin } = await sessions();

  await expect(rpc<unknown[]>(client, "list_my_client_bookings")).resolves.toEqual(expect.any(Array));
  await expectRpcDenied(client, "list_my_worker_bookings");
  await expect(rpc<unknown[]>(craftsman, "list_my_worker_bookings")).resolves.toEqual(expect.any(Array));
  await expectRpcDenied(craftsman, "list_my_client_bookings");
  await expect(rpc<Record<string, unknown>>(admin, "get_current_admin_context")).resolves.toEqual(
    expect.objectContaining({ permissions: expect.any(Array) })
  );
  await expectRpcDenied(client, "get_current_admin_context");
});

test("isolated API fixtures complete the job-post, booking, and booking-message chain", async () => {
  const { client, craftsman, admin } = await sessions();
  const fixture = loadFixtureState();
  const marker = fixture.runMarker;
  const post = await rpc<{ id: string }>(client, "create_job_post", {
    p_title: `${marker} electrical request`,
    p_profession_name: "ელექტრიკოსი",
    p_city: "თბილისი",
    p_area_label: "ვაკე",
    p_description: `${marker} deterministic API workflow fixture request`,
    p_budget_min: 50,
    p_budget_max: 100,
    p_preferred_date: "2030-01-20",
  });

  await rpc(craftsman, "express_interest_in_job_post", {
    p_job_post_id: post.id,
    p_message: `${marker} interest`,
    p_estimate_min: 50,
    p_estimate_max: 100,
  });
  await rpc(client, "select_job_post_worker", {
    p_job_post_id: post.id,
    p_worker_id: fixture.craftsman.workerId,
  });
  const booking = await rpc<{ booking_id: string }>(client, "create_booking_from_job_post", {
    p_job_post_id: post.id,
    p_scheduled_at: "2030-01-20T10:00:00+04:00",
    p_address_text: "თბილისი, E2E მისამართი 1",
  });

  await rpc(client, "send_booking_message", {
    p_booking_id: booking.booking_id,
    p_text: `${marker} client message`,
    p_attachment_url: null,
    p_attachment_type: null,
    p_attachment_name: null,
  });
  const messages = await rpc<Array<{ text: string }>>(craftsman, "list_booking_messages", {
    p_booking_id: booking.booking_id,
  });
  expect(messages.some((message) => message.text === `${marker} client message`)).toBe(true);
  await expect(rpc<unknown[]>(admin, "list_admin_bookings")).resolves.toEqual(expect.any(Array));
});

test("isolated API fixtures keep Admin-to-Craftsman support messages private", async () => {
  const { client, craftsman, admin } = await sessions();
  const fixture = loadFixtureState();
  const marker = `${fixture.runMarker}:support`;

  await rpc(admin, "send_admin_worker_support_message", {
    p_worker_id: fixture.craftsman.workerId,
    p_text: marker,
  });
  const threads = await rpc<Array<{ conversation_id: string }>>(craftsman, "list_my_worker_support_threads");
  expect(threads).toHaveLength(1);
  const messages = await rpc<Array<{ text: string }>>(craftsman, "list_my_worker_support_messages", {
    p_conversation_id: threads[0].conversation_id,
  });
  expect(messages.some((message) => message.text === marker)).toBe(true);
  await rpc(craftsman, "send_my_worker_support_message", { p_text: `${marker} reply` });
  const adminMessages = await rpc<Array<{ text: string }>>(admin, "list_admin_worker_support_messages", {
    p_worker_id: fixture.craftsman.workerId,
  });
  expect(adminMessages.some((message) => message.text === `${marker} reply`)).toBe(true);
  await expectRpcDenied(client, "list_my_worker_support_threads");
});

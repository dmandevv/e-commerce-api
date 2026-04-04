// Tests for email service: initEmailService and sendEmail.
// Mocks nodemailer so no real SMTP connection is made.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────
const { mockSendMail, mockCreateTransport } = vi.hoisted(() => ({
  mockSendMail: vi.fn(),
  mockCreateTransport: vi.fn(),
}));

// ─── Mock: nodemailer ─────────────────────────────────────────────
// createTransport returns an object with sendMail.
vi.mock("nodemailer", () => ({
  default: {
    createTransport: mockCreateTransport.mockReturnValue({
      sendMail: mockSendMail,
    }),
  },
}));

// ─── Mock: config ─────────────────────────────────────────────────
vi.mock("../config/index.js", () => ({
  config: {
    smtp: { host: "smtp.test.com", port: 587, user: "user", pass: "pass" },
    fromEmail: "store@test.com",
  },
}));

// ─── Import AFTER mocks ──────────────────────────────────────────
import { initEmailService, sendEmail } from "./emailService.js";

// ─── Reset mocks between tests ───────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────
describe("initEmailService", () => {
  it("should create transporter with SMTP config", () => {
    initEmailService();
    expect(mockCreateTransport).toHaveBeenCalledWith({
      host: "smtp.test.com",
      port: 587,
      auth: { user: "user", pass: "pass" },
    });
  });
});

describe("sendEmail", () => {
  it("should send email via transporter", async () => {
    // Must init first so internal transporter is set
    initEmailService();
    mockSendMail.mockResolvedValue(undefined);

    await sendEmail("customer@test.com", "Welcome!", "<h1>Hi</h1>");

    expect(mockSendMail).toHaveBeenCalledWith({
      from: "store@test.com",
      to: "customer@test.com",
      subject: "Welcome!",
      html: "<h1>Hi</h1>",
    });
  });
});

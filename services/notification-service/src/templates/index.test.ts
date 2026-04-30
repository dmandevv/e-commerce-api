import { describe, it, expect } from "vitest";
import { verifyEmail, passwordReset, orderConfirmation, paymentReceipt, paymentFailed, orderStatusUpdate } from "./index.js";

describe("verifyEmail", () => {
    it("should return verify subject and html with name and verification token", () => {
        const { subject, html } = verifyEmail("Name", "Token");
        expect(subject).toBe("Verify your email address");
        expect(html).toContain("Name");
        expect(html).toContain("Token");
    });
});

describe("passwordReset", () => {
    it("should return password subject and html with reset token", () => {
        const { subject, html } = passwordReset("Token");
        expect(subject).toBe("Reset your password");
        expect(html).toContain("Token");
    });
});

describe("orderConfirmation", () => {
    it("should return order confirmed email with orderId, itemCount and total", () => {
        const { subject, html } = orderConfirmation("Order1010101010", 100, 5);
        expect(subject).toContain("Order101");
        expect(html).toContain("Order101");
        expect(html).toContain("5");
        expect(html).toContain("100.00");
    });
});

describe("paymentReceipt", () => {
    it("should return payment receipt email with orderId and total", () => {
        const { subject, html } = paymentReceipt("Order0", 55.000);
        expect(subject).toContain("Order0");
        expect(html).toContain("55.00");
        expect(html).toContain("Order0");
    });
});

describe("paymentFailed", () => {
    it("should return payment failed email with orderId and reason for failure", () => {
        const { subject, html } = paymentFailed("OrderId", "It just did");
        expect(subject).toContain("OrderId");
        expect(html).toContain("OrderId");
        expect(html).toContain("It just did");
    });
});

describe("orderStatusUpdate", () => {
    it("should return email info with updated orderId and/or status", () => {
        const { subject, html } = orderStatusUpdate("OrderId", "New Status");
        expect(subject).toContain("OrderId");
        expect(html).toContain("OrderId");
        expect(html).toContain("New Status");
    });
});
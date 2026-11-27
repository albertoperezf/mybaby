import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/schema";
import { addBaby, addFeedings } from "@/db/repo";
import { getSetting, setSetting } from "@/db/settings";
import { CryptoError, decryptBackupText, encryptBackupText, isEncryptedBackupText } from "@/features/backup/crypto";
import { backupJson, buildBackup } from "@/features/backup/export";
import { importBackupText } from "@/features/backup/import";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("encrypted backup (AES-256-GCM + PBKDF2-SHA256)", () => {
  it("encrypts, detects, and decrypts a backup round-trip", async () => {
    const baby = await addBaby({ name: "Ada", birthDate: "2026-05-01" });
    await addFeedings([baby.id], { at: Date.UTC(2026, 5, 10, 9, 0), amountMl: 90, note: "morning bottle" });

    const plain = await backupJson();
    const enc = await encryptBackupText(plain, "correct horse battery", 20_000);

    expect(isEncryptedBackupText(plain)).toBe(false);
    expect(isEncryptedBackupText(enc)).toBe(true);
    expect(enc).not.toContain("Ada");
    expect(enc).not.toContain("morning bottle");

    const decrypted = await decryptBackupText(enc, "correct horse battery");
    expect(decrypted).toBe(plain);
  });

  it("rejects wrong passphrases and tampered ciphertext", async () => {
    const enc = await encryptBackupText('{"hello":"world"}', "secret-pass", 20_000);
    await expect(decryptBackupText(enc, "wrong-pass")).rejects.toThrow(CryptoError);

    const parsed = JSON.parse(enc);
    parsed.ciphertext = parsed.ciphertext.slice(0, -4) + "AAAA";
    await expect(decryptBackupText(JSON.stringify(parsed), "secret-pass")).rejects.toThrow(CryptoError);
  });

  it("rejects malformed envelopes", async () => {
    await expect(decryptBackupText("not json", "secret")).rejects.toThrow(CryptoError);
    await expect(decryptBackupText(JSON.stringify({ app: "mybaby", encrypted: true, v: 99 }), "secret")).rejects.toThrow(
      CryptoError,
    );
  });
});

describe("caregiver share-by-file", () => {
  it("filters by baby & time window, omits personal settings, and merges cleanly into another device", async () => {
    const ada = await addBaby({ name: "Ada", birthDate: "2026-05-01" });
    const leo = await addBaby({ name: "Leo", birthDate: "2026-05-01" });
    const oldAt = Date.UTC(2026, 4, 15, 9, 0);
    const recentAt = Date.UTC(2026, 5, 10, 9, 0);
    const caregiverBAt = Date.UTC(2026, 5, 10, 12, 0);

    await addFeedings([ada.id], { at: oldAt, amountMl: 60 });
    await addFeedings([ada.id], { at: recentAt, amountMl: 120 });
    await addFeedings([leo.id], { at: recentAt, amountMl: 90 });

    await setSetting("theme", "dark");
    await setSetting("locale", "es");

    const share = await buildBackup({
      babyId: ada.id,
      includeSettings: false,
      since: Date.UTC(2026, 5, 1, 0, 0),
    });

    expect(share.settings).toBeUndefined();
    expect(share.data.babies.map((b) => b.name)).toEqual(["Ada"]);
    expect(share.data.feedings).toHaveLength(1);
    expect(share.data.feedings[0].amountMl).toBe(120);

    // Simulate Caregiver B's device with Light theme, English, and their own logged feeding for Ada.
    const encryptedShare = await encryptBackupText(JSON.stringify(share), "family-code", 20_000);
    await db.delete();
    await db.open();
    await setSetting("theme", "light");
    await setSetting("locale", "en");
    await db.babies.add(ada);
    await addFeedings([ada.id], { at: caregiverBAt, amountMl: 100 });

    const decrypted = await decryptBackupText(encryptedShare, "family-code");
    const res = await importBackupText(decrypted, "merge", true);
    expect(res.added).toBe(1); // Ada's recent feed from Caregiver A
    expect(await db.feedings.count()).toBe(2); // both caregivers' feeds preserved
    expect(await getSetting("theme")).toBe("light"); // Caregiver B's personal theme untouched
    expect(await getSetting("locale")).toBe("en");
  });
});

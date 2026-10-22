import { describe, expect, it } from "vitest";
import { addressReach } from "@/lib/address";

describe("addressReach", () => {
  it("knows addresses that only work on the computer running SnS Palace", () => {
    for (const url of ["http://localhost:3000/", "http://127.0.0.1:3000/", "http://[::1]:3000/", "http://0.0.0.0:3000/"]) {
      expect(addressReach(url), url).toBe("this-computer");
    }
  });

  it("knows home network addresses", () => {
    for (const url of [
      "http://192.168.1.20:3000/",
      "http://10.0.0.5:3000/",
      "http://172.20.1.2:3000/",
      "http://family-pc.local:3000/",
      "http://[fd12:3456::1]:3000/",
    ]) {
      expect(addressReach(url), url).toBe("home-network");
    }
  });

  it("treats everything else as reachable from anywhere", () => {
    for (const url of ["https://sns-palace.onrender.com/", "https://palace.example.com/", "http://172.32.0.1/", "http://8.8.8.8/"]) {
      expect(addressReach(url), url).toBe("anywhere");
    }
  });
});

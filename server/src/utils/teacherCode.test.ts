import { describe, expect, it } from "vitest";
import { generateParentCode, generateTeacherCode } from "./teacherCode.js";

const CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

describe("teacher/parent code generation", () => {
  it("generates a 6-character code using only the unambiguous alphabet", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateTeacherCode()).toMatch(CODE_PATTERN);
      expect(generateParentCode()).toMatch(CODE_PATTERN);
    }
  });

  it("excludes visually-confusable characters (0, O, 1, I)", () => {
    const codes = Array.from({ length: 200 }, () => generateTeacherCode()).join("");
    expect(codes).not.toMatch(/[0O1I]/);
  });

  it("is not deterministic — repeated calls produce different codes", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateTeacherCode()));
    // 20 draws from a 33^6 space should essentially never collide.
    expect(codes.size).toBe(20);
  });
});

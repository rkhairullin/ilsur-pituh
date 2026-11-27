import { expect, test } from "vitest";
import {
  GAME_ACTIONS,
  clearInput,
  createInputState,
  isGameAction,
  pressPointer,
  readControls,
  releasePointer,
  updateKeyboardInput,
} from "../../client/games/ilsur-platformer/input.js";

test("maps every configured keyboard key to its action", () => {
  const input = createInputState();
  const keys = [
    ["ArrowLeft", "left"],
    ["KeyA", "left"],
    ["ArrowRight", "right"],
    ["KeyD", "right"],
    ["ArrowUp", "jump"],
    ["KeyW", "jump"],
    ["Space", "jump"],
    ["ArrowDown", "crouch"],
    ["KeyS", "crouch"],
    ["KeyX", "shoot"],
    ["KeyJ", "shoot"],
  ] as const;

  for (const [code, action] of keys) {
    expect(updateKeyboardInput(input, code, true)).toBe(true);
    expect(readControls(input)[action]).toBe(true);
    expect(updateKeyboardInput(input, code, false)).toBe(true);
    expect(readControls(input)[action]).toBe(false);
  }
  expect(updateKeyboardInput(input, "Escape", true)).toBe(false);
});

test("combines keyboard and simultaneous pointers until each source releases", () => {
  const input = createInputState();
  pressPointer(input, 1, "left");
  pressPointer(input, 2, "shoot");
  pressPointer(input, 3, "shoot");
  expect(readControls(input)).toEqual({
    left: true,
    right: false,
    jump: false,
    crouch: false,
    shoot: true,
  });

  updateKeyboardInput(input, "ArrowLeft", true);
  expect(releasePointer(input, 1)).toBe(true);
  expect(readControls(input).left).toBe(true);
  expect(releasePointer(input, 2)).toBe(true);
  expect(readControls(input).shoot).toBe(true);
  expect(releasePointer(input, 99)).toBe(false);
  expect(releasePointer(input, 3)).toBe(true);
  expect(readControls(input).shoot).toBe(false);
  updateKeyboardInput(input, "ArrowLeft", false);
  expect(readControls(input).left).toBe(false);
});

test("clears held controls and validates action names", () => {
  const input = createInputState();
  pressPointer(input, 7, "jump");
  updateKeyboardInput(input, "KeyX", true);
  clearInput(input);
  expect(readControls(input)).toEqual({
    left: false,
    right: false,
    jump: false,
    crouch: false,
    shoot: false,
  });
  expect(isGameAction(undefined)).toBe(false);
  expect(isGameAction("dance")).toBe(false);
  for (const action of GAME_ACTIONS) expect(isGameAction(action)).toBe(true);
});

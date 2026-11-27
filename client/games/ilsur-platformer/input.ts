export const GAME_ACTIONS = [
  "left",
  "right",
  "jump",
  "crouch",
  "shoot",
] as const;

export type GameAction = (typeof GAME_ACTIONS)[number];

export interface GameControls {
  left: boolean;
  right: boolean;
  jump: boolean;
  crouch: boolean;
  shoot: boolean;
}

export interface InputState {
  keyboard: Set<GameAction>;
  pointers: Map<number, GameAction>;
}

const KEY_ACTIONS: Record<string, GameAction> = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowUp: "jump",
  KeyW: "jump",
  Space: "jump",
  ArrowDown: "crouch",
  KeyS: "crouch",
  KeyX: "shoot",
  KeyJ: "shoot",
};

export function isGameAction(value: string | undefined): value is GameAction {
  return GAME_ACTIONS.some((action) => action === value);
}

export function createInputState(): InputState {
  return { keyboard: new Set(), pointers: new Map() };
}

export function updateKeyboardInput(
  input: InputState,
  code: string,
  pressed: boolean,
): boolean {
  const action = KEY_ACTIONS[code];
  if (!action) return false;
  if (pressed) input.keyboard.add(action);
  else input.keyboard.delete(action);
  return true;
}

export function pressPointer(
  input: InputState,
  pointerId: number,
  action: GameAction,
) {
  input.pointers.set(pointerId, action);
}

export function releasePointer(input: InputState, pointerId: number) {
  return input.pointers.delete(pointerId);
}

export function clearInput(input: InputState) {
  input.keyboard.clear();
  input.pointers.clear();
}

export function readControls(input: InputState): GameControls {
  const active = new Set([...input.keyboard, ...input.pointers.values()]);
  return {
    left: active.has("left"),
    right: active.has("right"),
    jump: active.has("jump"),
    crouch: active.has("crouch"),
    shoot: active.has("shoot"),
  };
}

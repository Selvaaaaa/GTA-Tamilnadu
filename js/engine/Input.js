export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {};
    this.keysJustPressed = {};
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.mouseJustPressed = false;
    this.locked = false;

    window.addEventListener('keydown', (e) => {
      if (!this.keys[e.code]) this.keysJustPressed[e.code] = true;
      this.keys[e.code] = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });

    canvas.addEventListener('mousemove', (e) => {
      if (this.locked) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.mouseJustPressed = true;
      }
    });
    canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
  }

  isDown(code) { return !!this.keys[code]; }
  justPressed(code) { return !!this.keysJustPressed[code]; }
  getMouseDelta() { return { x: this.mouseDX, y: this.mouseDY }; }
  requestLock() { this.canvas.requestPointerLock(); }

  endFrame() {
    this.keysJustPressed = {};
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseJustPressed = false;
  }
}

import Stats from "stats.js";
import { Device } from "../core/Device";
import { Renderer } from "../core/Renderer";
import { attachResize, sizeCanvas } from "./resize";

export async function bootstrap() {
  const canvas = document.querySelector<HTMLCanvasElement>("#app");
  if (!canvas) {
    showWebGPUError();
    return;
  }

  sizeCanvas(canvas);

  try {
    const { device, context, format } = await Device.init(canvas);
    const renderer = new Renderer(device, context, format, canvas);
    await renderer.init();

    attachResize(canvas, (w, h) => {
      renderer.onResize(w, h);
    });

    const stats = new Stats();
    stats.showPanel(0);
    document.body.appendChild(stats.dom);
    let last = performance.now();

    const loop = (t: number) => {
      stats?.begin();

      last = t;
      renderer.update();
      renderer.render();

      stats?.end();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  } catch (error) {
    showWebGPUError();
    return;
  }
}

function showWebGPUError() {
  const errorElement = document.getElementById("webgpu-error");
  const canvas = document.querySelector<HTMLCanvasElement>("#app");

  if (errorElement) {
    errorElement.style.display = "flex";
  }
  if (canvas) {
    canvas.style.display = "none";
  }
}

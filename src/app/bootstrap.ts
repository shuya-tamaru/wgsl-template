import { Device } from "../core/Device";
import { Renderer } from "../core/Renderer";

export async function bootstrap() {
  const canvas = document.querySelector<HTMLCanvasElement>("#app");
  if (!canvas) throw new Error("canvas not found");

  const rawDpr = window.devicePixelRatio || 1;
  const dpr = Math.min(rawDpr, 2);
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;

  const { device, context } = await Device.init(canvas);
  const renderer = new Renderer(device, context);

  const loop = () => {
    renderer.render();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

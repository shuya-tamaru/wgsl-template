import { Device } from "../core/Device";
import { Renderer } from "../core/Renderer";
import { attachResize, sizeCanvas } from "./resize";

export async function bootstrap() {
  const canvas = document.querySelector<HTMLCanvasElement>("#app");
  if (!canvas) throw new Error("canvas not found");

  sizeCanvas(canvas);

  const { device, context, format } = await Device.init(canvas);
  const renderer = new Renderer(device, context, format);
  await renderer.init();

  attachResize(canvas, (w, h) => {
    renderer.onResize(w, h);
  });

  const loop = () => {
    renderer.update(1 / 60);
    renderer.render();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

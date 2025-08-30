# TS + WGSL テンプレート構成

最小要件：

- Vite + TypeScript
- WebGPU 初期化（`adapter`/`device`/`context`）
- マウス&ホイールで操作できる OrbitCamera（回転・ズーム）
- リサイズ対応（`devicePixelRatio` を考慮）
- フォルダ規約 / 命名規約 / WGSL ルール

---

## 1) ディレクトリ構成（提案）

```
project-root/
├─ public/
│  └─ favicon.svg
├─ src/
│  ├─ app/
│  │  ├─ main.ts                 # エントリーポイント（最小ロジックのみ）
│  │  ├─ bootstrap.ts            # 初期化の手順を関数化
│  │  └─ resize.ts               # リサイズ監視のセットアップ
│  ├─ core/
│  │  ├─ Device.ts               # adapter/device/swapchain の用意
│  │  ├─ Renderer.ts             # レンダリング全体のオーケストレーション
│  │  ├─ OrbitCamera.ts          # マウス/ホイール操作
│  │  ├─ Camera.ts               # ビュー/プロジェクション行列、ユーティリティ
│  │  ├─ Transform.ts            # モデル行列ユーティリティ（回転/平行移動/スケール）
│  │  ├─ types.ts                # 共通型定義（バッファ/パイプライン等）
│  │  └─ math/
│  │     ├─ mat4.ts              # 最低限の行列ヘルパ（gl-matrix 使わない場合）
│  │     └─ vec3.ts
│  ├─ gfx/
│  │  ├─ pipelines/
│  │  │  ├─ cube.pipeline.ts     # Cube 用 RenderPipeline 構築
│  │  │  └─ common.ts            # 深度/ラスタ/カラー状態など共通設定
│  │  ├─ buffers/
│  │  │  ├─ cube-geometry.ts     # 頂点/インデックス/ユニフォームバッファ作成
│  │  │  └─ create-buffer.ts     # バッファ生成の共通関数
│  │  ├─ bindgroups/
│  │  │  └─ cube.bindgroup.ts    # bindGroup 作成（カメラ/モデル行列など）
│  │  └─ passes/
│  │     └─ draw-cube.pass.ts    # コマンドエンコード（レンダー）
│  ├─ shaders/
│  │  ├─ cube.wgsl               # 頂点/フラグメント（1ファイル）
│  │  └─ include/                # 将来の共通 wgsl（構造体/関数）
│  ├─ systems/
│  │  └─ Time.ts                 # 経過時間/Δt 管理（アニメ・回転に利用）
│  ├─ utils/
│  │  ├─ dom.ts                  # キャンバス作成/取得など DOM ヘルパ
│  │  └─ error.ts                # エラーハンドリング/ガード
│  ├─ styles/
│  │  └─ style.css
│  └─ config/
│     └─ constants.ts            # 初期サイズ、FOV、near/far、色等
├─ index.html
├─ tsconfig.json
├─ vite.config.ts
├─ .editorconfig
├─ .gitignore
└─ README.md (→ このファイルを雛形として利用)
```

> 目的：**責務ごとに分割**し、`main.ts` は **“呼び出しだけ”** に寄せる。新規プロジェクトのクローン後も迷わない。

---

## 2) 起動の流れ

1. `main.ts` → `bootstrap()` を呼ぶ
2. `bootstrap()` 内で `Device.init()` → `Renderer` 生成
3. `Renderer.init()` で

   - `OrbitCamera` 準備
   - `Cube` 用ジオメトリ/UBO/パイプライン/BindGroup 構築
   - 深度テクスチャ確保

4. `requestAnimationFrame(loop)` 開始
5. `resize.ts` で Canvas サイズ/スワップチェーン/深度の再作成

---

## 3) Renderer の責務

- `initialize()`：リソース作成（1 回）
- `update(dt)`：カメラ更新、モデル回転など（毎フレーム）
- `render()`：コマンドエンコード & サブミット
- `onResize(width, height)`：深度テクスチャ/コンテキストフォーマットの再設定

> **重要**：`Renderer` は「演奏指揮」。パイプラインやジオメトリ生成は `gfx/*` 側に委譲。

---

## 4) OrbitCamera API（最小）

```ts
class OrbitCamera {
  constructor(
    canvas: HTMLCanvasElement,
    opts?: {
      target?: [number, number, number];
      distance?: number;
      minDist?: number;
      maxDist?: number;
      phi?: number;
      theta?: number;
    }
  );
  update(dt: number): void;
  view(): Float32Array; // 4x4
  projection(aspect: number): Float32Array; // 4x4
}
```

- ドラッグで `theta`/`phi`、ホイールで `distance` を更新。
- `clamp(phi, ε, π-ε)` で天頂/天底の特異点回避。
- 慣性（減衰）あり/なしはオプション。

---

## 5) リサイズ戦略

- `canvas.width = clientWidth * devicePixelRatio`
- `canvas.height = clientHeight * devicePixelRatio`
- `context.configure({ format, alphaMode: 'opaque', usage: ... })` を再実行
- 深度テクスチャも解像度に合わせて作り直す
- `Renderer.onResize()` から投影行列の再計算を呼ぶ

---

## 6) WGSL バインディング規約（例）

**BG0: Camera/Transform**

- `@group(0) @binding(0)`: `CameraUniform`（view\*projection）
- `@group(0) @binding(1)`: `ModelUniform`（model）

**構造体例**

```wgsl
struct CameraUniform {
  view : mat4x4<f32>,
  proj : mat4x4<f32>,
};
struct ModelUniform { model : mat4x4<f32>; };
```

> ルール：**行列は 16byte アライン**。`mat4x4<f32>` は 64byte。`std140` 風の並びを意識。

---

## 7) 命名・コード規約（抜粋）

**ファイル/フォルダ**

- `PascalCase.ts`：クラス (`Renderer.ts`, `Device.ts`)
- `kebab-case.ts`：ユーティリティ (`create-buffer.ts`)
- WGSL は `snake_case.wgsl`

**関数/変数**

- 関数は動詞から：`createCubeGeometry`, `buildCubePipeline`
- Uniform/Buffer は suffix：`...Buffer`, `...BindGroup`
- 行列は `model`, `view`, `proj` として 4x4 `Float32Array`

**その他**

- `main.ts` は 50 行以内。ロジックは他へ。
- 1 ファイル 200 行前後で分割検討。
- 1 モジュール = 1 責務。`Renderer` は描画手順のオーケストレーションのみ。

---

## 8) コーディング Tips（最小表示のためのチートシート）

**Device 初期化**

- `navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })`
- `adapter.requestDevice({ requiredFeatures: ['depth-clip-control'] /* 任意 */ })`

**スワップチェーン**

- `const format = navigator.gpu.getPreferredCanvasFormat()`
- `context.configure({ device, format, alphaMode: 'opaque' })`

**深度**

- `depth24plus` 推奨（テンプレートでは `depth32float` でも可）

**描画ループ**

- `encoder.beginRenderPass({ colorAttachments, depthStencilAttachment })`
- `setPipeline → setBindGroup → setVertexBuffer → setIndexBuffer → drawIndexed`

---

## 9) サンプル：Cube のデータ最小形

```ts
// cube-geometry.ts（概略）
export function createCubeGeometry(device: GPUDevice) {
  const vertices = new Float32Array([
    // pos(x,y,z), normal(x,y,z)
    // ... 24頂点（各面4頂点）
  ]);
  const indices = new Uint16Array([
    // 36 インデックス（6面 * 2 tri * 3）
  ]);
  const vertexBuffer = device.createBuffer({
    size: vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Float32Array(vertexBuffer.getMappedRange()).set(vertices);
  vertexBuffer.unmap();

  const indexBuffer = device.createBuffer({
    size: indices.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Uint16Array(indexBuffer.getMappedRange()).set(indices);
  indexBuffer.unmap();

  return { vertexBuffer, indexBuffer, indexCount: indices.length };
}
```

---

## 10) サンプル：シェーダ雛形（`shaders/cube.wgsl`）

```wgsl
struct CameraUniform { view: mat4x4<f32>, proj: mat4x4<f32> };
struct ModelUniform  { model: mat4x4<f32> };

@group(0) @binding(0) var<uniform> uCamera : CameraUniform;
@group(0) @binding(1) var<uniform> uModel  : ModelUniform;

struct VSIn  { @location(0) pos: vec3<f32>, @location(1) nrm: vec3<f32> };
struct VSOut { @builtin(position) pos: vec4<f32>, @location(0) nrm: vec3<f32> };

@vertex
fn vs_main(input: VSIn) -> VSOut {
  var out: VSOut;
  let m  = uModel.model;
  let vp = uCamera.proj * uCamera.view;
  let p4 = vec4<f32>(input.pos, 1.0);
  out.pos = vp * m * p4;
  out.nrm = (m * vec4<f32>(input.nrm, 0.0)).xyz;
  return out;
}

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let L = normalize(vec3(0.5, 0.8, 0.2));
  let N = normalize(in.nrm);
  let diff = max(dot(N, L), 0.1);
  return vec4<f32>(vec3(0.2, 0.6, 0.9) * diff, 1.0);
}
```

---

## 11) 追加ルール（将来拡張のために）

- **BindGroup レイアウトの固定化**：

  - BG0 = カメラ/モデル、BG1 = マテリアル、BG2 = ライト、BG3 = オブジェクト固有（粒子など）
  - 追加が必要なら **BG 番号は増やすだけ**（入れ替えない）

- **共通 include**：`shaders/include/` に構造体・関数を分離（`#include` はないため、TS 側で文字列連結）
- **ユニフォームのアラインメント**：`vec3` の後ろに `f32` のパディングを挿入するなど、16byte 整列を徹底
- **リソース破棄**：`GPUBuffer.destroy()` を **再割り当て時** に実行
- **FPS に依存しない回転**：`Time.deltaSeconds` を乗算

---

## 12) 実装チェックリスト（このテンプレで満たすこと）

- [ ] `npm create vite@latest` → ts テンプレ
- [ ] `Device.init()` で WebGPU 可用性チェック
- [ ] `Renderer.init()` で Cube 構築 & 深度作成
- [ ] `OrbitCamera` 操作 & ループ内更新
- [ ] `resize.ts` で DPR 対応リサイズ
- [ ] `README.md`（このファイル）を雛形としてプロジェクトに同梱

---

## 13) スクリプト例

```json
// package.json（一例）
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  }
}
```

---

## 14) よくある落とし穴

- **`getPreferredCanvasFormat()` を使わない** → SRGB ミスマッチ
- **DPR 未対応** → ぼやける
- **深度を作り直さない** → リサイズ後に Z テスト破綻
- **ユニフォームのアライン漏れ** → 変な行列/色
- **`model` を毎フレ回転するが `uniform` 書き戻し忘れ** → 静止

---

## 15) クローン → 新規開始手順（雛形）

```bash
git clone <this-template> my-wgsl-app
cd my-wgsl-app
npm i
npm run dev
```

必要に応じて：

- `src/gfx/pipelines/cube.pipeline.ts` を複製して新しい描画対象を作る
- `src/shaders/cube.wgsl` を参照して独自シェーダを作成

---

## 16) 付録：最小 `main.ts` のイメージ

```ts
import { bootstrap } from "./bootstrap";
bootstrap();
```

```ts
// bootstrap.ts
import { getCanvas } from "../utils/dom";
import { Device } from "../core/Device";
import { Renderer } from "../core/Renderer";
import { setupResize } from "./resize";

export async function bootstrap() {
  const canvas = getCanvas("#app");
  const { device, context, format } = await Device.init(canvas);
  const renderer = new Renderer(device, context, format, canvas);
  await renderer.initialize();
  setupResize(canvas, renderer);
  let last = performance.now();
  const loop = (t: number) => {
    const dt = (t - last) * 0.001;
    last = t;
    renderer.update(dt);
    renderer.render();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
```

---

これを雛形に、**Cube + OrbitCamera + Resize 対応の最小 WGSL テンプレ**としてクローン運用できます。必要に応じて、`core/` と `gfx/` を増やすだけで拡張可能。

export interface ZoomeConfig {
  name?: string;
  mode?: ZoomeMode;
  source: HTMLElement | null;
  viewer?: HTMLElement | null;
  matrix?: Matrix;
  container?: HTMLElement | null;
}

export enum ZoomeMode {
  ZOOMIN = "zoomin",
  ZOOMOUT = "zoomout",
  FIXED = 'fixed'
}

export interface Matrix {
  scaleX: number;
  scaleY: number;
  translateX: number;
  translateY: number;
}

export default class Zoome {
  protected _source: HTMLElement | null = null;
  protected _matrix: Matrix = { scaleX: 1, scaleY: 1, translateX: 0, translateY: 0 };
  protected _cloned: HTMLElement | null = null;
  name: string;
  mode: ZoomeMode;
  viewer: HTMLElement;
  viewBlock: HTMLElement | null = null;
  container: HTMLElement;
  observer: MutationObserver;

  constructor({ name, source, viewer, container, matrix, mode = ZoomeMode.ZOOMIN }: ZoomeConfig) {
    this.name = name || "zoome";
    this.mode = mode || ZoomeMode.ZOOMIN;
    this.viewer = viewer || this.createViewerElement();
    this.container = container || document.body;
    this.container.appendChild(this.viewer);
    this.observer = new MutationObserver((ms) => this.handleSourceMutated(ms))
    this.viewBlock = this.createViewBlock();
    this.matrix = { ...this._matrix, ...matrix }
    this.source = source;
  }

  public handleMouseMoveInSource = (event: MouseEvent) => {
    const { clientX: mX, clientY: mY } = event
    const { offsetWidth: vX, offsetHeight: vY } = this.viewer
    // const { offsetWidth: sX, offsetHeight: sY } = this.source as HTMLElement
    const { scaleX: ssX = 1, scaleY: ssY = 1 } = this.getSourceTransform();
    const { x, y } = this.source?.getBoundingClientRect() || { x: 0, y: 0 }
    const [dX, dY] = [mX - x, mY - y]
    if (this.cloned) {
      const { scaleX, scaleY } = this._matrix;
      const translateX = vX / 2 - dX / ssX * scaleX
      const translateY = vY / 2 - dY / ssY * scaleY
      this.matrix = { ...this._matrix, translateX, translateY }
    }
  }

  getSourceTransform() {
    if (this._source) {
      const style = window.getComputedStyle(this._source)
      const matrix = style.transform || style.webkitTransform;
      if (matrix === "none") {
        return { scaleX: 1, scaleY: 1, translateX: 0, translateY: 0 }
      }
      const parsed = matrix.split(/matrix\(|,|\)/).filter(x => !!x)
      if (parsed.length === 6) {
        const [scaleX, skewX, skewY, scaleY, translateX, translateY] = parsed.map(x => parseFloat(x))
        return { scaleX, scaleY, translateX, translateY, skewX, skewY }
      } else if (parsed.length === 9) {
        console.warn("3d transform not supported")
      }
    }
    return { scaleX: 1, scaleY: 1, translateX: 0, translateY: 0 }
  }

  get matrix() { return this._matrix; }
  get source() { return this._source; }
  get cloned() { return this._cloned; }
  get zoominp() { return this.mode === ZoomeMode.ZOOMIN }
  get zoomoutp() { return this.mode === ZoomeMode.ZOOMOUT }

  set matrix(matrix: Matrix) {
    this._matrix = { ...this._matrix, ...matrix }
    console.info(`zoome: ${this.name}: update matrix`)
    // const sourceMatrix = this.getSourceTransform();
    if (this.cloned) {
      const { scaleX, scaleY, translateX, translateY } = this._matrix
      const transform = `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`
      this.cloned.style.transform = transform

      if (this.zoominp) {
      } else if (this.zoomoutp) {
      } else { }
    }
  }

  set source(source: HTMLElement | null) {
    if (this._source === source) {
      console.warn("same source, skip...")
      return;
    }
    this._source && this.zoominp && this._source.removeEventListener("mousemove", this.handleMouseMoveInSource)
    this._source = source;
    this.observer.disconnect();
    this._source && this.observer.observe(this._source, { attributes: true, subtree: true, characterData: true, })
    this._source && this.zoominp && this._source.addEventListener("mousemove", this.handleMouseMoveInSource)
    this.handleSourceMutated([]);
    console.info(`zoome: ${this.name}: update source element`)
  }

  set cloned(cloned: HTMLElement | null) {
    this._cloned && this.viewer.removeChild(this._cloned)
    this._cloned = this.source?.cloneNode(true) as HTMLElement;
    if (cloned) {
      const id = cloned.id;
      cloned.id = (this.name || id) + "-zoome-cloned"
      this.viewer.appendChild(cloned)
      cloned.style.transformOrigin = "top left"
      console.log(`zoome: ${this.name}: cloned updated`)
    } else {

    }
    this._cloned = cloned;
  }

  protected createViewBlock() {
    const viewBlock = document.createElement("div");
    viewBlock.classList.add("zoome-view-block");
    viewBlock.id = this.name + "-zoome-view-block";
    viewBlock.style.border = "1px solid black";
    viewBlock.style.position = "absolute"

    this.viewer.appendChild(viewBlock)
    return viewBlock;
  }

  protected createViewerElement(): HTMLElement {
    const viewer = document.createElement("div");
    viewer.classList.add("zoome-viewer");
    return viewer;
  }

  handleSourceMutated(mutations?: MutationRecord[]) {
    // console.log(mutations);
    console.info(`zoome: ${this.name}: source changed`)
    if (!this._source) {
      console.warn(`zoome: ${this.name}: source undefined`)
      return
    }

    this.cloned = this._source.cloneNode(true) as HTMLElement;

    if (this.zoomoutp && this.viewBlock) {
      const sourceRect = this._source.getBoundingClientRect();
      const parentRect = this._source.parentElement?.getBoundingClientRect() || { width: 0, height: 0 };
      const viewerRect = this.viewer.getBoundingClientRect();
      const sourceMatrix = this.getSourceTransform();
      const scaleX = viewerRect.width / sourceRect.width * sourceMatrix.scaleX;
      const scaleY = viewerRect.height / sourceRect.height * sourceMatrix.scaleY;
      const scale = Math.min(scaleX, scaleY);
      this.matrix = { ...this.matrix, scaleX: scale, scaleY: scale }
      this.viewBlock.style.top = sourceRect.top / scale + ""
      this.viewBlock.style.left = sourceRect.left / scale + ""
      this.viewBlock.style.width = parentRect.width / scale + ""
      this.viewBlock.style.height = parentRect.height / scale + ""
    } else if (this.zoominp) {
      this.matrix = this._matrix;
    }
  }

  status() {
    return { source: this.source, viewer: this.viewer, container: this.container, matrix: this.matrix }
  }

  destory(): void {
    this.container.removeChild(this.viewer);
    this.observer.disconnect();
    console.info(`destory zoome ${this.name}`)
  }
}

export class SGVZoome extends Zoome {

}

<template>
  <div class="preview-page">
    <!-- 视频流区域 -->
    <div
      ref="contentWrap"
      class="content crop"
      @mousedown.stop="onContentMouseDown"
    >
      <div ref="canvasBoxWrap" class="canvas-box" :style="canvasBoxStyle">
        <canvas
          :width="canvasStyle.width"
          :height="canvasStyle.height"
        ></canvas>
        <div v-show="isClip" class="crop-box" :style="cropBoxStyle"></div>
      </div>
    </div>
    <!-- 操作区域，开启/暂停+ (进度条+裁剪进度条) + (render +删除 ). -->
    <div class="actions">
      <el-button type="primary" @click="togglePlayPause">
        <svg-icon
          :icon-class="playback.disposable ? 'pause' : 'play'"
          class="icon"
        ></svg-icon>
      </el-button>
      <div class="playbar">
        <el-input
          v-model="playback.head"
          type="range"
          :disabled="true"
          :max="getPlayBarMax"
          @input="onPlaybarInput($event)"
        ></el-input>
        <div class="trim-bar" :style="trimBarStyle">
          <div
            ref="trimStart"
            class="trim-start"
            @mousedown.stop="onTrimMouseDown($event, 'start')"
          ></div>
          <div
            ref="trimEnd"
            class="trim-end"
            @mousedown.stop="onTrimMouseDown($event, 'end')"
          ></div>
        </div>
      </div>
      <div class="button-group">
        <el-button type="primary" @click="startRendering">合成GIF</el-button>
        <el-button type="default" @click="deleteGIF">
          <svg-icon :icon-class="'delete'" class="icon"></svg-icon>
          <span>删除</span>
        </el-button>
      </div>
    </div>
  </div>
</template>
<script>
const FPS = 10;
const FRAME_DELAY = Math.floor(1000 / FPS);
import { getFrameIndex } from "../utils/utils";

export default {
  name: "Preview",
  props: {
    // eslint-disable-next-line vue/require-default-prop
    recording: Object,
    // eslint-disable-next-line vue/require-default-prop
    changeStatus: {
      required: false,
      type: Function
    },
    // eslint-disable-next-line vue/require-default-prop
    changeRecording: {
      required: false,
      type: Function
    },
    // eslint-disable-next-line vue/require-default-prop
    saveRender: {
      required: false,
      type: Function
    }
  },
  data() {
    return {
      canvas: undefined,
      playbar: undefined,
      content: undefined,
      viewport: {
        width: undefined,
        height: undefined,
        top: 0,
        left: 0,
        zoom: 1
      },
      viewportDisposable: undefined,
      playback: {
        head: 0,
        start: 0,
        end: this.recording.duration,
        disposable: undefined
      },
      trim: { start: 0, end: undefined },
      crop: {
        top: 0,
        left: 0,
        width: this.recording.width,
        height: this.recording.height
      }
    };
  },
  computed: {
    canvasStyle() {
      const { width = 800, height = 800 } = this.recording || {};
      return { width, height };
    },
    // 视图大小
    canvasBoxStyle() {
      const scale = value => value * this.viewport.zoom;
      const width = scale(this.recording.width);
      const height = scale(this.recording.height);
      const top = Math.floor(
        scale(this.viewport.top) + this.viewport.height / 2 - height / 2
      );
      const left = Math.floor(
        scale(this.viewport.left) + this.viewport.width / 2 - width / 2
      );
      return {
        width: width + "px",
        height: height + "px",
        top: top + "px",
        left: left + "px"
      };
    },
    // 裁剪视图
    cropBoxStyle() {
      const scale = value => value * this.viewport.zoom;
      return {
        // here be dragons!
        clipPath: `polygon(evenodd, 0 0, 0 ${scale(
          this.recording.height
        )}px, ${scale(this.recording.width)}% ${scale(
          this.recording.height
        )}px, ${scale(this.recording.width)}% 0, 0 0, ${scale(
          this.crop.left
        )}px ${scale(this.crop.top)}px, ${scale(this.crop.left)}px ${scale(
          this.crop.top + this.crop.height
        )}px, ${scale(this.crop.left + this.crop.width)}px ${scale(
          this.crop.top + this.crop.height
        )}px, ${scale(this.crop.left + this.crop.width)}px ${scale(
          this.crop.top
        )}px, ${scale(this.crop.left)}px ${scale(this.crop.top)}px)`
      };
    },
    // 进度条最大长度=录屏时长
    getPlayBarMax() {
      return this.recording.duration;
    },
    // 裁剪进度条
    trimBarStyle() {
      return {
        left: `${(this.trim.start * 100) / this.recording.duration}%`,
        width: `${((this.trim.end - this.trim.start) * 100) /
          this.recording.duration}%`
      };
    },
    // 视图是否有裁剪
    isClip() {
      const { top, left, width, height } = this.crop;
      const isCropped =
        top !== 0 ||
        left !== 0 ||
        width !== this.recording.width ||
        height !== this.recording.height;
      return isCropped;
    }
  },

  mounted() {
    this.initData();
    this.oncreate();
  },

  methods: {
    //   初始化数据
    initData() {
      const { duration, width, height } = this.recording;
      this.trim.end = duration;
      this.crop.width = width;
      this.crop.height = height;
    },
    oncreate() {
      this.canvas = document.getElementsByTagName("canvas")[0];
      this.playbar = document.querySelector(".playbar");
      this.content = document.querySelector(".content");

      const viewportListener = () => this.updateViewport();
      window.addEventListener("resize", viewportListener);
      this.viewportDisposable = () =>
        window.removeEventListener("resize", viewportListener);
      this.updateViewport();
      this.zoomToFit();
      this.handleMouseWheel();
      setTimeout(() => this.play());
    },
    //   调整窗口
    updateViewport() {
      this.viewport.width = Math.floor(this.content.clientWidth);
      this.viewport.height = Math.floor(this.content.clientHeight);
    },
    // 视区比例
    zoomToFit() {
      this.viewport.zoom = Math.max(
        0.1,
        Math.min(
          1,
          (this.viewport.width * 0.95) / this.recording.width,
          (this.viewport.height * 0.95) / this.recording.height
        )
      );
    },
    // 在视图区鼠标滚动 缩放视图
    handleMouseWheel() {
      const { canvasBoxWrap } = this.$refs;
      canvasBoxWrap.onmousewheel = e => {
        e.stopPropagation();
        e.preventDefault();
        const zoom = this.viewport.zoom - (e.deltaY / 180) * 0.1;
        this.viewport.zoom = Math.max(0.1, Math.min(2, zoom));
      };
    },
    // 在视图区 focus 裁剪
    onContentMouseDown(event) {
      if (
        event.button === 0 &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey
      ) {
        this.onCrop(event);
      } else {
        this.onViewportMove(event);
      }
    },
    // 播放
    play() {
      if (this.playback.disposable) {
        this.playback.disposable();
      }
      this.isPlaying = true;
      let lastIndex = undefined;
      let animationFrame = undefined;
      const ctx = this.canvas.getContext("2d");
      this.playback.head = Math.max(
        this.playback.start,
        Math.min(this.playback.end, this.playback.head)
      );

      this.playback.offset =
        Date.now() - this.playback.head + this.playback.start;

      const draw = () => {
        this.playback.head =
          this.playback.start +
          ((Date.now() - this.playback.offset) %
            (this.playback.end - this.playback.start));
        const index = getFrameIndex(this.recording.frames, this.playback.head);

        if (lastIndex !== index) {
          ctx.putImageData(this.recording.frames[index].imageData, 0, 0);
        }

        lastIndex = index;
        animationFrame = requestAnimationFrame(draw);
      };

      animationFrame = requestAnimationFrame(draw);

      this.playback.disposable = () => {
        cancelAnimationFrame(animationFrame);
      };
    },
    pause() {
      if (this.playback.disposable) {
        this.playback.disposable();
        this.playback.disposable = undefined;
      }
    },
    togglePlayPause() {
      if (this.playback.disposable) {
        this.pause();
      } else {
        this.play();
      }
    },
    // 进度条滚动
    onPlaybarInput(value) {
      this.playback.head = value;
      const ctx = this.canvas.getContext("2d");
      const index = getFrameIndex(this.recording.frames, this.playback.head);
      ctx.putImageData(this.recording.frames[index].imageData, 0, 0);
    },
    // 长度裁剪
    onTrimMouseDown(event, handle) {
      event.preventDefault();
      const ctx = this.canvas.getContext("2d");
      const start = {
        width: this.playbar.clientWidth,
        screenX: event.screenX,
        head: handle === "start" ? this.trim.start : this.trim.end,
        min: handle === "start" ? 0 : this.trim.start + FRAME_DELAY,
        max:
          handle === "start"
            ? this.trim.end - FRAME_DELAY
            : this.recording.duration
      };
      const onMouseMove = e => {
        const diff = e.screenX - start.screenX;
        const head =
          start.head +
          Math.round((diff * this.recording.duration) / start.width);
        this.trim[handle] = Math.max(start.min, Math.min(start.max, head));
      };
      const onMouseUp = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        window.removeEventListener("mouseup", onMouseUp);

        this.playback.start = this.trim.start;
        this.playback.end = this.trim.end;

        if (this.playback.disposable) {
          this.playback.head = Math.max(
            this.playback.start,
            Math.min(this.playback.end, this.playback.head)
          );
          this.playback.offset =
            Date.now() - this.playback.head + this.playback.start;
          const index = getFrameIndex(
            this.recording.frames,
            this.playback.head
          );
          ctx.putImageData(this.recording.frames[index].imageData, 0, 0);
        }
      };
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    // 视频裁剪
    onCrop(event) {
      const width = this.recording.width * this.viewport.zoom;
      const height = this.recording.height * this.viewport.zoom;
      const { contentWrap } = this.$refs;
      const top = Math.floor(
        this.viewport.top * this.viewport.zoom +
          this.viewport.height / 2 -
          height / 2
      );
      const left = Math.floor(
        this.viewport.left * this.viewport.zoom +
          this.viewport.width / 2 -
          width / 2
      );
      const { offsetTop } = event.currentTarget;
      const { offsetLeft } = event.currentTarget;
      const mouseTop = event =>
        Math.max(
          0,
          Math.min(
            this.recording.height,
            (event.clientY - offsetTop - top) / this.viewport.zoom
          )
        );
      const mouseLeft = event =>
        Math.max(
          0,
          Math.min(
            this.recording.width,
            (event.clientX - offsetLeft - left) / this.viewport.zoom
          )
        );
      const point = event => ({
        top: Math.round(mouseTop(event)),
        left: Math.round(mouseLeft(event))
      });
      const from = point(event);

      let didMove = false;

      const onMouseMove = event => {
        const to = point(event);
        const top = Math.max(0, Math.min(from.top, to.top));
        const left = Math.max(0, Math.min(from.left, to.left));
        const width = Math.min(
          this.recording.width - left,
          Math.abs(from.left - to.left)
        );
        const height = Math.min(
          this.recording.height - top,
          Math.abs(from.top - to.top)
        );

        this.crop = { top, left, width, height };
        didMove = true;
      };

      const onMouseUp = event => {
        event.preventDefault();
        contentWrap.removeEventListener("mousemove", onMouseMove);
        contentWrap.removeEventListener("mouseup", onMouseUp);

        if (!didMove || this.crop.width < 10 || this.crop.height < 10) {
          this.crop = {
            top: 0,
            left: 0,
            width: this.recording.width,
            height: this.recording.height
          };
        }
      };
      event.preventDefault();
      contentWrap.addEventListener("mousemove", onMouseMove);
      contentWrap.addEventListener("mouseup", onMouseUp);
    },
    onViewportMove(event) {
      const start = {
        top: this.viewport.top,
        left: this.viewport.left,
        screenX: event.screenX,
        screenY: event.screenY
      };
      const { contentWrap } = this.$refs;
      const onMouseMove = e => {
        this.viewport.top =
          start.top + (e.screenY - start.screenY) / this.viewport.zoom;
        this.viewport.left =
          start.left + (e.screenX - start.screenX) / this.viewport.zoom;
      };

      const onMouseUp = event => {
        event.preventDefault();
        contentWrap.removeEventListener("mousemove", onMouseMove);
        contentWrap.removeEventListener("mouseup", onMouseUp);
      };

      event.preventDefault();
      contentWrap.addEventListener("mousemove", onMouseMove);
      contentWrap.addEventListener("mouseup", onMouseUp);
    },
    // 生成
    startRendering() {
      window.$ULOG && window.$ULOG.send && window.$ULOG.send(39976);
      this.$emit("saveRender", { trim: this.trim, crop: this.crop });
      this.$emit("changeStatus", { status: "render" });
    },
    // 删除 回到 blank 状态
    deleteGIF() {
      this.$emit("changeRecording", null);
      this.$emit("changeStatus", { status: "blank" });
    }
  }
};
</script>

<style lang="less" scoped>
.preview-page {
  display: flex;
  flex: 1;
  flex-direction: column;
  color: #333;
  background: #fafafa;
  height: calc(100% - 50px);
  .crop {
    cursor: crosshair;
  }
  .icon {
    text-align: center;
    width: 14px;
    height: 14px;
    vertical-align: middle;
  }

  .content {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    font-size: 20px;
    text-align: center;
    position: relative;
    overflow: hidden;
    .canvas-box {
      position: absolute;
      box-shadow: 0px 0px 5px 1px #00000054;
      canvas {
        width: 100%;
        height: 100%;
      }
      .crop-box {
        position: absolute;
        background: rgba(193, 193, 193, 0.69);
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
      }
    }
  }
  .actions {
    padding: 32px;
    border-top: 1px solid #9e9e9e;
    display: flex;

    .playbar {
      flex: 1;
      margin: 0 10px;
      position: relative;
      /deep/.el-input.is-disabled {
        height: 8px;
        line-height: 8px;
        border-radius: 4px;
        margin-top: 5px;
        color: rgb(197, 197, 197);
        transition: all 0.2s ease;
        opacity: 1;
      }
      /deep/.el-input .el-input__inner {
        border: none;
        background-color: unset;
        border-radius: 4px;
        height: inherit;
        position: absolute;
        top: 0;
        left: 0;
        appearance: slider-horizontal;
        transition: all 0.2s ease;
      }

      .trim-bar {
        border-top: 2px solid #13227a;
        position: absolute;
        top: 20px;
        .trim-start,
        .trim-end {
          position: absolute;
          border: 6px solid #13227a;
          border-bottom-color: transparent;
          cursor: pointer;
        }
        .trim-start {
          top: 0;
          left: 0;
          border-right-color: transparent;
        }
        .trim-end {
          top: 0;
          right: 0;
          border-left-color: transparent;
        }
      }
    }

    /deep/.el-button,
    /deep/.el-button.el-button--primary,
    /deep/.el-button.el-button--default {
      padding: 0;
      .icon {
        text-align: center;
        width: 18px;
        height: 18px;
        vertical-align: middle;
      }
    }
  }
}
</style>

<template>
  <div class="render-page">
    <div v-show="progress !== 1" class="content loading">
      <div class="progress">
        <el-progress
          :text-inside="true"
          :stroke-width="20"
          :percentage="getPercentage"
        ></el-progress
        >加载中.....
      </div>
      <div class="actions">
        <el-button type="primary" @click="cancelRendering">取消</el-button>
      </div>
    </div>
    <div v-show="progress === 1" style="height: 100%">
      <div class="content">
        <canvas
          class="hidden"
          :width="canvasStyle.width"
          :height="canvasStyle.height"
        ></canvas>
        <div v-if="gif" class="recording-card">
          <img :src="gif.url" alt />
          <div class="tag">
            <span>
              <svg-icon :icon-class="'clock'" class="icon"></svg-icon>
              {{ getGIFduration }}
            </span>
            <span>{{ getGIFsize }}</span>
          </div>
        </div>
      </div>

      <div class="actions">
        <el-button @click="discardGIF">
          <svg-icon :icon-class="'delete'" class="icon"></svg-icon>删除
        </el-button>
        <el-button type="primary" @click="cancelRendering">返回编辑</el-button>
        <el-button type="primary" @click="download">下载到本地</el-button>
      </div>
    </div>
  </div>
</template>
<script>
import GifEncoder from "../utils/gifencoder";
import { saveAs } from "file-saver";
import { getFrameIndex, timediff } from "../utils/utils";
export default {
  name: "RenderView",
  props: {
    // eslint-disable-next-line vue/require-default-prop
    recording: Object,
    // eslint-disable-next-line vue/require-default-prop
    renderOptions: Object,
    // eslint-disable-next-line vue/require-default-prop
    changeStatus: {
      required: false,
      type: Function
    },
    // eslint-disable-next-line vue/require-default-prop
    changeRenderOption: {
      required: false,
      type: Function
    },
    // eslint-disable-next-line vue/require-default-prop
    changeRecording: {
      required: false,
      type: Function
    }
  },
  data() {
    return {
      progress: 0,
      trim: {},
      crop: {},
      gif: {}
    };
  },
  computed: {
    canvasStyle() {
      const { width = 800, height = 800 } = this.recording || {};
      return { width, height };
    },
    getPercentage() {
      return Math.floor(this.progress * 100);
    },
    getGIFsize() {
      let { size } = this.gif;
      if (size < 1024) {
        return "1 KB";
      }
      size = Math.round(size / 1024);
      return size < 1024
        ? `${size} KB`
        : `${Math.floor((size / 1024) * 100) / 100} MB`;
    },
    getGIFduration() {
      const { duration } = this.gif;
      return timediff(duration);
    }
  },
  created() {
    this.trim = this.renderOptions.trim;
    this.crop = this.renderOptions.crop;
  },
  mounted() {
    this.createGIF();
  },
  methods: {
    async createGIF() {
      this.gif = new GifEncoder({
        width: this.crop.width,
        height: this.crop.height
      });
      this.gif.on("progress", progress => {
        this.progress = progress;
      });

      this.gif.once("finished", blob => {
        // console.log(`gifsicle: ${Math.floor(blob.size / 1000)}Kb`);
        const url = URL.createObjectURL(blob);
        this.setRenderedRecording({
          duration: this.trim.end - this.trim.start,
          size: blob.size,
          blob,
          url
        });
      });

      const ctx = document.getElementsByTagName("canvas")[0].getContext("2d");
      const start = getFrameIndex(this.recording.frames, this.trim.start);
      const end = getFrameIndex(this.recording.frames, this.trim.end);
      const processFrame = index => {
        if (!this.gif) return;
        if (index > end) {
          this.onbeforeremove = () => this.gif.abort();
          this.gif.render();
          return;
        }
        // eslint-disable-next-line prefer-const
        let { imageData, timestamp } = this.recording.frames[index];
        // we always copy the imagedata, because the user might want to
        // go back to edit, and we can't afford to lose frames which
        // were moved to web workers
        ctx.putImageData(imageData, 0, 0);
        imageData = ctx.getImageData(
          this.crop.left,
          this.crop.top,
          this.crop.width,
          this.crop.height
        );

        const delay =
          index < end
            ? this.recording.frames[index + 1].timestamp - timestamp
            : 100;

        this.gif.addFrame(imageData, delay);
        setTimeout(() => processFrame(index + 1), 0);
      };
      processFrame(start);
    },
    setRenderedRecording(data) {
      this.gif = data;
    },
    download() {
      window.$ULOG && window.$ULOG.send && window.$ULOG.send(39978);
      saveAs(this.gif.url, "灵镜录屏gif-" + Date.now() + ".gif");
    },
    // 取消生成gif 和返回编辑 都是回到preview页面
    cancelRendering() {
      window.$ULOG && window.$ULOG.send && window.$ULOG.send(39977);
      this.$emit("changeStatus", { status: "preview" });
      this.$emit("changeRenderOption", {});
      this.gif = undefined;
    },
    discardGIF() {
      this.$emit("changeStatus", { status: "blank" });
      this.$emit("changeRecording", null);
      this.gif = undefined;
    }
  }
};
</script>
<style lang="less" scoped>
.render-page {
  font-family: PingFangSC-Semibold;
  display: flex;
  flex: 1;
  flex-direction: column;
  color: #333;
  background: #fafafa;
  height: calc(100% - 50px);
  //   未加载完全
  .loading {
    display: flex;
    align-items: center;
    justify-content: space-around;
    flex-direction: column;
    .progress {
      width: 50%;
    }
  }
  .icon {
    text-align: center;
    width: 14px;
    height: 14px;
    vertical-align: middle;
  }
  .content {
    height: 100%;
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    font-size: 20px;
    text-align: center;
    position: relative;
    overflow: hidden;
    .hidden {
      display: none;
    }
    .recording-card {
      .tag {
        border-top: 1px solid #9e9e9e;
        margin-top: 18px;
        padding-top: 10px;
        display: flex;
        justify-content: space-between;
        color: #5e5e5e;
        font-size: 14px;
        span {
          border: 1px solid #d2d6dd;
          padding: 4px 8px;
          border-bottom: none;
        }
      }
    }
  }
  .actions {
    position: fixed;
    bottom: 0;
    width: 100%;
    padding: 24px 32px;
    border-top: 1px solid #9e9e9e;
    display: flex;
    /deep/.el-button {
      height: 32px;
      padding: 0 10px;
      border-radius: 2px;
      margin-right: 10px;
      span {
        height: 32px;
        line-height: 32px;
        display: inline-block;
      }
    }
  }
}
</style>
